#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

expected=c5ba03746795b128cdfb38af41bbef130dc6d38cff532e03b208c938a8787a82
destination=target/raydium-devnet.so
if [[ -e "$destination" ]]; then
  actual=$(shasum -a 256 "$destination" | cut -d ' ' -f 1)
  [[ "$actual" == "$expected" ]] || { echo "Existing Raydium artifact has an unreviewed hash" >&2; exit 1; }
  exit 0
fi

mkdir -p target
download=$(mktemp -d target/raydium-download.XXXXXX)
solana --url https://api.devnet.solana.com program dump DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb "$download/program.so"
actual=$(shasum -a 256 "$download/program.so" | cut -d ' ' -f 1)
[[ "$actual" == "$expected" ]] || { echo "Devnet Raydium changed; retained download at $download for review" >&2; exit 1; }
mv "$download/program.so" "$destination"
rmdir "$download"
