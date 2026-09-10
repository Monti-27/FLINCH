#!/usr/bin/env bash
set -euo pipefail

cargo fmt --all -- --check
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo-build-sbf --tools-version "${SBF_TOOLS_VERSION:-v1.53}" --manifest-path programs/flinch/Cargo.toml --sbf-out-dir target/deploy
anchor idl build --skip-lint --out target/idl/flinch.json
