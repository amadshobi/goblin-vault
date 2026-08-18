#!/usr/bin/env bash
# ==============================================================================
# 🏗️ Goblin Vault — Modern All-in-One CLI & Arsenal Installer
# File: scripts/install.sh
# ==============================================================================
set -euo pipefail

# ── Color Palettes & Styles ──────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
MAGENTA='\033[35m'
CYAN='\033[36m'
WHITE='\033[37m'
GRAY='\033[90m'

# ── Remote Bootstrap Check (curl -fsSL ... | bash) ──────────────────────────
DEFAULT_REPO_DIR="${CIVIL_HOME:-$HOME/civil/goblin-vault}"
SCRIPT_PARENT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." 2>/dev/null && pwd || true)"

if [[ ! -f "${BASH_SOURCE[0]:-}" ]] || [[ ! -d "$SCRIPT_PARENT/tools-cli" ]]; then
    echo -e "\n${BOLD}${CYAN}🌐 Mengunduh & Menyiapkan Goblin Vault dari GitHub...${RESET}"
    if [[ ! -d "$DEFAULT_REPO_DIR/.git" ]]; then
        mkdir -p "$(dirname "$DEFAULT_REPO_DIR")"
        echo -e "  ${YELLOW}📦 Meng-clone repositori ke ${DEFAULT_REPO_DIR}...${RESET}"
        git clone https://github.com/amadshobi/goblin-vault.git "$DEFAULT_REPO_DIR"
    else
        echo -e "  ${GREEN}✔${RESET} Repositori ditemukan di ${DEFAULT_REPO_DIR}, menyinkronkan data..."
        (cd "$DEFAULT_REPO_DIR" && git pull --ff-only origin dev 2>/dev/null || git pull --ff-only origin main 2>/dev/null || true)
    fi
    echo -e "  ${GREEN}✔${RESET} Memulai instalasi suite...\n"
    exec bash "$DEFAULT_REPO_DIR/scripts/install.sh" "$@"
fi

ROOT_DIR="$SCRIPT_PARENT"
TOOLS_BIN="$ROOT_DIR/tools-cli/bin"
LOCAL_BIN="$HOME/.local/bin"
ZSHRC="$HOME/.zshrc"
BASHRC="$HOME/.bashrc"
AUTO_YES=false
TARGET="all"

# ── Parse CLI Arguments ──────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        -y|--yes)
            AUTO_YES=true
            ;;
        -h|--help)
            echo -e "${BOLD}${CYAN}GOBLIN VAULT INSTALLER${RESET}"
            echo -e "Usage: ./scripts/install.sh [target] [options]\n"
            echo -e "Targets:"
            echo -e "  ${YELLOW}all${RESET}      Install all 5 tools, deploy configs, and check lego ecosystem (Default)"
            echo -e "  ${YELLOW}fex${RESET}      Build Go file explorer binary & deploy fex config"
            echo -e "  ${YELLOW}gn${RESET}       Install Bun dependencies & link Goblin Nexus CLI"
            echo -e "  ${YELLOW}gb${RESET}       Install dependencies & build GitHub Assistant TUI"
            echo -e "  ${YELLOW}sup${RESET}      Install dependencies & link Universal Package Updater"
            echo -e "  ${YELLOW}zf${RESET}       Link ZF Rapid Navigation Engine"
            echo -e "  ${YELLOW}config${RESET}   Deploy micro and fex configs to ~/.config/"
            echo -e "  ${YELLOW}lego${RESET}     Scan & interactively install optional Lego power-up tools\n"
            echo -e "Options:"
            echo -e "  ${YELLOW}-y, --yes${RESET}    Non-interactive mode (auto accept or skip prompts)"
            echo -e "  ${YELLOW}-h, --help${RESET}   Show this help manual"
            exit 0
            ;;
        fex|gn|gb|sup|zf|config|lego|all)
            TARGET="$arg"
            ;;
        *)
            echo -e "${RED}❌ Unknown option / target: $arg${RESET}"
            echo -e "Jalankan ${YELLOW}./scripts/install.sh --help${RESET} untuk daftar perintah."
            exit 1
            ;;
    esac
done

# ── Dynamic Braille Spinner Engine ───────────────────────────────────────────
SPINNER_PID=""
SPINNER_LOG_FILES=()

cleanup_spinner() {
    if [[ -n "$SPINNER_PID" ]] && kill -0 "$SPINNER_PID" 2>/dev/null; then
        kill "$SPINNER_PID" 2>/dev/null || true
        wait "$SPINNER_PID" 2>/dev/null || true
    fi
    tput cnorm 2>/dev/null || true
    for f in "${SPINNER_LOG_FILES[@]:-}"; do
        rm -f "$f" 2>/dev/null || true
    done
}
trap cleanup_spinner EXIT INT TERM

get_timestamp() {
    local raw
    raw=$(date +%s%N 2>/dev/null || true)
    if [[ "$raw" =~ ^[0-9]+$ ]]; then
        echo "$raw"
    else
        date +%s
    fi
}

run_with_spinner() {
    local title="$1"
    shift
    local cmd=("$@")
    local log_file
    log_file=$(mktemp "/tmp/goblin-install-XXXXXX.log")
    SPINNER_LOG_FILES+=("$log_file")

    local spin_chars=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local start_time
    start_time=$(get_timestamp)

    tput civis 2>/dev/null || true

    # Execute in background
    "${cmd[@]}" > "$log_file" 2>&1 &
    local task_pid=$!

    # Animate spinner while waiting
    local i=0
    while kill -0 "$task_pid" 2>/dev/null; do
        local frame="${spin_chars[i % ${#spin_chars[@]}]}"
        printf "\r  ${CYAN}%s${RESET} %s" "$frame" "$title"
        i=$((i + 1))
        sleep 0.08
    done

    # Disable set -e for wait to capture non-zero exit code cleanly
    set +e
    wait "$task_pid"
    local exit_code=$?
    set -e

    local end_time
    end_time=$(get_timestamp)
    tput cnorm 2>/dev/null || true

    # Calculate duration
    local duration="0s"
    if [[ ${#start_time} -gt 10 && ${#end_time} -gt 10 ]]; then
        local nanos=$((end_time - start_time))
        local millis=$((nanos / 1000000))
        if (( millis < 1000 )); then
            duration="${millis}ms"
        else
            duration="$((millis / 1000)).$(( (millis % 1000) / 100 ))s"
        fi
    elif [[ "$start_time" =~ ^[0-9]+$ && "$end_time" =~ ^[0-9]+$ ]]; then
        duration="$((end_time - start_time))s"
    fi

    if [[ $exit_code -eq 0 ]]; then
        printf "\r  ${GREEN}✔${RESET} %s ${GRAY}(%s)${RESET}\n" "$title" "$duration"
        rm -f "$log_file" 2>/dev/null || true
        return 0
    else
        printf "\r  ${RED}✖${RESET} %s ${RED}[FAILED]${RESET}\n" "$title"
        echo -e "${RED}┌─ 💥 GOBLIN ROAST ERROR LOG ─────────────────────────────────────────┐${RESET}"
        tail -n 8 "$log_file" | sed 's/^/│ /'
        echo -e "${RED}└─────────────────────────────────────────────────────────────────────┘${RESET}"
        rm -f "$log_file" 2>/dev/null || true
        return $exit_code
    fi
}

# ── Package Manager Detector ─────────────────────────────────────────────────
detect_pkg_manager() {
    if command -v apt-get &>/dev/null; then
        echo "apt"
    elif command -v pacman &>/dev/null; then
        echo "pacman"
    elif command -v dnf &>/dev/null; then
        echo "dnf"
    elif command -v brew &>/dev/null; then
        echo "brew"
    else
        echo "unknown"
    fi
}

# ── Step 1: Configure PATH in Shell RC ────────────────────────────────────────
setup_path() {
    local rc_file="$1"
    local name="$2"
    if [[ -f "$rc_file" ]]; then
        if grep -qF 'Goblin Vault Installer' "$rc_file" 2>/dev/null || (grep -qF "$TOOLS_BIN" "$rc_file" 2>/dev/null && grep -qF "$LOCAL_BIN" "$rc_file" 2>/dev/null); then
            return 0
        else
            echo -e "\n# Added by Goblin Vault Installer" >> "$rc_file"
            echo "export PATH=\"\$HOME/.local/bin:\$PATH:$TOOLS_BIN\"" >> "$rc_file"
        fi
    fi
}

# ── Step 2: Install Node/Bun Dependencies ────────────────────────────────────
install_tool_deps() {
    local tool="$1"
    local dir="$ROOT_DIR/tools-cli/src/$tool"
    if [[ -d "$dir" && -f "$dir/package.json" ]]; then
        if command -v bun &>/dev/null; then
            (cd "$dir" && bun install --silent)
        elif command -v npm &>/dev/null; then
            (cd "$dir" && npm install --silent)
        else
            return 1
        fi
    fi
}

# ── Step 3: Build Go Binary (fex) ────────────────────────────────────────────
build_fex() {
    local fex_src="$ROOT_DIR/tools-cli/src/fex"
    if command -v go &>/dev/null; then
        mkdir -p "$TOOLS_BIN" "$LOCAL_BIN"
        (cd "$fex_src" && go build -o "$TOOLS_BIN/fex" ./cmd/fex/)
        chmod +x "$TOOLS_BIN/fex"
    else
        return 1
    fi
}

# ── Step 4: Universal Symlinking ─────────────────────────────────────────────
link_binaries() {
    mkdir -p "$LOCAL_BIN" "$TOOLS_BIN"
    local tools=("fex" "gn" "gb" "sup" "zf")
    for t in "${tools[@]}"; do
        if [[ -f "$TOOLS_BIN/$t" ]]; then
            chmod +x "$TOOLS_BIN/$t" 2>/dev/null || true
            ln -sf "$TOOLS_BIN/$t" "$LOCAL_BIN/$t"
        fi
    done
}

# ── Step 5: Deploy Configs ───────────────────────────────────────────────────
deploy_configs() {
    local micro_vault="$ROOT_DIR/configs/micro"
    local micro_config="$HOME/.config/micro"
    local fex_vault="$ROOT_DIR/configs/fex"
    local fex_config="$HOME/.config/fex"

    # Deploy Micro
    if [[ -d "$micro_vault" ]]; then
        mkdir -p "$micro_config/colorschemes" "$micro_config/plug/filemanager"
        for f in settings.json bindings.json init.lua palettero.cfg goblin-help.md; do
            [[ -f "$micro_vault/$f" ]] && ln -sf "$micro_vault/$f" "$micro_config/$f"
        done
        for cs in "$micro_vault/colorschemes/"*; do
            [[ -f "$cs" ]] && ln -sf "$cs" "$micro_config/colorschemes/$(basename "$cs")"
        done
        for pl in "$micro_vault/plug/filemanager/"*; do
            [[ -f "$pl" ]] && ln -sf "$pl" "$micro_config/plug/filemanager/$(basename "$pl")"
        done
    fi

    # Deploy FEX Master Config
    if [[ -d "$fex_vault" ]]; then
        mkdir -p "$fex_config"
        if [[ ! -f "$fex_config/config.yaml" && -f "$fex_vault/config.yaml" ]]; then
            cp "$fex_vault/config.yaml" "$fex_config/config.yaml"
        fi
    fi

    # Deploy Neovim Config
    local nvim_vault="$ROOT_DIR/configs/nvim"
    local nvim_config="$HOME/.config/nvim"
    if [[ -d "$nvim_vault" ]]; then
        mkdir -p "$nvim_config"
        if [[ ! -f "$nvim_config/init.lua" ]]; then
            # Direct link/copy if clean
            cp -r "$nvim_vault/"* "$nvim_config/" 2>/dev/null || true
        fi
    fi
}

# ── Step 6: Interactive Lego Power-Up Installer ──────────────────────────────
check_and_prompt_lego() {
    local pm
    pm=$(detect_pkg_manager)

    # 1. Special aliases for Ubuntu / Debian: batcat -> bat & fdfind -> fd
    if ! command -v bat &>/dev/null && command -v batcat &>/dev/null; then
        ln -sf "$(command -v batcat)" "$LOCAL_BIN/bat" 2>/dev/null || true
    fi
    if ! command -v fd &>/dev/null && command -v fdfind &>/dev/null; then
        ln -sf "$(command -v fdfind)" "$LOCAL_BIN/fd" 2>/dev/null || true
    fi

    local lego_list=(
        "lazygit:lazygit:Full Git Manager TUI di fex (Ctrl-g di folder):sudo apt install -y lazygit:brew install lazygit:sudo pacman -S --noconfirm lazygit:sudo dnf install -y lazygit"
        "rg:ripgrep:Live Streaming Ripgrep Search di fex (Ctrl-f):sudo apt install -y ripgrep:brew install ripgrep:sudo pacman -S --noconfirm ripgrep:sudo dnf install -y ripgrep"
        "bat:bat:Syntax Highlight Code Preview di fex:sudo apt install -y bat:brew install bat:sudo pacman -S --noconfirm bat:sudo dnf install -y bat"
        "eza:eza:Modern Tree & Icon Preview di fex:sudo apt install -y eza:brew install eza:sudo pacman -S --noconfirm eza:sudo dnf install -y eza"
        "fd:fd-find:Ultra-fast Recursive Scanner di fex:sudo apt install -y fd-find:brew install fd:sudo pacman -S --noconfirm fd:sudo dnf install -y fd-find"
        "zoxide:zoxide:Rapid Directory Tracking Engine untuk zf:sudo apt install -y zoxide:brew install zoxide:sudo pacman -S --noconfirm zoxide:sudo dnf install -y zoxide"
        "clipboard:wl-clipboard / xclip:Native OS System Clipboard di fex:sudo apt install -y wl-clipboard xclip:brew install wl-clipboard:sudo pacman -S --noconfirm wl-clipboard xclip:sudo dnf install -y wl-clipboard xclip"
    )

    local missing_items=()

    for item in "${lego_list[@]}"; do
        IFS=":" read -r bin pkg desc apt_cmd brew_cmd pac_cmd dnf_cmd <<< "$item"
        if [[ "$bin" == "clipboard" ]]; then
            if ! command -v wl-copy &>/dev/null && ! command -v xclip &>/dev/null && ! command -v pbcopy &>/dev/null; then
                missing_items+=("$item")
            fi
            continue
        fi

        if ! command -v "$bin" &>/dev/null; then
            # Special check for batcat / fdfind
            if [[ "$bin" == "bat" ]] && command -v batcat &>/dev/null; then
                continue
            fi
            if [[ "$bin" == "fd" ]] && command -v fdfind &>/dev/null; then
                continue
            fi
            missing_items+=("$item")
        fi
    done

    if [[ ${#missing_items[@]} -eq 0 ]]; then
        echo -e "  ${GREEN}✔${RESET} Semua Lego Power-Ups sudah lengkap terpasang!"
        return 0
    fi

    echo -e "\n${BOLD}${YELLOW}⚡ LEGO POWER-UPS ENHANCEMENT SCAN${RESET}"
    echo -e "${GRAY}Ditemukan ${#missing_items[@]} tool pelengkap yang belum terpasang di sistem:${RESET}\n"

    for item in "${missing_items[@]}"; do
        IFS=":" read -r bin pkg desc apt_cmd brew_cmd pac_cmd dnf_cmd <<< "$item"
        local install_cmd=""
        case "$pm" in
            apt) install_cmd="$apt_cmd" ;;
            brew) install_cmd="$brew_cmd" ;;
            pacman) install_cmd="$pac_cmd" ;;
            dnf) install_cmd="$dnf_cmd" ;;
            *)
                echo -e "${GRAY}┌─${RESET} ${BOLD}${CYAN}LEGO POWER-UP: ${YELLOW}${bin}${RESET} ${GRAY}───────────────────────────────────────${RESET}"
                echo -e "${GRAY}│${RESET} 🎯 Fitur Terkunci : ${WHITE}${desc}${RESET}"
                echo -e "${GRAY}│${RESET} 💡 Catatan        : Package manager '$pm' belum didukung auto-install. Silakan pasang paket '${pkg}' secara manual.${RESET}"
                echo -e "${GRAY}└────────────────────────────────────────────────────────────${RESET}\n"
                continue
                ;;
        esac

        echo -e "${GRAY}┌─${RESET} ${BOLD}${CYAN}LEGO POWER-UP: ${YELLOW}${bin}${RESET} ${GRAY}───────────────────────────────────────${RESET}"
        echo -e "${GRAY}│${RESET} 🎯 Fitur Terkunci : ${WHITE}${desc}${RESET}"
        echo -e "${GRAY}│${RESET} 🛠️  Perintah Rekomendasi : ${YELLOW}${install_cmd}${RESET}"
        echo -e "${GRAY}└────────────────────────────────────────────────────────────${RESET}"

        if [[ "$AUTO_YES" == true ]]; then
            echo -e "  ${GRAY}↳ Auto-yes aktif: melewati instalasi interaktif.${RESET}\n"
            continue
        fi

        if [[ -t 0 ]]; then
            printf "  ${BOLD}❯ Pasang '%s' sekarang via %s? [y/N]: ${RESET}" "$bin" "$pm"
            read -r resp || resp="n"
        elif [[ -c /dev/tty ]] && { exec 3< /dev/tty; } 2>/dev/null; then
            printf "  ${BOLD}❯ Pasang '%s' sekarang via %s? [y/N]: ${RESET}" "$bin" "$pm"
            read -r resp <&3 || resp="n"
            exec 3<&-
        else
            echo -e "  ${GRAY}↳ Non-interactive session: lewati prompt.${RESET}\n"
            continue
        fi

        if [[ "$resp" =~ ^[yY]$ ]]; then
            echo -e "  ${CYAN}==> Menjalankan:${RESET} ${YELLOW}${install_cmd}${RESET}"
            if eval "$install_cmd"; then
                echo -e "  ${GREEN}✔ Berhasil memasang ${bin}!${RESET}\n"
                # Fix symlinks immediately if bat or fd
                if [[ "$bin" == "bat" ]] && command -v batcat &>/dev/null; then
                    ln -sf "$(command -v batcat)" "$LOCAL_BIN/bat" 2>/dev/null || true
                fi
                if [[ "$bin" == "fd" ]] && command -v fdfind &>/dev/null; then
                    ln -sf "$(command -v fdfind)" "$LOCAL_BIN/fd" 2>/dev/null || true
                fi
            else
                echo -e "  ${RED}✖ Gagal memasang ${bin}.${RESET}\n"
            fi
        else
            echo -e "  ${GRAY}↳ Dilewati.${RESET}\n"
        fi
    done
}

# ── Dynamic Tool Version Helpers ─────────────────────────────────────────────
get_fex_version() {
    local v
    v=$(grep 'Version = ' "$ROOT_DIR/tools-cli/src/fex/cmd/root.go" 2>/dev/null | grep -oP '"[^"]+"' | tr -d '"' || true)
    [[ -n "$v" ]] && echo "v$v" || echo "v0.3.16"
}

get_gn_version() {
    local v
    v=$(node -e "try{console.log(require('$ROOT_DIR/tools-cli/src/gn/package.json').version)}catch(e){}" 2>/dev/null || true)
    [[ -n "$v" ]] && echo "v$v" || echo "v2.0.2"
}

get_gb_version() {
    local v
    v=$(node -e "try{console.log(require('$ROOT_DIR/tools-cli/src/gb/package.json').version)}catch(e){}" 2>/dev/null || true)
    [[ -n "$v" ]] && echo "v$v" || echo "v2.2.0"
}

get_sup_version() {
    local v
    v=$(node -e "try{console.log(require('$ROOT_DIR/tools-cli/src/sup/package.json').version)}catch(e){}" 2>/dev/null || true)
    [[ -n "$v" ]] && echo "v$v" || echo "v1.1.0"
}

# ── Main Installation Flow ───────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "\n${BOLD}${CYAN}  ██████╗  ██████╗ ██████╗ ██╗     ██╗███╗   ██╗"
echo -e " ██╔════╝ ██╔═══██╗██╔══██╗██║     ██║████╗  ██║"
echo -e " ██║  ███╗██║   ██║██████╔╝██║     ██║██╔██╗ ██║"
echo -e " ██║   ██║██║   ██║██╔══██╗██║     ██║██║╚██╗██║"
echo -e " ╚██████╔╝╚██████╔╝██████╔╝███████╗██║██║ ╚████║"
echo -e "  ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝╚═╝  ╚═══╝${RESET}"
echo -e " ${BOLD}${WHITE}GOBLIN VAULT ARSENAL & TOOLING INSTALLER${RESET}"
echo -e "${GRAY}────────────────────────────────────────────────────────────${RESET}\n"

echo -e "${BOLD}${BLUE}📦 [1/6] Menyiapkan Environment & PATH...${RESET}"
setup_path "$ZSHRC" "Zsh"
setup_path "$BASHRC" "Bash"
mkdir -p "$LOCAL_BIN"
echo -e "  ${GREEN}✔${RESET} ~/.local/bin & tools-cli/bin terverifikasi di \$PATH"

if [[ "$TARGET" == "all" || "$TARGET" == "gn" || "$TARGET" == "gb" || "$TARGET" == "sup" ]]; then
    echo -e "\n${BOLD}${BLUE}📦 [2/6] Memasang Dependensi TypeScript/Bun Sub-Tools...${RESET}"
    if [[ "$TARGET" == "all" || "$TARGET" == "gn" ]]; then
        run_with_spinner "Menginstall dependensi tools-cli/src/gn" install_tool_deps "gn"
    fi
    if [[ "$TARGET" == "all" || "$TARGET" == "gb" ]]; then
        run_with_spinner "Menginstall dependensi tools-cli/src/gb" install_tool_deps "gb"
    fi
    if [[ "$TARGET" == "all" || "$TARGET" == "sup" ]]; then
        run_with_spinner "Menginstall dependensi tools-cli/src/sup" install_tool_deps "sup"
    fi
fi

if [[ "$TARGET" == "all" || "$TARGET" == "fex" ]]; then
    echo -e "\n${BOLD}${BLUE}🐹 [3/6] Mengompilasi Native Go Binary (fex)...${RESET}"
    FEX_V=$(get_fex_version)
    run_with_spinner "Membangun fex $FEX_V -> $TOOLS_BIN/fex" build_fex
fi

if [[ "$TARGET" == "all" || "$TARGET" == "fex" || "$TARGET" == "gn" || "$TARGET" == "gb" || "$TARGET" == "sup" || "$TARGET" == "zf" ]]; then
    echo -e "\n${BOLD}${BLUE}🔗 [4/6] Menghubungkan Universal Symlinks ke ~/.local/bin/...${RESET}"
    run_with_spinner "Membuat symlinks universal fex, gn, gb, sup, zf" link_binaries
fi

if [[ "$TARGET" == "all" || "$TARGET" == "config" || "$TARGET" == "fex" ]]; then
    echo -e "\n${BOLD}${BLUE}⚙️  [5/6] Mendeploy Master Configs (micro, fex, nvim)...${RESET}"
    run_with_spinner "Menyinkronkan konfigurasi ke ~/.config/" deploy_configs
fi

if [[ "$TARGET" == "all" || "$TARGET" == "lego" ]]; then
    echo -e "\n${BOLD}${BLUE}🧱 [6/6] Memeriksa Lego Ecosystem Enhancement...${RESET}"
    check_and_prompt_lego
fi

# ── Verification Check (Doctor) ──────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}🩺 Menjalankan Diagnostic Health Check Final...${RESET}"
node "$ROOT_DIR/scripts/doctor.js" || true

# ── Final Summary Card ───────────────────────────────────────────────────────
FEX_DISP=$(get_fex_version)
GN_DISP=$(get_gn_version)
GB_DISP=$(get_gb_version)
SUP_DISP=$(get_sup_version)

echo -e "\n${BOLD}${GREEN}╭──────────────────────────────────────────────────────────────────────────╮${RESET}"
echo -e "${BOLD}${GREEN}│  🎉 GOBLIN ARSENAL DEPLOYED & SIAP TEMPUR!                               │${RESET}"
echo -e "${BOLD}${GREEN}├──────────────────────────────────────────────────────────────────────────┤${RESET}"
printf "${BOLD}${GREEN}│${RESET}  ${BOLD}${YELLOW}📁 %-5s${RESET} %-8s │ File Explorer TUI (fzf + tmux + git diff)             ${BOLD}${GREEN}│${RESET}\n" "fex" "$FEX_DISP"
printf "${BOLD}${GREEN}│${RESET}  ${BOLD}${CYAN}🌐 %-5s${RESET} %-8s │ Control Center & AI Telemetry Plane                  ${BOLD}${GREEN}│${RESET}\n" "gn" "$GN_DISP"
printf "${BOLD}${GREEN}│${RESET}  ${BOLD}${MAGENTA}🐙 %-5s${RESET} %-8s │ GitHub Assistant & Bot Manager                       ${BOLD}${GREEN}│${RESET}\n" "gb" "$GB_DISP"
printf "${BOLD}${GREEN}│${RESET}  ${BOLD}${BLUE}📦 %-5s${RESET} %-8s │ Universal Granular Package Updater                   ${BOLD}${GREEN}│${RESET}\n" "sup" "$SUP_DISP"
printf "${BOLD}${GREEN}│${RESET}  ${BOLD}${WHITE}⚡ %-5s${RESET} %-8s │ Zoxide & Tmux Rapid Directory Engine                 ${BOLD}${GREEN}│${RESET}\n" "zf" "v0.2.0"
echo -e "${BOLD}${GREEN}╰──────────────────────────────────────────────────────────────────────────╯${RESET}"
echo -e "💡 ${DIM}Tips: Jalankan 'source ~/.zshrc' atau 'source ~/.bashrc' bila ini instalasi pertama.${RESET}\n"
