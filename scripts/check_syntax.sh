#!/usr/bin/env bash
# ============================================================
# check_syntax.sh — Goblin Syntax Checker
# Letak: scripts/check_syntax.sh
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/tools-cli"

echo "😈 Goblin Syntax Checker starting..."
echo "────────────────────────────────────────"

errors=0

# 1. Check Bash/Shell files
echo "🐚 Checking Bash files..."
while IFS= read -r file; do
    if [[ -f "$file" ]]; then
        # Cek shebang
        if head -n 1 "$file" | grep -qE '^#!.*(bash|sh)'; then
            if ! bash -n "$file"; then
                echo "❌ Bash syntax error: $file"
                errors=$((errors + 1))
            else
                echo "   ✅ $file"
            fi
        fi
    fi
done < <(find "$TOOLS_DIR" -type f 2>/dev/null)

echo "────────────────────────────────────────"

# 2. Check Javascript files
echo "📦 Checking JavaScript files..."
while IFS= read -r file; do
    if [[ -f "$file" ]]; then
        if ! node --check "$file" &>/dev/null; then
            echo "❌ JS syntax error: $file"
            # Jalankan ulang tanpa redirect untuk memperlihatkan letak error-nya
            node --check "$file" || true
            errors=$((errors + 1))
        else
            echo "   ✅ $file"
        fi
    fi
done < <(find "$TOOLS_DIR" -type f -name "*.js" 2>/dev/null)

echo "────────────────────────────────────────"

if [[ $errors -eq 0 ]]; then
    echo "🎉 Hore BOSS! Semua syntax Bash & JS aman dan valid! 🍻"
    exit 0
else
    echo "❌ Waduh! Ditemukan $errors kesalahan syntax!"
    exit 1
fi
