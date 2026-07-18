#!/usr/bin/env bash
# install-hooks.sh — Goblin Vault
# Symlink git hooks dari .github/hooks/ ke .git/hooks/ agar auto-enforce.
# Pakai relative symlink biar aman di git worktree / repo yang dipindah.
# Idiot-proof: cek git repo, backup hook lama, deteksi core.hooksPath override.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT:-}" ]]; then
  echo "❌ Bukan di dalam git repo. Jalankan dari root goblin-vault." >&2
  exit 1
fi

# Deteksi kalau user override core.hooksPath — symlink ke .git/hooks gak akan jalan
HOOKS_PATH_OVERRIDE="$(git config --get core.hooksPath 2>/dev/null || true)"
if [[ -n "$HOOKS_PATH_OVERRIDE" ]]; then
  echo "⚠️  git config core.hooksPath = '$HOOKS_PATH_OVERRIDE' terdeteksi." >&2
  echo "⚠️  Hook di .git/hooks/ TIDAK akan aktif. Set ke kosong dengan:" >&2
  echo "      git config --unset core.hooksPath" >&2
  echo "    atau pindahkan hook ke: $HOOKS_PATH_OVERRIDE" >&2
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
  # relative symlink dari .git/hooks/ -> ../../.github/hooks/<name>
  ln -sf "../../.github/hooks/$name" "$target"
  echo "🔗 installed: $name (relative symlink)"
done

echo "✅ Git hooks ter-install. Jalankan 'git commit' untuk ngerasain."
