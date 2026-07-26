#!/usr/bin/env bash
# ins v2.1 - Universal Package Installer with Interactive Live Registry Search
# Supports: apt, npm, bun, pip, cargo, brew

if [ -f "${GOBLIN_VAULT_ROOT:-}/configs/shell/config.sh" ]; then
    source "${GOBLIN_VAULT_ROOT}/configs/shell/config.sh"
elif [ -f "$HOME/civil/goblin-vault/configs/shell/config.sh" ]; then
    source "$HOME/civil/goblin-vault/configs/shell/config.sh"
else
    source "$HOME/.shell/core/config.sh" 2>/dev/null || true
fi

_has_gum() { command -v gum >/dev/null 2>&1; }
_has_fzf() { command -v fzf >/dev/null 2>&1; }

_ins_style() {
    if _has_gum; then gum style --foreground "${TOKYO_NIGHT[$1]}" "$2"
    else printf "%s\n" "$2"; fi
}

# ── 1. Interactive APT Picker ──
_ins_apt_fzf_interactive() {
    local cache_file="${INS_CACHE_DIR:-/tmp}/ins-cache-$$.pkg"
    
    if [ ! -f "$cache_file" ]; then
        if _has_gum; then
            gum spin --spinner dot --title "🔍 Loading APT package list..." -- apt-cache pkgnames > "$cache_file" 2>/dev/null
        else
            echo "🔍 Loading APT package list..."
            apt-cache pkgnames > "$cache_file" 2>/dev/null
        fi
    fi

    if [ ! -s "$cache_file" ]; then
        echo "❌ Gagal memuat daftar package APT."
        return 1
    fi

    local selected
    selected=$(fzf --layout=reverse --info=inline --border=rounded --margin='1,2' \
        --prompt='  🔍 APT Search > ' --pointer='❯' --marker='✓' \
        --header='📦 Select APT Packages | Tab: Multi-select | Enter: Install | Esc: Exit' \
        --preview '
            pkg={};
            info=$(apt-cache show "$pkg" 2>/dev/null);
            [ -z "$info" ] && { echo "❌ Package not found"; exit 0; };
            printf "\033[1;36mPackage:\033[0m %s\n" "$pkg";
            ver=$(echo "$info" | grep "^Version:" | head -1 | cut -d" " -f2);
            printf "\033[1;36mVersion:\033[0m %s\n" "${ver:-(unknown)}";
            desc=$(echo "$info" | grep "^Description-en:" | head -1 | cut -d: -f2- | fold -s -w 60 | head -8);
            printf "\n\033[1;36mDescription:\033[0m\n%s\n" "$desc";
        ' \
        --preview-window='right:55%:border-rounded:wrap' --multi < "$cache_file")

    rm -f "$cache_file" 2>/dev/null

    if [ -z "$selected" ]; then
        echo "⏭️ Instalasi dibatalkan, BOSS! 💨"
        return 0
    fi

    local pkgs=$(echo "$selected" | tr '\n' ' ')
    echo ""
    _ins_style "cyan" "📦 Installing APT packages: $pkgs"
    sudo apt update && sudo apt install -y $pkgs
}

# ── 2. Interactive NPM / Bun Search ──
_ins_npm_interactive() {
    local installer="$1" # npm or bun
    local query=""
    
    if _has_gum; then
        query=$(gum input --placeholder "Masukkan kata kunci pencarian NPM package (misal: react, express)...")
    else
        printf "🔍 Masukkan kata kunci pencarian NPM package: "
        read -r query
    fi

    [ -z "$query" ] && { echo "Batal pencarian, BOSS! 💨"; return 0; }

    echo "🔍 Searching NPM Registry for '$query'..."
    local search_res
    search_res=$(npm search "$query" --json 2>/dev/null)

    if [ -z "$search_res" ] || [ "$search_res" = "[]" ]; then
        echo "❌ Tidak ditemukan package NPM untuk '$query'."
        return 1
    fi

    local lines
    lines=$(bun -e '
      try {
        const data = JSON.parse(process.argv[1]);
        data.slice(0, 40).forEach(p => console.log(`${p.name}\t${p.description || ""} (${p.version})`));
      } catch(e){}
    ' "$search_res" 2>/dev/null)

    if [ -z "$lines" ]; then
        echo "❌ Gagal memproses hasil search NPM."
        return 1
    fi

    local selected
    selected=$(echo "$lines" | fzf --layout=reverse --info=inline --border=rounded --margin='1,2' \
        --prompt="  🔍 $installer NPM Search > " --header="📦 Select NPM Package to Install Global ($installer)" \
        --delimiter='\t' --with-nth=1,2 | awk -F'\t' '{print $1}')

    if [ -z "$selected" ]; then
        echo "⏭️ Instalasi dibatalkan, BOSS! 💨"
        return 0
    fi

    if [ "$installer" = "bun" ]; then
        _ins_style "cyan" "🍞 Installing Bun global package: $selected"
        bun add -g "$selected"
    else
        _ins_style "cyan" "📦 Installing NPM global package: $selected"
        npm install -g "$selected"
    fi
}

# ── 3. Interactive PIP Search ──
_ins_pip_interactive() {
    local query=""
    if _has_gum; then
        query=$(gum input --placeholder "Masukkan kata kunci PyPI package (misal: requests, fastapi)...")
    else
        printf "🔍 Masukkan kata kunci PyPI package: "
        read -r query
    fi

    [ -z "$query" ] && { echo "Batal pencarian, BOSS! 💨"; return 0; }

    echo "🔍 Searching PyPI for '$query'..."
    local search_res
    search_res=$(curl -s "https://pypi.org/pypi?%3Aaction=search&term=$query" | grep -oP 'class="package-snippet__name">\K[^<]+' | head -30)

    if [ -z "$search_res" ]; then
        echo "❌ Tidak ditemukan package PyPI untuk '$query'."
        return 1
    fi

    local selected
    selected=$(echo "$search_res" | fzf --layout=reverse --info=inline --border=rounded --margin='1,2' \
        --prompt='  🔍 PyPI Search > ' --header='🐍 Select PyPI Package to Install')

    if [ -z "$selected" ]; then
        echo "⏭️ Instalasi dibatalkan, BOSS! 💨"
        return 0
    fi

    _ins_style "cyan" "🐍 Installing PIP package: $selected"
    pip3 install "$selected" --break-system-packages --user 2>/dev/null || pip3 install "$selected" --user
}

# ── 4. Interactive BREW Search ──
_ins_brew_interactive() {
    local query=""
    if _has_gum; then
        query=$(gum input --placeholder "Masukkan kata kunci Homebrew formula (misal: fzf, node)...")
    else
        printf "🔍 Masukkan kata kunci Homebrew formula: "
        read -r query
    fi

    [ -z "$query" ] && { echo "Batal pencarian, BOSS! 💨"; return 0; }

    echo "🔍 Searching Homebrew for '$query'..."
    local search_res
    search_res=$(brew search "$query" 2>/dev/null | grep -v "==>" | head -40)

    if [ -z "$search_res" ]; then
        echo "❌ Tidak ditemukan formula Homebrew untuk '$query'."
        return 1
    fi

    local selected
    selected=$(echo "$search_res" | fzf --layout=reverse --info=inline --border=rounded --margin='1,2' \
        --prompt='  🍺 Homebrew Search > ' --header='🍺 Select Homebrew Formula to Install')

    if [ -z "$selected" ]; then
        echo "⏭️ Instalasi dibatalkan, BOSS! 💨"
        return 0
    fi

    _ins_style "cyan" "🍺 Installing Homebrew package: $selected"
    brew install "$selected"
}

# ── 5. Main Installer Function ──
ins() {
    local target="${1:-apt}"

    case "$target" in
        apt)
            shift 2>/dev/null || true
            if [ $# -eq 0 ]; then
                _ins_apt_fzf_interactive
            else
                _ins_style "cyan" "📦 Installing APT packages: $*"
                sudo apt update && sudo apt install -y "$@"
            fi
            ;;
        npm)
            shift
            if [ $# -eq 0 ]; then
                _ins_npm_interactive "npm"
            else
                _ins_style "cyan" "📦 Installing NPM global packages: $*"
                npm install -g "$@"
            fi
            ;;
        bun)
            shift
            if [ $# -eq 0 ]; then
                _ins_npm_interactive "bun"
            else
                _ins_style "cyan" "🍞 Installing Bun global packages: $*"
                bun add -g "$@"
            fi
            ;;
        pip|pip3)
            shift
            if [ $# -eq 0 ]; then
                _ins_pip_interactive
            else
                _ins_style "cyan" "🐍 Installing PIP packages: $*"
                pip3 install "$@" --break-system-packages --user 2>/dev/null || pip3 install "$@" --user
            fi
            ;;
        cargo)
            shift
            if [ $# -eq 0 ]; then
                echo "❌ Masukkan nama package Cargo. Contoh: ins cargo ripgrep"
                return 1
            fi
            _ins_style "cyan" "🦀 Installing Cargo packages: $*"
            cargo install "$@"
            ;;
        brew)
            shift
            if [ $# -eq 0 ]; then
                _ins_brew_interactive
            else
                _ins_style "cyan" "🍺 Installing Homebrew packages: $*"
                brew install "$@"
            fi
            ;;
        -h|--help|help)
            echo "🔍 ins v2.1 - Universal Package Installer & Interactive Search Engine"
            echo ""
            echo "Usage:"
            echo "  ins                     -> FZF Interactive APT package search & install"
            echo "  ins apt [pkg...]        -> Interactive APT search (jika tanpa pkg) atau install langsung"
            echo "  ins npm [pkg...]        -> Interactive NPM search (jika tanpa pkg) atau install global"
            echo "  ins bun [pkg...]        -> Interactive Bun search (jika tanpa pkg) atau install global"
            echo "  ins pip [pkg...]        -> Interactive PyPI search (jika tanpa pkg) atau install pip"
            echo "  ins brew [pkg...]       -> Interactive Homebrew search (jika tanpa pkg) atau install brew"
            echo "  ins cargo <pkg...>      -> Install Rust Cargo package(s)"
            ;;
        *)
            _ins_style "cyan" "📦 Installing APT packages: $*"
            sudo apt update && sudo apt install -y "$@"
            ;;
    esac
}
