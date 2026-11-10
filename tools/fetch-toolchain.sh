#!/usr/bin/env bash
# Rebuilds the Gradle-free Android toolchain that tools/build.sh expects, into
# ~/.cache/tc (override with QALAM_TOOLCHAIN).  Everything comes from public
# sources that are reachable from this sandbox: PyPI, the npm registry and
# github.com.  Run once per fresh sandbox — the cache directory is not part of
# the repository.
#
#   bash tools/fetch-toolchain.sh
#
# What it installs
#   $TC/jvm/bin/java       OpenJDK 25 runtime (from the jdk4py wheel; no javac)
#   $TC/apktool_2.4.1.jar  apktool — smali -> classes.dex, resource packaging
#   $TC/aapt2              static x86_64 aapt2 2.20
#   $TC/android-33.jar     real android.jar (boot classpath / resource ids)
#   $TC/tools.jar          javac 1.8.0_131 that still runs on a modern JVM,
#                          used only by tools/check_reference.sh
#
# Note: this sandbox blocks the JDK 25 posix_spawn helper, so build.sh runs the
# JVM with -Djdk.lang.Process.launchMechanism=FORK (apktool shells out to aapt2).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TC="${QALAM_TOOLCHAIN:-$HOME/.cache/tc}"
WORK="${QALAM_TOOLCHAIN_WORK:-/tmp/qalam-toolchain}"
mkdir -p "$TC" "$WORK"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing required tool: $1" >&2; exit 1; }; }
need python3; need npm; need git

echo "== 1/5 JVM (jdk4py 25)"
if [ ! -x "$TC/jvm/bin/java" ]; then
  ( cd "$WORK" && pip download jdk4py --no-deps -d "$WORK/jdk4py" >/dev/null )
  python3 - "$WORK" "$TC" <<'PY'
import glob, sys, zipfile, os, shutil
work, tc = sys.argv[1], sys.argv[2]
whl = glob.glob(os.path.join(work, 'jdk4py', '*.whl'))[0]
out = os.path.join(work, 'jdk4py-unpacked')
with zipfile.ZipFile(whl) as z:
    for n in z.namelist():
        if n.startswith('jdk4py/java-runtime/'):
            z.extract(n, out)
src = os.path.join(out, 'jdk4py', 'java-runtime')
dst = os.path.join(tc, 'jvm')
if os.path.isdir(dst):
    shutil.rmtree(dst)
shutil.copytree(src, dst)
for f in glob.glob(os.path.join(dst, 'bin', '*')):
    os.chmod(f, 0o755)
print('jvm ->', dst)
PY
fi
"$TC/jvm/bin/java" -version 2>&1 | head -1

echo "== 2/5 apktool 2.4.1 + tools.jar (npm)"
if [ ! -f "$TC/apktool_2.4.1.jar" ]; then
  ( cd "$WORK" && npm pack apktool-jar@2.4.1 >/dev/null
    rm -rf apktool-pkg && mkdir apktool-pkg && tar xzf apktool-jar-2.4.1.tgz -C apktool-pkg
    cp apktool-pkg/package/bin/apktool_2.4.1.jar "$TC/" )
fi
if [ ! -f "$TC/tools.jar" ]; then
  ( cd "$WORK" && npm pack dataslope-tools-jar@1.0.0 >/dev/null
    rm -rf tools-pkg && mkdir tools-pkg && tar xzf dataslope-tools-jar-1.0.0.tgz -C tools-pkg
    cp tools-pkg/package/tools.jar "$TC/" )
fi

echo "== 3/5 android.jar (API 33)"
if [ ! -f "$TC/android-33.jar" ]; then
  rm -rf "$WORK/android-platforms"
  git clone -q --filter=blob:none --no-checkout --depth 1 \
    https://github.com/Sable/android-platforms.git "$WORK/android-platforms"
  ( cd "$WORK/android-platforms" \
    && git sparse-checkout set --no-cone android-33/android.jar \
    && git checkout -q )
  cp "$WORK/android-platforms/android-33/android.jar" "$TC/android-33.jar"
fi

echo "== 4/5 aapt2 (static x86_64, 2.20)"
if [ ! -x "$TC/aapt2" ]; then
  rm -rf "$WORK/icsee"
  git clone -q --filter=blob:none --no-checkout --depth 1 \
    https://github.com/voidnullvalue/Icsee-android.git "$WORK/icsee"
  ( cd "$WORK/icsee" \
    && git sparse-checkout set --no-cone toolchain/aapt2-bin \
    && git checkout -q )
  # aapt2-bin/aapt2 is a qemu wrapper in that repo; ship the real binary
  cp "$WORK/icsee/toolchain/aapt2-bin/aapt2-x86_64" "$TC/aapt2"
  chmod +x "$TC/aapt2"
fi
"$TC/aapt2" version | head -1

echo "== 5/5 node modules for the signer and the test suites"
( cd "$ROOT/tools/apksign" && npm install --no-audit --no-fund >/dev/null )
( cd "$ROOT/tools/tests"   && npm install --no-audit --no-fund >/dev/null )

echo
echo "toolchain ready in $TC"
echo "build the APK with:  bash tools/build.sh"
