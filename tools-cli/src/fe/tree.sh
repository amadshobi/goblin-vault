#!/usr/bin/env bash
# ============================================================
# tree.sh — Directory Tree Navigation Feature Module
# Letak: tools-cli/src/fe/tree.sh
# ============================================================

run_tree_mode() {
  # State: temp file untuk tracking current directory
  FE_TREE_FILE=$(mktemp /tmp/fe-tree-XXXXXX 2>/dev/null) || FE_TREE_FILE="/tmp/fe-tree-$$"
  echo "$TARGET_DIR" > "$FE_TREE_FILE"
  # State: temp file untuk tracking mode input (new_file / new_dir / "")
  FE_INPUT_MODE="${FE_TREE_FILE}.mode"
  export FE_INPUT_MODE FE_TREE_FILE
  CLEANUP_FILES+=("$FE_TREE_FILE" "$FE_INPUT_MODE")

  local tree_label=" 🌳 Tree: $(basename "$TARGET_DIR") "
  local tree_header="Enter:open/masuk  Esc/Ctrl-h:naik  Ctrl-n:file-baru  Ctrl-k:folder-baru  Ctrl-q:batal-input  Ctrl-p:preview  Ctrl-s:fullscreen"
  local tree_prompt="🌳 "

  # ── List tree helper ──
  list_tree() {
    local dir
    dir=$(cat "$FE_TREE_FILE") || return
    echo "📁 $dir"
    [[ "$dir" != "/" ]] && echo ".."
    ls -1Ap "$dir" 2>/dev/null
  }

  list_tree | fzf \
    --prompt "$tree_prompt" \
    --layout=reverse \
    --header-lines=1 \
    --preview "
      dir=\$(cat '$FE_TREE_FILE' 2>/dev/null) || exit 1
      fp=\$dir/'{}'
      if [ -d \"\$fp\" ]; then
        echo '📂 {}/'
        echo '──────────────────────────────'
        eza -1 --group-directories-first --icons=always --color=always \"\$fp\" 2>/dev/null | head -40
        echo '──────────────────────────────'
        echo '↑ Enter: masuk folder'
      elif [ -f \"\$fp\" ]; then
        echo '━━━ {} ━━━'
        $PREVIEW_CMD \"\$fp\" 2>/dev/null || cat -n \"\$fp\" 2>/dev/null
      fi
    " \
    --preview-window="right:60%:wrap,border-left,<80(up:50%:wrap)" \
    --style=full \
    --highlight-line \
    --filepath-word \
    --info=inline-right \
    --border-label="$tree_label" \
    --header-first \
    --header "$tree_header" \
    --bind "enter:execute(
      dir=\$(cat '$FE_TREE_FILE')
      fp=\$dir/'{}'
      if [ -f \"\$fp\" ]; then
        if [ -n \"\${TMUX_RIGHT_PANE:-}\" ]; then
          current_cmd=\$(tmux display-message -p -t \"\$TMUX_RIGHT_PANE\" '#{pane_current_command}' 2>/dev/null || echo \"\")
          case \"\$current_cmd\" in
            \"\"|bash|zsh|sh|fish|idle|clear|echo)
              tmux send-keys -t \"\$TMUX_RIGHT_PANE\" \"$EDITOR '\$fp'\" C-m
              tmux select-pane -t \"\$TMUX_RIGHT_PANE\"
              ;;
            *)
              tmux split-window -h \"$EDITOR '\$fp'\"
              ;;
          esac
        else
          $EDITOR_CMD \"\$fp\"
        fi
      fi
    )+reload(
      dir=\$(cat '$FE_TREE_FILE')
      fp=\$dir/'{}'
      if [ '{}' = '..' ]; then
        parent=\$(dirname \"\$dir\")
        echo \"\$parent\" > '$FE_TREE_FILE'
      elif [ -d \"\$fp\" ]; then
        echo \"\$fp\" > '$FE_TREE_FILE'
      fi
      dir=\$(cat '$FE_TREE_FILE')
      echo \"📁 \$dir\"
      [ \"\$dir\" != '/' ] && echo '..'
      ls -1Ap \"\$dir\" 2>/dev/null
    )" \
    --bind "ctrl-h:reload(
      dir=\$(cat '$FE_TREE_FILE')
      parent=\$(dirname \"\$dir\")
      echo \"\$parent\" > '$FE_TREE_FILE'
      echo \"📁 \$parent\"
      [ \"\$parent\" != '/' ] && echo '..'
      ls -1Ap \"\$parent\" 2>/dev/null
    )" \
    --bind "esc:reload(
      dir=\$(cat '$FE_TREE_FILE')
      parent=\$(dirname \"\$dir\")
      echo \"\$parent\" > '$FE_TREE_FILE'
      echo \"📁 \$parent\"
      [ \"\$parent\" != '/' ] && echo '..'
      ls -1Ap \"\$parent\" 2>/dev/null
    )+execute-silent(rm -f '$FE_INPUT_MODE')+change-prompt($tree_prompt)+change-header($tree_header)+clear-query" \
    --bind "ctrl-q:execute-silent(rm -f '$FE_INPUT_MODE')+change-prompt($tree_prompt)+change-header($tree_header)+clear-query" \
    --bind "ctrl-n:execute-silent(echo new_file > '$FE_INPUT_MODE')+change-prompt(📄 New file ❯ )+change-header(Ketik nama file  Alt-Enter:buat  Ctrl-q:batal)+clear-query" \
    --bind "ctrl-k:execute-silent(echo new_dir > '$FE_INPUT_MODE')+change-prompt(📁 New folder ❯ )+change-header(Ketik nama folder  Alt-Enter:buat  Ctrl-q:batal)+clear-query" \
    --bind "alt-enter:execute(
      _mode=\$(cat '$FE_INPUT_MODE' 2>/dev/null | tr -d '\\n')
      _name={q}
      dir=\$(cat '$FE_TREE_FILE')
      rm -f '$FE_INPUT_MODE'
      if [ \"\$_mode\" = 'new_file' ] && [ -n \"\$_name\" ]; then
        touch \"\$dir/\$_name\"
        if [ -n \"\${TMUX_RIGHT_PANE:-}\" ]; then
          current_cmd=\$(tmux display-message -p -t \"\$TMUX_RIGHT_PANE\" '#{pane_current_command}' 2>/dev/null || echo \"\")
          case \"\$current_cmd\" in
            \"\"|bash|zsh|sh|fish|idle|clear|echo)
              tmux send-keys -t \"\$TMUX_RIGHT_PANE\" \"$EDITOR '\$dir/\$_name'\" C-m
              tmux select-pane -t \"\$TMUX_RIGHT_PANE\"
              ;;
            *)
              tmux split-window -h \"$EDITOR '\$dir/\$_name'\"
              ;;
          esac
        else
          $EDITOR_CMD \"\$dir/\$_name\"
        fi
      elif [ \"\$_mode\" = 'new_dir' ] && [ -n \"\$_name\" ]; then
        mkdir -p \"\$dir/\$_name\"
      fi
    )+reload(
      dir=\$(cat '$FE_TREE_FILE')
      echo \"📁 \$dir\"
      [ \"\$dir\" != '/' ] && echo '..'
      ls -1Ap \"\$dir\" 2>/dev/null
    )+change-prompt($tree_prompt)+change-header($tree_header)+clear-query" \
    --bind "ctrl-p:toggle-preview" \
    --bind "ctrl-s:change-preview-window(right:99%|right:60%:wrap,border-left,<80(up:50%:wrap))"
}
