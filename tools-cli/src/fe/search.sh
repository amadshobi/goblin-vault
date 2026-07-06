#!/usr/bin/env bash
# ============================================================
# search.sh — Text Search Mode Feature Module
# Letak: tools-cli/src/fe/search.sh
# ============================================================

run_search_mode() {
  if [[ -z "$SEARCH_QUERY" ]]; then
    read -r -p "Search for: " SEARCH_QUERY
    if [[ -z "$SEARCH_QUERY" ]]; then
      echo "No search query."
      exit 0
    fi
  fi

  # cd into target dir so file paths show as ./... instead of /root/...
  cd "$TARGET_DIR"
  FE_SEARCH_CMD="rg --files-with-matches -i '$SEARCH_QUERY' . 2>/dev/null"
  build_fzf_args " 🔍 ❯ " " Search: $SEARCH_QUERY " "Enter:open  Tab:multi-select  Ctrl-f:refine-search  Ctrl-b:bookmark  Ctrl-d:del  Ctrl-y:copy-path  Ctrl-p:preview  Ctrl-s:fullscreen"

  SELECTED=$(eval "$FE_SEARCH_CMD" | fzf "${FZF_ARGS[@]}")

  if [[ -n "$SELECTED" ]]; then
    local first_file
    first_file=$(echo "$SELECTED" | head -1)
    open_file "$first_file"
  fi
}
