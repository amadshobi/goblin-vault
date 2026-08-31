# ── Module: Preview Command Generator (v1.2) ───────────────
_zf_get_preview_cmd() {
    cat << 'EOF'
real_path=$(echo {} | sed "s|^~|$HOME|");
[ ! -d "$real_path" ] && { echo "📄 $real_path"; exit 0; }

# Section 1: Header - path + item count (instant, no disk traversal)
items=$(ls -1A "$real_path" 2>/dev/null | wc -l)
echo "📁 $(basename "$real_path")  ($items items)"
echo "────────────────────────────────────────"

# Section 2: Git status (if git repo)
git_root=$(cd "$real_path" && git rev-parse --git-dir 2>/dev/null)
if [ -n "$git_root" ]; then
  git_status=$(cd "$real_path" && timeout 0.5s git status --short 2>/dev/null | head -15)
  if [ -n "$git_status" ]; then
    echo "  Git Status:"
    echo "$git_status" | sed "s/^/    /"
    echo "────────────────────────────────────────"
  fi
fi

# Section 3: File tree
if command -v eza >/dev/null 2>&1; then
  eza --tree --level=2 --icons --color=always --ignore-glob="node_modules|.git|__pycache__|dist|build|.next" "$real_path" 2>/dev/null
else
  ls -1 "$real_path" 2>/dev/null | head -30
fi
EOF
}
