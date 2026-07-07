#!/usr/bin/env bash
# ============================================================
# ui.sh — FZF Arguments and Keybindings Builder
# Letak: tools-cli/src/fe/ui.sh
# ============================================================

# ── Helper: Rename Selected File ──
# Called via FE_FZF_HELPER wrapper from fzf execute().
fe_rename_selected() {
  [[ -z "$1" ]] && return 1
  [[ ! -f "$1" ]] && { echo "❌ Not a file" >&2; return 1; }

  local _old="$1"
  local _basename
  _basename=$(basename "$_old")
  local _outfile
  _outfile=$(mktemp /tmp/fe-rename-XXXXXX) || { echo "❌ Failed to create temp file" >&2; return 1; }

  bash "$FE_LIB_DIR/popup_input.sh" "$_outfile" "Rename: $_basename"
  local _newname
  _newname=$(cat "$_outfile" 2>/dev/null | tr -d '\n')
  rm -f "$_outfile"

  # Cancel: empty input or same name → no side effect
  [[ -z "$_newname" ]] && return 0
  [[ "$_newname" == "$_basename" ]] && return 0

  local _dir _target
  _dir=$(dirname "$_old")
  _target="$_dir/$_newname"

  if [[ -e "$_target" ]]; then
    echo "❌ Error: '$_newname' already exists" >&2
    return 1
  fi

  if mv -- "$_old" "$_target"; then
    echo "✅ Renamed: $_basename → $_newname" >&2
    return 0
  else
    echo "❌ Rename failed (check permissions)" >&2
    return 1
  fi
}

# ── Helper: Delete Selected File ──
# Called via FE_FZF_HELPER wrapper from fzf execute().
fe_delete_selected() {
  [[ -z "$1" ]] && return 1
  [[ ! -f "$1" ]] && { echo "❌ Not a file" >&2; return 1; }

  local _file="$1"
  local _outfile
  _outfile=$(mktemp /tmp/fe-delete-XXXXXX) || { echo "❌ Failed to create temp file" >&2; return 1; }

  bash "$FE_LIB_DIR/popup_input.sh" "$_outfile" "DELETE: (y/N) $_file"
  local _answer
  _answer=$(cat "$_outfile" 2>/dev/null | tr -d '\n')
  rm -f "$_outfile"

  # Accept y/Y, default N for empty/other
  case "$_answer" in
    [yY]) ;;
    *) return 0;;
  esac

  if rm -- "$_file"; then
    echo "✅ Deleted" >&2
    return 0
  else
    echo "❌ Delete failed (check permissions)" >&2
    return 1
  fi
}

build_fzf_args() {
  local prompt_str="$1"
  local border_label="$2"
  local header_text="$3"

  PREVIEW_CMD_SAFE="${PREVIEW_CMD//\'/\'\"\'\"\'}"
  local preview_script="$PREVIEW_CMD_SAFE '{}' 2>/dev/null || cat -n '{}' 2>/dev/null || echo '(preview not available)'"

  # Build key bindings
  if [[ -n "$TMUX_RIGHT_PANE" ]]; then
    local enter_cmd="accept"
  else
    local enter_cmd="execute($EDITOR_CMD '{1}')"
  fi

  # Use arrays for fzf args
  FZF_ARGS=(
    --multi
    --layout=reverse
    --margin=0,0
    --padding=0,0
    --prompt "$prompt_str"
    --preview "$preview_script"
    --preview-window="right:80%:wrap,border-left,<80(up:65%:wrap)"
    --style=full
    --highlight-line
    --track
    --filepath-word
    --info=inline-right
    --border-label="$border_label"
    --bind "enter:$enter_cmd"
    --bind "ctrl-d:execute($FE_FZF_HELPER fe_delete_selected '{1}')+reload($FE_SEARCH_CMD)"
    --bind "ctrl-r:execute($FE_FZF_HELPER fe_rename_selected '{1}')+reload($FE_SEARCH_CMD)"
    --bind "ctrl-g:execute(git -C '$TARGET_DIR' status -s 2>/dev/null || echo 'Not a git repo'; echo '---'; git -C '$TARGET_DIR' log --oneline -10 2>/dev/null || true)"
    --bind "ctrl-f:reload(rg --files-with-matches -i '{q}' '$TARGET_DIR' 2>/dev/null)"
    --bind "ctrl-y:execute-silent(printf '%s' '{1}' | termux-clipboard-set 2>/dev/null || printf '%s' '{1}' | xclip -sel clip 2>/dev/null || pbcopy 2>/dev/null || true)"
    --bind "ctrl-b:execute(printf '%s\n' '{1}' >> '$FE_BOOKMARKS' && echo '✅ Bookmarked: {1}')"
    --bind "ctrl-x:execute(
      _bm_tmp=\$(mktemp /tmp/fe-bm-XXXXX) || exit 1
      grep -vxF -- '{1}' '$FE_BOOKMARKS' > \"\$_bm_tmp\" 2>/dev/null
      mv -f -- \"\$_bm_tmp\" '$FE_BOOKMARKS'
      rm -f \"\$_bm_tmp\"
      echo '🗑️ Removed bookmark'
    )+reload($FE_SEARCH_CMD)"
    --bind "ctrl-o:execute-silent(
      _dir=\$(dirname '{1}')
      tmux send-keys -t $TMUX_RIGHT_PANE \"cd '\$_dir' && clear && ls -la\" C-m
    )"
    --bind "ctrl-p:toggle-preview"
    --bind "ctrl-s:change-preview-window(right:99%|right:80%:wrap,border-left,<80(up:65%:wrap))"
  )
  local _kb_bind="ctrl-h:execute(
    echo '==============================';
    echo '       FE — Keybinds        ';
    echo '==============================';
    echo '';
    echo ' Enter       : Open file';
    echo ' Tab         : Multi-select';
    echo ' Ctrl-d     : Delete file';
    echo ' Ctrl-r     : Rename file';
    echo ' Ctrl-g     : Git status / log';
    echo ' Ctrl-f     : Search content';
    echo ' Ctrl-y     : Copy file path';
    echo ' Ctrl-b     : Bookmark file';
    echo ' Ctrl-x     : Remove bookmark';
    echo ' Ctrl-o     : Open file location';
    echo ' Ctrl-p     : Toggle preview';
    echo ' Ctrl-s     : Toggle fullscreen';
    echo ' Ctrl-h     : Show this help';
    echo '';
    echo 'Tekan Enter untuk tutup...'; read -r dummy
  )"
  FZF_ARGS+=(--bind "$_kb_bind")
}
