#!/usr/bin/env python3
"""Builds every launcher icon from build/icon-source.png with no image
libraries: a small PNG decoder, an area-average downscaler and a PNG writer.

  * res/mipmap-*/ic_launcher.png  legacy square icon (all densities)
  * res/mipmap-*/ic_fore.png      adaptive-icon foreground (stroke on alpha)
  * res/mipmap-anydpi-v26/ic_launcher.xml
  * docs/icon-512.png             store / documentation icon
"""
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "build", "icon-source.png")
RES = os.path.join(ROOT, "android", "res")


# ── PNG reading ──────────────────────────────────────────────

def read_png(path):
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos, idat, w, h, ctype = 8, b"", 0, 0, 6
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype_name = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length
        if ctype_name == b"IHDR":
            w, h, depth, ctype, comp, filt, interlace = struct.unpack(">IIBBBBB", chunk)
            if depth != 8 or interlace != 0 or ctype not in (2, 6):
                raise ValueError(f"unsupported PNG: depth={depth} type={ctype} interlace={interlace}")
        elif ctype_name == b"IDAT":
            idat += chunk
        elif ctype_name == b"IEND":
            break

    raw = zlib.decompress(idat)
    channels = 3 if ctype == 2 else 4
    stride = w * channels
    out = bytearray(w * h * 4)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if f == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                b = prev[i]
                c = prev[i - channels] if i >= channels else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        elif f != 0:
            raise ValueError(f"bad filter {f}")
        prev = line
        for x in range(w):
            s = x * channels
            d = (y * w + x) * 4
            out[d] = line[s]
            out[d + 1] = line[s + 1]
            out[d + 2] = line[s + 2]
            out[d + 3] = line[s + 3] if channels == 4 else 255
    return w, h, out


# ── PNG writing ──────────────────────────────────────────────

def write_png(path, w, h, rgba):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgba[y * w * 4:(y + 1) * w * 4]

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload +
                struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    body = (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(bytes(raw), 9)) +
            chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(body)


# ── image ops ────────────────────────────────────────────────

def resize(src, sw, sh, dw, dh):
    """Area-average downscale (and bilinear-ish upscale when needed)."""
    out = bytearray(dw * dh * 4)
    x_ratio = sw / dw
    y_ratio = sh / dh
    for y in range(dh):
        y0 = int(y * y_ratio)
        y1 = max(y0 + 1, min(sh, int((y + 1) * y_ratio)))
        for x in range(dw):
            x0 = int(x * x_ratio)
            x1 = max(x0 + 1, min(sw, int((x + 1) * x_ratio)))
            r = g = b = a = n = 0
            for yy in range(y0, y1):
                base = (yy * sw) * 4
                for xx in range(x0, x1):
                    i = base + xx * 4
                    pa = src[i + 3]
                    r += src[i] * pa
                    g += src[i + 1] * pa
                    b += src[i + 2] * pa
                    a += pa
                    n += 1
            d = (y * dw + x) * 4
            if a:
                out[d] = r // a
                out[d + 1] = g // a
                out[d + 2] = b // a
            out[d + 3] = a // max(1, n)
    return out


def keyed_foreground(src, w, h):
    """Turn the bright paint stroke into an alpha-masked foreground layer."""
    out = bytearray(len(src))
    for i in range(0, len(src), 4):
        r, g, b = src[i], src[i + 1], src[i + 2]
        lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
        # background is very dark charcoal, the stroke is bright amber
        alpha = max(0.0, min(1.0, (lum - 0.13) / 0.30))
        alpha = alpha ** 0.85
        if alpha <= 0.01:
            continue
        # slightly lift saturation so the stroke stays vivid on any background
        out[i] = min(255, int(r * 1.04))
        out[i + 1] = min(255, int(g * 1.02))
        out[i + 2] = min(255, int(b))
        out[i + 3] = int(alpha * 255)
    return out


def main():
    if not os.path.exists(SRC):
        sys.exit(f"missing {SRC} (generate the app icon first)")
    w, h, px = read_png(SRC)
    print(f"source {w}x{h}")

    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, size in densities.items():
        icon = resize(px, w, h, size, size)
        write_png(os.path.join(RES, f"mipmap-{name}", "ic_launcher.png"), size, size, icon)
        # adaptive foreground: 108 dp box, art occupies the safe centre
        fore_box = int(size * 2.25)
        art = resize(px, w, h, int(fore_box * 0.78), int(fore_box * 0.78))
        canvas = bytearray(fore_box * fore_box * 4)
        off = (fore_box - int(fore_box * 0.78)) // 2
        for y in range(int(fore_box * 0.78)):
            row = (y + off) * fore_box + off
            canvas[row * 4:(row + int(fore_box * 0.78)) * 4] = \
                art[y * int(fore_box * 0.78) * 4:(y + 1) * int(fore_box * 0.78) * 4]
        canvas = keyed_foreground(canvas, fore_box, fore_box)
        write_png(os.path.join(RES, f"mipmap-{name}", "ic_fore.png"), fore_box, fore_box, canvas)
        print(f"  mipmap-{name}: launcher {size}px, foreground {fore_box}px")

    write_png(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml.png.ignore"), 1, 1, bytearray(4)) \
        if False else None
    os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
    with open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), "w") as fh:
        fh.write('<?xml version="1.0" encoding="utf-8"?>\n'
                 '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                 '    <background android:drawable="@color/qalam_bg" />\n'
                 '    <foreground android:drawable="@mipmap/ic_fore" />\n'
                 '</adaptive-icon>\n')

    big = resize(px, w, h, 512, 512)
    write_png(os.path.join(ROOT, "docs", "icon-512.png"), 512, 512, big)
    print("wrote docs/icon-512.png")


if __name__ == "__main__":
    main()
