#!/usr/bin/env bash
# ============================================================
# bookmarks.sh — Bookmark Mode Feature Module
# Letak: tools-cli/src/fe/bookmarks.sh
# ============================================================

run_bookmarks_mode() {
  if [[ ! -s "$FE_BOOKMARKS" ]]; then
    echo "📭 No bookmarks yet. Use Ctrl-b in fe to bookmark files."
    exit 0
  fi

  FE_SEARCH_CMD="sort -u '$FE_BOOKMARKS'"
  build_fzf_args " 🔍 ❯ " " Bookmarks " "Enter:open  Tab:multi  Ctrl-x:remove  Ctrl-b:bookmark  Del  CopyPath  Preview  Full  Ctrl-h:help"

  SELECTED=$(eval "$FE_SEARCH_CMD" | fzf "${FZF_ARGS[@]}")

  if [[ -n "$SELECTED" ]]; then
    local first_file
    first_file=$(echo "$SELECTED" | head -1)
    open_file "$first_file"
  fi
}
