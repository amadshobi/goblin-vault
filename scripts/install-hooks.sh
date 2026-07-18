#!/usr/bin/env bash
# install-hooks.sh — Goblin Vault
# Symlink git hooks dari .github/hooks/ ke .git/hooks/ agar auto-enforce.
# Idiot-proof: cek git repo, skip kalau sudah ter-install.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT:-}" ]]; then
  echo "❌ Bukan di dalam git repo. Jalankan dari root goblin-vault." >&2
  exit 1
fi

SRC="$REPO_ROOT/.github/hooks"
DEST="$REPO_ROOT/.git/hooks"

if [[ ! -d "$SRC" ]]; then
  echo "❌ $SRC tidak ditemukan." >&2
  exit 1
fi

shopt -s nullglob
hooks=("$SRC"/*)
shopt -u nullglob

if [[ ${#hooks[@]} -eq 0 ]]; then
  echo "⚠️  Tidak ada hook di $SRC." >&2
  exit 0
fi

for hook in "${hooks[@]}"; do
  name="$(basename "$hook")"
  target="$DEST/$name"
  # backup kalau ada hook lama (bukan symlink kita)
  if [[ -e "$target" && ! -L "$target" ]]; then
    cp "$target" "$target.goblin-bak.$(date +%s)"
    echo "📦 backup hook lama: $target.goblin-bak.*"
  fi
  ln -sf "$hook" "$target"
  chmod +x "$hook"
  echo "🔗 installed: $name"
done

echo "✅ Git hooks ter-install. Jalankan 'git commit' untuk ngerasain."
