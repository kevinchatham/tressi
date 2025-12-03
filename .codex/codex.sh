npm i -g @openai/codex
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" 
cd "$SCRIPT_DIR" || exit 1
./.codex/restore.sh
codex -p llamacpp
