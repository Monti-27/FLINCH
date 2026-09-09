#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
[[ $# -eq 1 && "$1" = /* && "$1" != / ]] || { echo "Pass the absolute private deployment directory" >&2; exit 1; }
deployment_dir="$1"
bash scripts/fetch-raydium.sh --current-devnet
node tools/devnet/prepare.ts --directory "$deployment_dir"
cargo-build-sbf --tools-version v1.53 --manifest-path programs/flinch-v2/Cargo.toml --sbf-out-dir "$deployment_dir/build" --features devnet
anchor idl build --program-name flinch_v2 --skip-lint --out "$deployment_dir/build/flinch_v2.json" -- --features devnet
node scripts/generate-devnet-client.mjs "$deployment_dir/build" --check
node tools/devnet/probe.ts --directory "$deployment_dir"
