#!/usr/bin/env bash
# ============================================================
# popup_input.sh — Simple input prompt for fe bindings
# Letak: tools-cli/src/fe/popup_input.sh
#
# Simple prompt — pake read langsung dari terminal.
# fzf 0.53.0+ udah auto redirect stdin ke /dev/tty di execute,
# jadi gak perlu ribet.
#
# Usage: popup_input.sh <output_file> <dialog_title>
# ============================================================

OUTFILE="$1"
TITLE="${2:-Input:}"
rm -f "$OUTFILE"

# Read langsung — di dalam fzf execute stdin udah指向 terminal,
# di luar execute ya terminal biasa.
printf '\n  ┌─ %s\n  └─ ❯ ' "$TITLE"
read -r _inp
printf '%s' "${_inp:-}" > "$OUTFILE"
