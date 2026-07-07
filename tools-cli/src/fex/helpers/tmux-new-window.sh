#!/usr/bin/env bash
# ============================================================
# helpers/tmux-new-window.sh — Tmux New Window Helper
#
# Dipanggil dari Go via os/exec untuk tmux new-window.
#
# Usage:
#   helpers/tmux-new-window.sh <window_name> [command]
#
# Arguments:
#   window_name   Nama window yang akan dibuat
#   command       Optional: command untuk window (default: shell)
#
# Output:
#   Window ID dari window yang baru dibuat (stdout)
#
# Exit codes:
#   0  — success
#   1  — not in tmux
# ============================================================
set -euo pipefail

# ── Check tmux ──
if [[ -z "${TMUX:-}" ]]; then
  echo "Error: not in tmux session" >&2
  exit 1
fi

# ── Parse args ──
WINDOW_NAME="${1:-fe-window}"
COMMAND="${2:-}"

# ── New window ──
if [[ -n "$COMMAND" ]]; then
  tmux new-window -n "$WINDOW_NAME" "$COMMAND"
else
  tmux new-window -n "$WINDOW_NAME"
fi

# ── Output window ID ──
NEW_WINDOW=$(tmux display -p '#{window_id}' 2>/dev/null || echo "")
echo "$NEW_WINDOW"
exit 0
