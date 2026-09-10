#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

while IFS= read -r source; do
  lines=$(wc -l < "$source")
  if (( lines > 300 )); then
    echo "Rust file exceeds 300 lines: $source" >&2
    exit 1
  fi
done < <(rg --files crates/flinch-domain -g '*.rs')

if rg -n '//|/\*|\*/' crates/flinch-domain --glob '*.rs'; then
  echo "Code comments are not allowed in the domain crate" >&2
  exit 1
fi

cargo fmt --package flinch-domain -- --check
cargo test --package flinch-domain --locked --offline
cargo clippy --package flinch-domain --all-targets --locked --offline -- -D warnings
