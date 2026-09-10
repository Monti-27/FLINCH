#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

while IFS= read -r source; do
  if (( $(wc -l < "$source") > 300 )); then
    echo "Rust file exceeds 300 lines: $source" >&2
    exit 1
  fi
done < <(rg --files crates/flinch-domain programs/flinch-v2 -g '*.rs')

if rg -n '//|/\*|\*/' crates/flinch-domain programs/flinch-v2 --glob '*.rs'; then
  echo "Rust code comments are not allowed" >&2
  exit 1
fi

cargo fmt --all -- --check
cargo test --workspace --locked --offline
cargo test -p flinch-domain --release --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
cargo-build-sbf --tools-version v1.53 --manifest-path programs/flinch-v2/Cargo.toml --sbf-out-dir target/deploy 2>&1 | tee target/v2-build.log
if rg -i 'overflows the maximum|stack offset.*exceeded|error:' target/v2-build.log; then
  exit 1
fi
anchor idl build --program-name flinch_v2 --skip-lint --out target/idl/flinch_v2.json --out-ts target/types/flinch_v2.ts
node scripts/generate-client.mjs --check
node scripts/check-client-source.mjs
bun run typecheck
bun run test:client
bun run test:keeper
bun run test:harness
bun run test:runtime
bun run --cwd apps/web typecheck
bun run --cwd apps/web test
NEXT_TELEMETRY_DISABLED=1 bun run --cwd apps/web build
node scripts/check-artifacts.mjs
