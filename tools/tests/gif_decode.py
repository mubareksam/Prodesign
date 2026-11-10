#!/usr/bin/env python3
"""Independent GIF decoder used to verify the app's encoder.

Only implements what the encoder emits (GIF89a, local colour tables, GCE,
Netscape looping extension) plus standard GIF LZW, so a bug in the JS encoder
cannot hide behind a shared implementation.
"""
import json
import sys


def lzw_decode(data, min_code_size, expected):
    clear = 1 << min_code_size
    eoi = clear + 1
    code_size = min_code_size + 1
    table = [bytes([i]) for i in range(clear)] + [b"", b""]
    prev = None
    out = bytearray()
    bitpos = 0
    total_bits = len(data) * 8

    def read_code(size):
        nonlocal bitpos
        if bitpos + size > total_bits:
            return None
        val = 0
        for i in range(size):
            byte = data[(bitpos + i) // 8]
            bit = (byte >> ((bitpos + i) % 8)) & 1
            val |= bit << i
        bitpos += size
        return val

    while True:
        code = read_code(code_size)
        if code is None or code == eoi:
            break
        if code == clear:
            table = [bytes([i]) for i in range(clear)] + [b"", b""]
            code_size = min_code_size + 1
            prev = None
            continue
        if code < len(table):
            entry = table[code]
        elif prev is not None and code == len(table):
            entry = prev + prev[:1]
        else:
            raise ValueError(f"bad LZW code {code} (table {len(table)})")
        out += entry
        if prev is not None:
            table.append(prev + entry[:1])
            if len(table) == (1 << code_size) and code_size < 12:
                code_size += 1
        prev = entry
        if len(out) > expected * 2:
            break
    return bytes(out[:expected])


def decode(path):
    raw = open(path, "rb").read()
    if raw[:6] not in (b"GIF89a", b"GIF87a"):
        raise ValueError("not a GIF")
    width = raw[6] | raw[7] << 8
    height = raw[8] | raw[9] << 8
    packed = raw[10]
    pos = 13
    if packed & 0x80:
        pos += 3 * (1 << ((packed & 7) + 1))

    frames = []
    delays = []
    pending_delay = 0
    while pos < len(raw):
        block = raw[pos]
        if block == 0x3B:
            break
        if block == 0x21:                              # extension
            label = raw[pos + 1]
            pos += 2
            if label == 0xF9:                          # graphic control
                size = raw[pos]
                pending_delay = raw[pos + 2] | raw[pos + 3] << 8
                pos += 1 + size
            while raw[pos]:                            # remaining sub-blocks
                size = raw[pos]
                pos += 1 + size
            pos += 1
            continue
        if block == 0x2C:                              # image descriptor
            fw = raw[pos + 5] | raw[pos + 6] << 8
            fh = raw[pos + 7] | raw[pos + 8] << 8
            ipacked = raw[pos + 9]
            pos += 10
            if ipacked & 0x80:
                pos += 3 * (1 << ((ipacked & 7) + 1))
            min_code = raw[pos]
            pos += 1
            chunks = bytearray()
            while True:
                size = raw[pos]
                pos += 1
                if not size:
                    break
                chunks += raw[pos:pos + size]
                pos += size
            pixels = lzw_decode(bytes(chunks), min_code, fw * fh)
            frames.append(list(pixels))
            delays.append(pending_delay)
            if len(pixels) != fw * fh:
                raise ValueError(f"frame decoded {len(pixels)} of {fw * fh} pixels")
            continue
        raise ValueError(f"unexpected block 0x{block:02x} at {pos}")
    return {"width": width, "height": height, "frames": frames, "delays": delays}


if __name__ == "__main__":
    info = decode(sys.argv[1])
    if "--json" in sys.argv:
        print(json.dumps(info))
    else:
        print(f"{info['width']}x{info['height']}, {len(info['frames'])} frames, delays {info['delays']}")
