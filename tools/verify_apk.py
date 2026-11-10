#!/usr/bin/env python3
"""Structural + signature verification of a built Qalam APK, without the Android SDK.

Checks the things that make an APK fail to install or to be rejected by the
package manager:

  * required entries exist and the DEX header is self-consistent
  * resources.arsc is stored (not deflated) and 4-byte aligned (targetSdk >= 30)
  * an APK Signature Scheme v2 block exists and is positioned correctly
  * the v2 content digests recomputed from the archive match the signed digests
  * the RSA signature over the signed-data blob verifies with the app certificate
"""
import hashlib
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

APK_SIG_BLOCK_MAGIC = b"APK Sig Block 42"
V2_BLOCK_ID = 0x7109871A
CHUNK = 1024 * 1024
SIG_ALGS = {
    0x0101: ("RSASSA-PSS", "sha256"),
    0x0102: ("RSASSA-PSS", "sha512"),
    0x0103: ("RSA-PKCS1-v1_5", "sha256"),
    0x0104: ("RSA-PKCS1-v1_5", "sha512"),
    0x0201: ("ECDSA", "sha256"),
    0x0202: ("ECDSA", "sha512"),
    0x0301: ("DSA", "sha256"),
    0x0421: ("RSA-PKCS1-v1_5", "sha256"),
    0x0423: ("RSA-PKCS1-v1_5", "sha256"),
}
NAME = {"sha256": "sha256", "sha512": "sha512"}


def fail(msg):
    print(f"FAIL  {msg}")
    sys.exit(1)


def lp(buf, pos):
    """Read a uint32-length-prefixed slice."""
    (n,) = struct.unpack_from("<I", buf, pos)
    return buf[pos + 4:pos + 4 + n], pos + 4 + n


def u32(buf, pos):
    return struct.unpack_from("<I", buf, pos)[0]


def content_digest(sections, name):
    """APK Signature Scheme v2 content digest.

    Each section is split into <=1 MB chunks, each chunk is hashed as
    0xa5 || uint32(length) || chunk, and the chunk hashes are aggregated as
    0x5a || uint32(count) || hashes, then hashed once more.
    """
    chunk_hashes = []
    for section in sections:
        for i in range(0, max(len(section), 1), CHUNK):
            part = section[i:i + CHUNK]
            if not part:
                continue
            h = hashlib.new(name)
            h.update(b"\xa5")
            h.update(struct.pack("<I", len(part)))
            h.update(part)
            chunk_hashes.append(h.digest())
    top = hashlib.new(name)
    top.update(b"\x5a")
    top.update(struct.pack("<I", len(chunk_hashes)))
    for d in chunk_hashes:
        top.update(d)
    return top.digest()


def split_sections(raw):
    eocd = raw.rfind(b"PK\x05\x06")
    if eocd < 0:
        fail("no end-of-central-directory record")
    cd_size, cd_off = struct.unpack_from("<II", raw, eocd + 12)
    if raw.rfind(APK_SIG_BLOCK_MAGIC) < 0:
        fail("no APK Signing Block (v2/v3 signature) — Android 11+ would reject this APK")
    magic_off = raw.rfind(APK_SIG_BLOCK_MAGIC)
    (block_size,) = struct.unpack_from("<Q", raw, magic_off - 8)
    block_start = magic_off + 16 - 8 - block_size
    if block_start < 0 or magic_off + 16 != cd_off:
        fail("signing block is not immediately before the central directory")
    patched = bytearray(raw)
    patched[eocd + 16:eocd + 20] = struct.pack("<I", block_start)
    sections = [
        bytes(raw[0:block_start]),          # contents of ZIP entries
        bytes(raw[cd_off:eocd]),            # central directory
        bytes(patched[eocd:]),              # EOCD with the CD offset rewritten
    ]
    return bytes(raw[block_start:magic_off + 16]), sections, cd_off


def parse_v2(block):
    (size,) = struct.unpack_from("<Q", block, 0)
    pairs_end = len(block) - 24
    if size + 8 != len(block):
        fail("signing block size field is inconsistent")
    pos = 8
    found = None
    while pos < pairs_end:
        (plen,) = struct.unpack_from("<Q", block, pos)
        (pid,) = struct.unpack_from("<I", block, pos + 8)
        value = block[pos + 12:pos + 8 + plen]
        if pid == V2_BLOCK_ID:
            found = value
        pos += 8 + plen
    if found is None:
        fail("no APK Signature Scheme v2 block found")
    signers, _ = lp(found, 0)
    signer, _ = lp(signers, 0)
    signed_data, p = lp(signer, 0)
    signatures, p = lp(signer, p)
    pubkey, p = lp(signer, p)
    digests, q = lp(signed_data, 0)
    certs, q = lp(signed_data, q)
    return signed_data, signatures, digests, certs, pubkey


def verify(path):
    raw = Path(path).read_bytes()
    print(f"file:  {path}")
    print(f"size:  {len(raw)} bytes")
    print(f"sha256:{hashlib.sha256(raw).hexdigest()}")

    zf = zipfile.ZipFile(path)
    names = set(zf.namelist())
    for required in ("classes.dex", "AndroidManifest.xml", "resources.arsc"):
        if required not in names:
            fail(f"missing {required}")

    dex = zf.read("classes.dex")
    if not dex.startswith(b"dex\n"):
        fail("classes.dex has no valid magic")
    (file_size,) = struct.unpack_from("<I", dex, 32)
    if file_size != len(dex):
        fail(f"dex file_size {file_size} != actual {len(dex)}")
    print(f"dex:   version {dex[4:7].decode()}, {len(dex)} bytes")
    print(f"zip:   {len(names)} entries")

    for info in zf.infolist():
        if info.filename == "resources.arsc":
            data_off = info.header_offset + 30 + len(info.filename) + len(info.extra)
            if info.compress_type != zipfile.ZIP_STORED:
                fail("resources.arsc must be stored uncompressed")
            if data_off % 4:
                fail("resources.arsc must be 4-byte aligned")
            print("arsc:  stored + 4-byte aligned")

    block, sections, cd_off = split_sections(raw)
    signed_data, signatures, digests, certs, pubkey = parse_v2(block)
    n_certs, cp = 0, 0
    while cp < len(certs):
        _, cp = lp(certs, cp)
        n_certs += 1
    print(f"sig:   v2 block {len(block)} bytes, {n_certs} certificate(s)")

    ok_algs = []
    pos = 0
    while pos < len(digests):
        (rec_len,) = struct.unpack_from("<I", digests, pos)
        rec = digests[pos + 4:pos + 4 + rec_len]
        pos += 4 + rec_len
        (alg,) = struct.unpack_from("<I", rec, 0)
        digest, _ = lp(rec, 4)
        if alg not in SIG_ALGS:
            continue
        scheme, hname = SIG_ALGS[alg]
        expected = content_digest(sections, NAME[hname])
        if digest != expected:
            fail(f"content digest mismatch for algorithm 0x{alg:04x}")
        ok_algs.append((alg, scheme, hname, digest))
    if not ok_algs:
        fail("no supported digest algorithms in v2 block")
    print(f"       content digests match ({', '.join(f'0x{a:04x}' for a, _, _, _ in ok_algs)})")

    # RSA signature over signed-data, verified with the bundled certificate
    pos = 0
    verified = False
    with tempfile.TemporaryDirectory() as td:
        cert_der, _ = lp(certs, 0)
        cert_pem = Path(td, "cert.pem")
        pub_pem = Path(td, "pub.pem")
        cert_pem.write_bytes(
            b"-----BEGIN CERTIFICATE-----\n"
            + __import__("base64").encodebytes(cert_der)
            + b"-----END CERTIFICATE-----\n")
        subprocess.run(["openssl", "x509", "-in", str(cert_pem), "-pubkey", "-noout",
                        "-out", str(pub_pem)], check=True, capture_output=True)
        sigs = signatures
        sp = 0
        while sp < len(sigs):
            (rec_len,) = struct.unpack_from("<I", sigs, sp)
            rec = sigs[sp + 4:sp + 4 + rec_len]
            sp += 4 + rec_len
            (alg,) = struct.unpack_from("<I", rec, 0)
            sig, _ = lp(rec, 4)
            if alg in (0x0103, 0x0104, 0x0421, 0x0423):
                _, hname = SIG_ALGS[alg]
                Path(td, "sig.bin").write_bytes(sig)
                Path(td, "data.bin").write_bytes(signed_data)
                r = subprocess.run(["openssl", "dgst", f"-{hname}", "-verify", str(pub_pem),
                                    "-signature", str(Path(td, "sig.bin")),
                                    str(Path(td, "data.bin"))], capture_output=True)
                if r.returncode != 0:
                    fail(f"RSA signature does not verify: {r.stdout.decode().strip()}")
                print(f"       RSA-{hname} signature verifies against the app certificate")
                verified = True
    if not verified:
        fail("no RSA signature could be verified")

    print("VERIFIED — installable APK")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: verify_apk.py <apk>")
    verify(sys.argv[1])
