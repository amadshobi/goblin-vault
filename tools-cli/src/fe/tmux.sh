#!/usr/bin/env bash
# ============================================================
# tmux.sh — Tmux Split Layout and Focus Helper
# Letak: tools-cli/src/fe/tmux.sh
# ============================================================

TMUX_RIGHT_PANE=""

# Split window on startup if in tmux session
setup_tmux_split() {
  if [[ -n "${TMUX:-}" ]]; then
    local pane_count
    pane_count="$(tmux list-panes 2>/dev/null | wc -l)" || pane_count=1
    if [[ "$pane_count" -lt 2 ]]; then
      local current_pane
      current_pane="$(tmux display -p '#{pane_id}' 2>/dev/null)" || current_pane=""
      if [[ -n "$current_pane" ]]; then
        tmux split-window -h -p 30 2>/dev/null || true
        TMUX_RIGHT_PANE="$(tmux display -p '#{pane_id}' 2>/dev/null)" || TMUX_RIGHT_PANE=""
        tmux select-pane -t "$current_pane" 2>/dev/null || true
        tmux send-keys -t "$TMUX_RIGHT_PANE" "clear && echo '  === fe editor panel ==='" C-m 2>/dev/null || true
      fi
    fi
  fi
  export TMUX_RIGHT_PANE
}

# Open file with busy check and split fallback
open_file() {
  local file="$1"
  [[ -z "$file" ]] && return
  
  local abs_file
  case "$file" in
    /*) abs_file="$file" ;;
    *)  abs_file="$(pwd)/${file#./}" ;;
  esac
  
  if [[ -n "$TMUX_RIGHT_PANE" ]]; then
    local current_cmd
    current_cmd=$(tmux display-message -p -t "$TMUX_RIGHT_PANE" '#{pane_current_command}' 2>/dev/null || echo "")
    local _safe_abs
    _safe_abs=$(printf '%q' "$abs_file")
    # Check if the right pane is idle (shell prompt)
    if [[ -z "$current_cmd" || "$current_cmd" =~ ^(bash|zsh|sh|fish|idle|clear|echo)$ ]]; then
      tmux send-keys -t "$TMUX_RIGHT_PANE" "$EDITOR $_safe_abs" C-m
      tmux select-pane -t "$TMUX_RIGHT_PANE"
    else
      # If pane is busy, open in a new split pane and focus it
      tmux split-window -h "$EDITOR $_safe_abs"
    fi
  else
    editor_open "$file"
  fi
}
