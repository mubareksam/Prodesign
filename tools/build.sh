#!/usr/bin/env bash
# Builds Qalam.apk without Gradle or the Android SDK:
#   smali -> classes.dex (apktool), resources -> binary XML + resources.arsc (aapt2),
#   then APK Signature Scheme v1+v2 (apk_sign_ts).
#
# Requirements: a JVM, apktool.jar, an aapt2 binary and Node.js.
# tools/fetch-toolchain.sh explains where each of those comes from.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TC="${QALAM_TOOLCHAIN:-$HOME/.cache/tc}"
JAVA="$TC/jvm/bin/java"
APKTOOL="$TC/apktool_2.4.1.jar"
ANDROID_JAR="$TC/android-33.jar"
BUILD="$ROOT/build"
DIST="$ROOT/artifacts"
VERSION="${QALAM_VERSION:-3.0}"

for f in "$JAVA" "$APKTOOL" "$TC/aapt2"; do
  [ -e "$f" ] || { echo "missing toolchain file: $f (run tools/fetch-toolchain.sh)" >&2; exit 1; }
done

export PATH="$TC/jvm/bin:$TC:$PATH"   # apktool shells out to `aapt2` and `java`
# the sandbox seccomp blocks JDK 25's posix_spawn helper; the legacy fork path works
JAVA_OPTS="${JAVA_OPTS:--Djdk.lang.Process.launchMechanism=FORK}"
mkdir -p "$BUILD" "$DIST"

echo "== 1/4 type-checking hand-written smali against android.jar"
bash "$ROOT/tools/check_reference.sh" "$ANDROID_JAR"

echo "== 2/4 assembling resources + dex"
UNSIGNED="$BUILD/qalam-unsigned.apk"
"$JAVA" $JAVA_OPTS -jar "$APKTOOL" b "$ROOT/android" -o "$UNSIGNED" --use-aapt2

echo "== 3/4 signing (v1 + v2)"
OUT="$DIST/Qalam-$VERSION.apk"
( cd "$ROOT/tools/apksign" && node sign.mjs "$UNSIGNED" "$OUT" )

echo "== 4/4 verifying"
"$TC/aapt2" dump badging "$OUT" | sed -n '1,6p'
python3 "$ROOT/tools/verify_apk.py" "$OUT"

echo
echo "APK: $OUT"
ls -lh "$OUT"
