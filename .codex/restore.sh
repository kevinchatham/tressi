#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p ~/.codex
cp "$SCRIPT_DIR/config.toml" ~/.codex/config.toml
