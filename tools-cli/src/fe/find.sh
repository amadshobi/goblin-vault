#!/usr/bin/env bash
# ============================================================
# find.sh — File Finder Mode Feature Module
# Letak: tools-cli/src/fe/find.sh
# ============================================================

run_find_mode() {
  PROMPT_STR=" 🔍 ❯ "
  HEADER_STR="Enter:open  Tab:multi-select  Ctrl-d:del  Ctrl-r:rename  Ctrl-b:bookmark  Ctrl-x:unbookmark  Ctrl-f:search  Ctrl-g:git  Ctrl-y:copy-path  Ctrl-o:cd-here  Ctrl-p:preview  Ctrl-s:fullscreen"

  # cd into target dir so file paths show as ./... instead of /root/...
  cd "$TARGET_DIR"

  if [[ "$USE_FD" == true ]]; then
    # fd — much faster
    local ext_flag=""
    if [[ -n "$EXT_FILTER" ]]; then
      if [[ "$EXT_FILTER" == .* ]]; then
        ext_flag="--extension ${EXT_FILTER#.}"
      else
        ext_flag="--glob '*${EXT_FILTER}*'"
      fi
    fi

    FE_SEARCH_CMD="fd --type f --hidden --no-ignore-vcs --max-depth $FIND_DEPTH --exclude node_modules --exclude .git --exclude __pycache__ --exclude vendor --exclude target/debug --exclude dist $ext_flag ."
  else
    # find fallback
    local extra_find=""
    if [[ -n "$EXT_FILTER" ]]; then
      if [[ "$EXT_FILTER" == .* ]]; then
        extra_find="-name '*$EXT_FILTER'"
      else
        extra_find="-name '*$EXT_FILTER*'"
      fi
    fi

    FE_SEARCH_CMD="find . -maxdepth $FIND_DEPTH -type f $extra_find $FIND_FILTER"
  fi

  build_fzf_args "$PROMPT_STR" " $(basename "$TARGET_DIR")${EXT_FILTER:+ ($EXT_FILTER)} " "$HEADER_STR"
  SELECTED=$(eval "$FE_SEARCH_CMD" 2>/dev/null | fzf "${FZF_ARGS[@]}")

  if [[ -n "$SELECTED" ]]; then
    local first_file
    first_file=$(echo "$SELECTED" | head -1)
    open_file "$first_file"
  fi
}
