#!/usr/bin/env bash
# ============================================================
# popup_input.sh — Reusable popup input dialog for fe bindings
# Letak: tools-cli/src/fe/popup_input.sh
#
# Usage: popup_input.sh <output_file> <dialog_title>
#   output_file  — path temp file tempat hasil input ditulis
#   dialog_title — teks judul yang ditampilkan di dalam popup
#
# Priority:
#   1. tmux display-popup  (jika di dalam tmux session)
#   2. fzf mini dialog     (jika fzf tersedia, non-tmux)
#   3. read fallback       (terminal biasa)
# ============================================================

OUTFILE="$1"
TITLE="${2:-Input:}"

rm -f "$OUTFILE"

# ── Tier 1: tmux display-popup ──────────────────────────────
if [ -n "${TMUX:-}" ]; then
  _popup_script=$(mktemp /tmp/fe-popup-XXXXX.sh)
  cat > "$_popup_script" << POPUPEOF
#!/usr/bin/env bash
printf '\n  %s\n\n  ❯ ' "${TITLE}"
read -r _inp
printf '%s' "\$_inp" > '${OUTFILE}'
POPUPEOF
  chmod +x "$_popup_script"
  tmux display-popup -E -w 60% -h 8 "$_popup_script"
  rm -f "$_popup_script"

# ── Tier 2: fzf mini input dialog (non-tmux) ────────────────
elif command -v fzf > /dev/null 2>&1; then
  _result=$(
    fzf \
      --print-query \
      --prompt " ❯ " \
      --header "  ${TITLE}" \
      --header-first \
      --no-sort \
      --height=8 \
      --layout=reverse \
      --border=rounded \
      --border-label=" ${TITLE} " \
      --no-info \
      --phony \
      < /dev/null 2>/dev/null | head -1
  )
  printf '%s' "$_result" > "$OUTFILE"

# ── Tier 3: read fallback ────────────────────────────────────
else
  printf '\n  %s\n  ❯ ' "$TITLE"
  read -r _inp
  printf '%s' "$_inp" > "$OUTFILE"
fi
