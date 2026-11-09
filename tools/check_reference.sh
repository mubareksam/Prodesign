#!/usr/bin/env bash
# Compiles the reference Java mirrors of the hand-written smali with javac
# (OpenJDK 8 tools.jar) against the real android.jar. This catches typos in
# method names/descriptors that smali itself cannot check.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TC="${QALAM_TOOLCHAIN:-$HOME/.cache/tc}"
ANDROID_JAR="${1:-$TC/android-33.jar}"
TOOLS_JAR="$TC/tools.jar"
OUT="$ROOT/build/refcheck"

[ -e "$TOOLS_JAR" ] || { echo "missing $TOOLS_JAR (run tools/fetch-toolchain.sh)" >&2; exit 1; }
mkdir -p "$OUT"
rm -rf "$OUT"/*

"$TC/jvm/bin/java" -cp "$TOOLS_JAR" com.sun.tools.javac.Main \
  -source 8 -target 8 -nowarn -bootclasspath "$ANDROID_JAR" \
  -d "$OUT" "$ROOT"/android/reference/*.java
echo "reference sources compile cleanly against $(basename "$ANDROID_JAR")"
