#!/usr/bin/env bash
# ============================================================
# check_syntax.sh — Goblin Fast Syntax Checker
# Letak: scripts/check_syntax.sh
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/tools-cli"

STAGED_ONLY=false
if [ "${1:-}" = "--staged" ] || [ "${1:-}" = "-s" ]; then
    STAGED_ONLY=true
fi

echo "😈 Goblin Syntax Checker starting... $( $STAGED_ONLY && echo '(Fast Staged Mode)' || echo '(Full Repo Scan)' )"
echo "────────────────────────────────────────"

errors=0

get_files_to_check() {
    local ext_pattern="$1"
    if $STAGED_ONLY; then
        git diff --cached --name-only 2>/dev/null | grep -E "\.(${ext_pattern})$" || true
    else
        find "$ROOT_DIR" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | grep -E "\.(${ext_pattern})$" || true
    fi
}

# 1. Check Bash/Shell files
echo "🐚 Checking Bash files..."
shell_files=$(get_files_to_check "sh|bash")
if [ -n "$shell_files" ]; then
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            if head -n 1 "$file" 2>/dev/null | grep -qE '^#!.*(bash|sh)'; then
                if ! bash -n "$file" 2>/dev/null; then
                    echo "❌ Bash syntax error: $file"
                    errors=$((errors + 1))
                else
                    echo "   ✅ $file"
                fi
            fi
        fi
    done <<< "$shell_files"
else
    echo "   ℹ️  No shell files to check."
fi

echo "────────────────────────────────────────"

# 1b. Check Go files
echo "🐹 Checking Go files..."
staged_go=$(get_files_to_check "go")
if [ -n "$staged_go" ]; then
    for dir in "$TOOLS_DIR"/src/*/; do
        mod_file="${dir}go.mod"
        if [[ -f "$mod_file" ]]; then
            tool_name=$(basename "$dir")
            if ! (cd "$dir" && go vet ./... 2>&1); then
                echo "❌ Go vet error: $tool_name"
                errors=$((errors + 1))
            else
                echo "   ✅ $tool_name (go vet passed)"
            fi
        fi
    done
else
    echo "   ℹ️  No Go files to check."
fi

echo "────────────────────────────────────────"

# 2. Check Javascript files
echo "📦 Checking JavaScript files..."
js_files=$(get_files_to_check "js")
if [ -n "$js_files" ]; then
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            if ! node --check "$file" &>/dev/null; then
                echo "❌ JS syntax error: $file"
                node --check "$file" || true
                errors=$((errors + 1))
            else
                echo "   ✅ $file"
            fi
        fi
    done <<< "$js_files"
else
    echo "   ℹ️  No JS files to check."
fi

echo "────────────────────────────────────────"

# 2b. Check TypeScript files
echo "🔷 Checking TypeScript files..."
ts_files=$(get_files_to_check "ts|tsx")
if [ -n "$ts_files" ]; then
    while IFS= read -r file; do
        if [[ -f "$file" ]]; then
            if command -v bun >/dev/null 2>&1; then
                if ! NODE_PATH="$HOME/.opencode/node_modules" bun build --target=bun --no-save "$file" &>/dev/null; then
                    echo "❌ TS syntax error: $file"
                    NODE_PATH="$HOME/.opencode/node_modules" bun build --target=bun --no-save "$file" || true
                    errors=$((errors + 1))
                else
                    echo "   ✅ $file"
                fi
            else
                echo "   ⚠️  Bun not installed, skipping TS check for $file"
            fi
        fi
    done <<< "$ts_files"
else
    echo "   ℹ️  No TS files to check."
fi

echo "────────────────────────────────────────"

if [[ $errors -eq 0 ]]; then
    echo "🎉 Hore BOSS! Semua syntax valid! 🍻"
    exit 0
else
    echo "❌ Waduh! Ditemukan $errors kesalahan syntax!"
    exit 1
fi
