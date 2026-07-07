#!/usr/bin/env bash
# ============================================================
# install.sh — Goblin Vault Installer & Path Setup
# Letak: scripts/install.sh
# ============================================================
set -euo pipefail

# ANSI color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_BIN="$ROOT_DIR/tools-cli/bin"
ZSHRC="$HOME/.zshrc"
BASHRC="$HOME/.bashrc"

echo -e "${BLUE}🏗️ Goblin Vault Installer & Integrator${NC}"
echo "────────────────────────────────────────"

echo "📂 Lokasi tools bin: $TOOLS_BIN"

add_to_rc() {
    local rc_file=$1
    local name=$2
    
    if [[ -f "$rc_file" ]]; then
        # Cek apakah PATH tools-cli/bin sudah ada di config
        if grep -q "tools-cli/bin" "$rc_file" 2>/dev/null; then
            echo -e "  [${GREEN}OK${NC}] \$PATH tools-cli/bin sudah terdaftar di $name"
        else
            echo -e "  [${YELLOW}ADD${NC}] Menambahkan tools-cli/bin ke \$PATH di $name..."
            echo -e "\n# Added by Goblin Vault Installer" >> "$rc_file"
            echo "export PATH=\"\$PATH:$TOOLS_BIN\"" >> "$rc_file"
            echo -e "  [${GREEN}SUCCESS${NC}] Selesai ditambahkan ke $name!"
        fi
    else
        echo -e "  [${BLUE}SKIP${NC}] $name tidak ditemukan ($rc_file)"
    fi
}

# 1. Update PATH di RC files
add_to_rc "$ZSHRC" "Zsh Config (~/.zshrc)"
add_to_rc "$BASHRC" "Bash Config (~/.bashrc)"

echo "────────────────────────────────────────"

# 2. Check Node packages for tools-cli/src
echo "📦 Memvalidasi dependensi Node global..."
if [[ -d "$HOME/.opencode/node_modules" ]]; then
    echo -e "  [${GREEN}OK${NC}] global node_modules ditemukan di ~/.opencode"
else
    echo -e "  [${YELLOW}WARN${NC}] ~/.opencode/node_modules tidak ditemukan!"
    echo "         Untuk menjalankan 'ocm' dan 'gh-blin', dibutuhkan packages seperti @clack/prompts."
    echo "         Jalankan 'ocm doctor' jika ada error dependensi."
fi

echo "────────────────────────────────────────"

# 3. Build fex (Go binary)
echo "🐹 Building fex (Go file explorer)..."
FEX_SRC="$ROOT_DIR/tools-cli/src/fex"
if command -v go &>/dev/null; then
    cd "$FEX_SRC" && go build -o "$HOME/.local/bin/fex" ./cmd/fe/ 2>&1 && \
        echo -e "  [${GREEN}OK${NC}] fex built & installed to ~/.local/bin/fex" || \
        echo -e "  [${RED}ERR${NC}] fex build gagal!"
else
    echo -e "  [${YELLOW}WARN${NC}] Go tidak ditemukan — fex tidak bisa di-build."
    echo "         Install Go dulu: https://go.dev/dl/"
fi

echo "────────────────────────────────────────"
echo -e "${GREEN}🎉 Proses integrasi selesai!${NC}"
echo -e "💡 Silakan jalankan perintah berikut untuk memuat ulang terminal Anda:"
echo -e "   ${BLUE}source ~/.zshrc${NC} (jika menggunakan Zsh)"
echo -e "   atau"
echo -e "   ${BLUE}source ~/.bashrc${NC} (jika menggunakan Bash)"
echo "────────────────────────────────────────"
