#!/usr/bin/env bash
# ============================================================
# search.sh — Text Search Mode Feature Module
# Letak: tools-cli/src/fe/search.sh
# ============================================================

# ── Helper: Prompt for Search Query ──
fe_prompt_search_query() {
  local _outfile
  _outfile="$(mktemp /tmp/fe-search-XXXXX)" || { echo "No search query."; exit 0; }
  bash "$FE_LIB_DIR/popup_input.sh" "$_outfile" "Search files by content"
  local _query
  _query=$(cat "$_outfile" 2>/dev/null | tr -d '\n')
  rm -f "$_outfile"
  if [[ -z "$_query" ]]; then
    echo "No search query." >&2
    return 1
  fi
  printf '%s' "$_query"
}

run_search_mode() {
  if [[ -z "$SEARCH_QUERY" ]]; then
    SEARCH_QUERY=$(fe_prompt_search_query)
  fi

  # cd into target dir so file paths show as ./... instead of /root/...
  cd "$TARGET_DIR"

  # Safe command: printf '%q' escapes shell metacharacters in the query
  local _safe_query
  _safe_query=$(printf '%q' "$SEARCH_QUERY")
  FE_SEARCH_CMD="rg --files-with-matches -i $_safe_query . 2>/dev/null"

  build_fzf_args " 🔍 ❯ " " Search: $SEARCH_QUERY " "Enter:open  Tab:multi  Ctrl-f:search  Bookmark  Del  CopyPath  Preview  Full  Ctrl-h:help"

  SELECTED=$(eval "$FE_SEARCH_CMD" | fzf "${FZF_ARGS[@]}")

  if [[ -n "$SELECTED" ]]; then
    local first_file
    first_file=$(echo "$SELECTED" | head -1)
    open_file "$first_file"
  fi
}
