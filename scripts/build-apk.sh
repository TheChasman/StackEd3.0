#!/usr/bin/env bash
# Builds a Tauri Android debug APK locally (formerly .github/workflows/build-apk.yml).
# Output: src-tauri/gen/android/app/build/outputs/apk/**/*.apk
#
# One-time prerequisite if src-tauri/gen/android doesn't exist yet:
#   cd src-tauri && cargo tauri android init
set -euo pipefail

cd "$(dirname "$0")/.."
cd src-tauri
cargo tauri android build --apk
