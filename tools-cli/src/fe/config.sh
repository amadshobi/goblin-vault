#!/usr/bin/env bash
# ============================================================
# config.sh — Bootstrap and Tool Detection
# Letak: tools-cli/src/fe/config.sh
# ============================================================

# Setup config folders
FE_BOOKMARKS="${FE_BOOKMARKS:-$HOME/.cache/fe-bookmarks}"
FE_CONFIG_HOME="${FE_CONFIG_HOME:-$HOME/.config/fe}"
FIND_DEPTH=5
FIND_FILTER='-not -path "*/.npm/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/vendor/*" -not -path "*/target/debug/*" -not -path "*/dist/*"'

# Ensure folders exist
mkdir -p "$(dirname "$FE_BOOKMARKS")" "$FE_CONFIG_HOME"
touch "$FE_BOOKMARKS"

# 1. Preview command chain
PREVIEW_CMD=""
for cmd in "batcat --style=numbers --color=always" \
           "bat --style=numbers --color=always" \
           "cat -n"; do
  if command -v "${cmd%% *}" &>/dev/null; then
    PREVIEW_CMD="$cmd"
    break
  fi
done

# 2. Find command
USE_FD=false
if command -v fd &>/dev/null; then
  USE_FD=true
fi

# 3. Editor chain
EDITOR="micro"
for cmd in micro nano vim vi; do
  if command -v "$cmd" &>/dev/null; then
    EDITOR="$cmd"
    break
  fi
done
[[ -z "$EDITOR" ]] && EDITOR="cat"

# 4. Editor wrapper for PTY under proot
EDITOR_CMD="$EDITOR"
FE_EDITOR_WRAPPER=""
if command -v script &>/dev/null && [[ "$(tty)" == "not a tty" ]]; then
  FE_EDITOR_WRAPPER=$(mktemp /tmp/fe-editor-XXXXXX.sh 2>/dev/null)
  cat > "$FE_EDITOR_WRAPPER" <<- WRAPEOF
	#!/usr/bin/env bash
	editor="\$1"
	file="\$2"
	if command -v script &>/dev/null && [[ "\$(tty)" == "not a tty" ]]; then
	  script -q -c "\$editor '\$file'" /dev/null
	else
	  \$editor "\$file"
	fi
	WRAPEOF
  chmod +x "$FE_EDITOR_WRAPPER"
  CLEANUP_FILES+=("$FE_EDITOR_WRAPPER")
  EDITOR_CMD="$FE_EDITOR_WRAPPER $EDITOR"
fi

editor_open() {
  local file="$1"
  [[ -z "$file" ]] && return
  if [[ -n "$FE_EDITOR_WRAPPER" ]]; then
    "$FE_EDITOR_WRAPPER" "$EDITOR" "$file"
  else
    $EDITOR "$file"
  fi
}

get_preview_size() {
  local lines
  lines=$(tput lines 2>/dev/null || echo 40)
  if   [[ $lines -lt 25 ]]; then echo 'up:55%'
  elif [[ $lines -lt 35 ]]; then echo 'up:65%'
  elif [[ $lines -lt 50 ]]; then echo 'up:70%'
  else                            echo 'up:75%'
  fi
}
PREVIEW_SIZE=$(get_preview_size)
