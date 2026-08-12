#!/usr/bin/env bash
# ============================================================
# helpers/tmux-split.sh — Tmux Split Window Helper
#
# Dipanggil dari Go via os/exec untuk tmux split operations.
#
# Usage:
#   helpers/tmux-split.sh <direction> [command]
#
# Arguments:
#   direction   "h" untuk horizontal, "v" untuk vertical
#   command     Optional: command buat pane baru (default: shell)
#
# Output:
#   Pane ID dari pane yang baru dibuat (stdout)
#
# Exit codes:
#   0  — success
#   1  — not in tmux
#   2  — invalid direction
# ============================================================
set -euo pipefail

# ── Check tmux ──
if [[ -z "${TMUX:-}" ]]; then
  echo "Error: not in tmux session" >&2
  exit 1
fi

# ── Parse args ──
DIRECTION="${1:-h}"
COMMAND="${2:-}"

case "$DIRECTION" in
  h|-h|horizontal)
    TMUX_FLAG="-h"
    DIRECTION_LABEL="horizontal"
    ;;
  v|-v|vertical)
    TMUX_FLAG="-v"
    DIRECTION_LABEL="vertical"
    ;;
  *)
    echo "Error: invalid direction '$DIRECTION'. Use 'h' or 'v'." >&2
    exit 2
    ;;
esac

# ── Split window ──
if [[ -n "$COMMAND" ]]; then
  # Split dengan command spesifik
  # shellcheck disable=SC2086
  tmux split-window $TMUX_FLAG -p 30 "$COMMAND"
else
  # Split dengan shell default
  # shellcheck disable=SC2086
  tmux split-window $TMUX_FLAG -p 30
fi

# ── Output pane ID ──
NEW_PANE=$(tmux display -p '#{pane_id}' 2>/dev/null || echo "")
echo "$NEW_PANE"
exit 0
