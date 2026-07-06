#!/usr/bin/env bash
# ============================================================
# ui.sh — FZF Arguments and Keybindings Builder
# Letak: tools-cli/src/fe/ui.sh
# ============================================================

build_fzf_args() {
  local prompt_str="$1"
  local border_label="$2"
  local header_text="$3"

  PREVIEW_CMD_SAFE="${PREVIEW_CMD//\'/\'\"\'\"\'}"
  local preview_script="$PREVIEW_CMD_SAFE {} 2>/dev/null || cat -n {} 2>/dev/null || echo '(preview not available)'"

  # Build key bindings
  if [[ -n "$TMUX_RIGHT_PANE" ]]; then
    local enter_cmd="accept"
  else
    local enter_cmd="execute($EDITOR_CMD {1})"
  fi

  # Use arrays for fzf args
  FZF_ARGS=(
    --multi
    --layout=reverse
    --prompt "$prompt_str"
    --preview "$preview_script"
    --preview-window="right:60%:wrap,border-left,<80(up:50%:wrap)"
    --style=full
    --highlight-line
    --track
    --filepath-word
    --info=inline-right
    --border-label="$border_label"
    --header-first
    --header "$header_text"
    --bind "enter:$enter_cmd"
    --bind "ctrl-d:execute(rm -i {1})+reload($FE_SEARCH_CMD)"
    --bind "ctrl-r:execute-silent(echo '{1}' > /tmp/fe-rename-target)+change-prompt(✏️ Rename ❯ )+change-header(Rename: {1}  →  Ketik nama baru  Alt-Enter:confirm  Esc:batal)+clear-query"
    --bind "alt-enter:execute(
      _tgt=\$(cat /tmp/fe-rename-target 2>/dev/null | tr -d '\n')
      _name={q}
      rm -f /tmp/fe-rename-target
      [ -n \"\$_tgt\" ] && [ -n \"\$_name\" ] && mv \"\$_tgt\" \"\$(dirname \"\$_tgt\")/\$_name\"
    )+reload($FE_SEARCH_CMD)+change-prompt($prompt_str)+change-header($header_text)+clear-query"
    --bind "ctrl-g:execute(git -C '$TARGET_DIR' status -s 2>/dev/null || echo 'Not a git repo'; echo '---'; git -C '$TARGET_DIR' log --oneline -10 2>/dev/null || true)"
    --bind "ctrl-f:reload(rg --files-with-matches -i '{q}' '$TARGET_DIR' 2>/dev/null)"
    --bind "ctrl-y:execute-silent(echo -n {1} | termux-clipboard-set 2>/dev/null || echo -n {1} | xclip -sel clip 2>/dev/null || pbcopy 2>/dev/null || true)"
    --bind "ctrl-b:execute(echo '{1}' >> '$FE_BOOKMARKS' && echo '✅ Bookmarked: {1}')"
    --bind "ctrl-x:execute(sed -i '|^{}$|d' '$FE_BOOKMARKS' && echo '🗑️ Removed bookmark')+reload($FE_SEARCH_CMD)"
    --bind "ctrl-o:execute-silent(tmux send-keys -t $TMUX_RIGHT_PANE 'cd \"\$(dirname {1})\" && clear && ls -la' C-m)"
    --bind "ctrl-p:toggle-preview"
    --bind "ctrl-s:change-preview-window(right:99%|right:80%:wrap,border-left,<80(up:50%:wrap))"
  )
}
