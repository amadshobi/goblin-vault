#!/usr/bin/env bash
# ============================================================
# doctor.sh — Dependency & Health Checker
# Letak: scripts/doctor.sh
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

echo -e "${BLUE}🩺 Goblin Health & Dependency Checker${NC}"
echo "────────────────────────────────────────"

errors=0
warnings=0

# Helper to check commands
check_command() {
    local cmd=$1
    local desc=$2
    local required=$3 # true or false
    
    if command -v "$cmd" &>/dev/null; then
        local version=""
        if [[ "$cmd" == "node" ]]; then
            version=$(node -v)
        elif [[ "$cmd" == "fzf" ]]; then
            version=$(fzf --version | awk '{print $1}')
        elif [[ "$cmd" == "tmux" ]]; then
            version=$(tmux -V)
        elif [[ "$cmd" == "gh" ]]; then
            version=$(gh --version | head -n 1 | awk '{print $3}')
        fi
        echo -e "  [${GREEN}OK${NC}] $cmd ($desc) ${GREEN}${version}${NC}"
    else
        if [[ "$required" == "true" ]]; then
            echo -e "  [${RED}ERR${NC}] $cmd ($desc) -> ${RED}BELUM TERINSTALL!${NC} (Wajib)"
            errors=$((errors + 1))
        else
            echo -e "  [${YELLOW}WARN${NC}] $cmd ($desc) -> ${YELLOW}Tidak Ditemukan!${NC} (Opsional)"
            warnings=$((warnings + 1))
        fi
    fi
}

echo "📦 Mengecek Aplikasi & Binary Sistem..."
check_command "node" "Node.js runtime untuk TUI ocm" "true"
check_command "fzf" "Command-line fuzzy finder untuk fe" "true"
check_command "tmux" "Terminal multiplexer untuk fe split mode" "true"
check_command "gh" "GitHub CLI untuk gh-blin" "false"

echo "────────────────────────────────────────"
echo "⚙️ Mengecek Integrasi Shell & PATH..."

# Check PATH
if [[ ":$PATH:" == *":$TOOLS_BIN:"* ]]; then
    echo -e "  [${GREEN}OK${NC}] \$PATH mengandung: $TOOLS_BIN"
else
    echo -e "  [${YELLOW}WARN${NC}] $TOOLS_BIN tidak terdaftar di \$PATH"
    warnings=$((warnings + 1))
fi

# Check global fe.sh function (Replaced with binary existence checks)
check_binary() {
    local bin_path="$TOOLS_BIN/$1"
    if [[ -f "$bin_path" ]]; then
        if [[ -x "$bin_path" ]]; then
            echo -e "  [${GREEN}OK${NC}] Binary $1 ditemukan dan executable"
        else
            echo -e "  [${RED}ERR${NC}] Binary $1 ditemukan tapi TIDAK executable!"
            errors=$((errors + 1))
        fi
    else
        echo -e "  [${RED}ERR${NC}] Binary $1 tidak ditemukan di $TOOLS_BIN!"
        errors=$((errors + 1))
    fi
}

check_binary "fe"
check_binary "ocm"
check_binary "gh-blin"

echo "────────────────────────────────────────"

# Summary
if [[ $errors -eq 0 ]]; then
    if [[ $warnings -eq 0 ]]; then
        echo -e "${GREEN}🎉 STATUS SEHAT WAL'AFIAT! Semua system siap tempur!${NC}"
    else
        echo -e "${YELLOW}⚠️ Ditemukan $warnings Peringatan (Warning) tapi aman untuk digunakan.${NC}"
        echo "💡 Coba jalankan scripts/install.sh untuk setup otomatis."
    fi
    exit 0
else
    echo -e "${RED}❌ STATUS KRITIS! Ada $errors dependensi wajib yang kurang.${NC}"
    exit 1
fi
