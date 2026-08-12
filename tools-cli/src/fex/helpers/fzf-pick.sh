#!/usr/bin/env bash
# ============================================================
# helpers/fzf-pick.sh — FZF Selector with Preview (bat)
#
# Dipanggil dari Go via os/exec untuk operasi fzf yang kompleks.
# Delegasi: Go handle input/output piping, bash handle interaksi.
#
# Usage:
#   helpers/fzf-pick.sh <mode> <input_file> [options]
#
# Modes:
#   tree      — tree navigation dengan bindings spesifik
#   find      — file finder dengan preview
#   search    — text search results
#   pick      — generic picker (default)
#
# Options:
#   --prompt <str>        FZF prompt string
#   --header <str>        Header text
#   --label <str>         Border label
#   --preview <cmd>       Preview command (default: autodetect bat/cat)
#   --multi               Enable multi-select
#   --bind <key:action>   Additional key bindings (repeatable)
#   --workdir <path>      Working directory
#
# Output:
#   Selected item(s) ke stdout, satu per line.
#   Exit code:
#     0  — selection made
#     1  — no selection
#     130 — cancelled (Esc/Ctrl-C)
# ============================================================
set -euo pipefail

# ── Parse args ──
MODE="${1:-pick}"
INPUT_FILE=""
PROMPT=" ❯ "
HEADER=""
LABEL=""
PREVIEW_CMD=""
MULTI=false
BINDINGS=()
WORKDIR=""

shift 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt)    PROMPT="$2";  shift 2 ;;
    --header)    HEADER="$2";  shift 2 ;;
    --label)     LABEL="$2";   shift 2 ;;
    --preview)   PREVIEW_CMD="$2"; shift 2 ;;
    --multi)     MULTI=true;   shift ;;
    --bind)      BINDINGS+=("$2"); shift 2 ;;
    --workdir)   WORKDIR="$2"; shift 2 ;;
    *)           INPUT_FILE="$1"; shift ;;
  esac
done

# ── Auto-detect preview command ──
if [[ -z "$PREVIEW_CMD" ]]; then
  if command -v bat &>/dev/null; then
    PREVIEW_CMD="bat --style=numbers --color=always {} 2>/dev/null"
  elif command -v batcat &>/dev/null; then
    PREVIEW_CMD="batcat --style=numbers --color=always {} 2>/dev/null"
  else
    PREVIEW_CMD="cat -n {} 2>/dev/null"
  fi
fi

# ── Build FZF args ──
FZF_ARGS=(
  --layout=reverse
  --style=full
  --highlight-line
  --track
  --filepath-word
  --info=inline-right
  --header-first
  --prompt "$PROMPT"
  --preview "$PREVIEW_CMD"
  --preview-window="right:60%:wrap,border-left,<80(up:50%:wrap)"
)

[[ -n "$HEADER" ]] && FZF_ARGS+=(--header "$HEADER")
[[ -n "$LABEL" ]]  && FZF_ARGS+=(--border-label "$LABEL")
[[ "$MULTI" == true ]] && FZF_ARGS+=(--multi)

for binding in "${BINDINGS[@]}"; do
  FZF_ARGS+=(--bind "$binding")
done

# ── Mode-specific config ──
case "$MODE" in
  tree)
    # Tree mode punya binding spesifik
    FZF_ARGS+=(--bind "ctrl-h:reload(...)")
    FZF_ARGS+=(--bind "esc:reload(...)")
    ;;
  find)
    # Find mode
    ;;
  search)
    # Search mode
    ;;
  pick|*)
    # Default picker
    ;;
esac

# ── Change working directory ──
if [[ -n "$WORKDIR" && -d "$WORKDIR" ]]; then
  cd "$WORKDIR"
fi

# ── Run FZF ──
if [[ -n "$INPUT_FILE" && -f "$INPUT_FILE" ]]; then
  # Pipe dari file
  fzf "${FZF_ARGS[@]}" < "$INPUT_FILE"
else
  # Pipe dari stdin
  fzf "${FZF_ARGS[@]}"
fi

# Exit code langsung dari fzf:
#   0 = item selected
#   1 = no match
#   130 = cancelled
