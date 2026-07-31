#!/usr/bin/env bash
# sup v3 - Smart Interactive Fast Parallel Updater
# Features: Multi-select package approval, granular NPM package choices, Bun/OMP/Rustup support.

if [ -f "${GOBLIN_VAULT_ROOT:-}/configs/shell/config.sh" ]; then
    source "${GOBLIN_VAULT_ROOT}/configs/shell/config.sh"
elif [ -f "$HOME/civil/goblin-vault/configs/shell/config.sh" ]; then
    source "$HOME/civil/goblin-vault/configs/shell/config.sh"
else
    source "$HOME/.shell/core/config.sh" 2>/dev/null || true
fi

_has_gum() { command -v gum >/dev/null 2>&1; }
_sup_check() { command -v "$1" >/dev/null 2>&1; }

_sup_style() {
    if _has_gum; then gum style --foreground "${TOKYO_NIGHT[$1]}" "$2"
    else printf "%s\n" "$2"; fi
}

sup() {
    local auto_all=false
    local detail=false

    for arg in "$@"; do
        case "$arg" in
            -y|--yes|--all) auto_all=true ;;
            -d|--detail) detail=true ;;
        esac
    done

    sudo -v 2>/dev/null || true
    # Keep sudo alive during script execution
    ( while true; do sudo -n true; sleep 50; kill -0 "$$" || exit; done ) 2>/dev/null &
    local sudo_keeper_pid=$!
    trap 'kill $sudo_keeper_pid 2>/dev/null || true' EXIT

    if _has_gum; then
        gum style --foreground "${TOKYO_NIGHT[cyan]}" --bold "🚀 SUPER UPDATER v3 - GO! GO! GO!"
    else
        printf "🚀 SUPER UPDATER v3 - GO! GO! GO!\n"
    fi
    echo ""

    # Phase 1: Scanning Outdated Packages & Managers
    echo "🔍 Scanning system for outdated packages..."
    local options=()

    # Fast scan indicator
    _sup_style "comment" "• Checking APT..."
    if _sup_check "apt"; then
        local apt_count=$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l)
        if [ "$apt_count" -gt 0 ]; then
            options+=("📦 System: APT ($apt_count packages upgradable)|apt")
        fi
    fi

    _sup_style "comment" "• Checking SNAP..."
    if _sup_check "snap"; then
        local snap_count=$(snap refresh --list 2>/dev/null | tail -n +2 | wc -l)
        if [ "$snap_count" -gt 0 ]; then
            options+=("📦 System: SNAP ($snap_count packages upgradable)|snap")
        fi
    fi

    _sup_style "comment" "• Checking Runtimes & CLIs (Bun, OMP, Rustup)..."
    if _sup_check "bun"; then
        options+=("🍞 Runtime: Bun (bun upgrade)|bun")
    fi

    if _sup_check "omp"; then
        options+=("🧙 CLI: Oh My Pi (omp update)|omp")
    fi

    if _sup_check "rustup"; then
        options+=("🦀 Runtime: Rust Toolchain (rustup update)|rustup")
    fi

    _sup_style "comment" "• Checking Homebrew..."
    if _sup_check "brew"; then
        local brew_count=$(brew outdated 2>/dev/null | wc -l)
        if [ "$brew_count" -gt 0 ]; then
            options+=("🍺 Package: Homebrew ($brew_count outdated)|brew")
        fi
    fi

    _sup_style "comment" "• Checking PIP..."
    if _sup_check "pip3"; then
        local pip_count=$(pip3 list --outdated --format=columns 2>/dev/null | tail -n +3 | wc -l)
        if [ "$pip_count" -gt 0 ]; then
            options+=("🐍 Python: PIP ($pip_count packages outdated)|pip")
        fi
    fi

    _sup_style "comment" "• Checking NPM Global packages..."
    if _sup_check "npm"; then
        local npm_outdated_json
        npm_outdated_json=$(npm outdated -g --json 2>/dev/null || true)
        if [ -n "$npm_outdated_json" ] && [ "$npm_outdated_json" != "{}" ]; then
            local npm_pkgs
            npm_pkgs=$(bun -e '
              try {
                const data = JSON.parse(process.argv[1]);
                Object.keys(data).forEach(k => console.log(k));
              } catch(e){}
            ' "$npm_outdated_json" 2>/dev/null)
            
            if [ -n "$npm_pkgs" ]; then
                local IFS=$'\n'
                for pkg_name in $npm_pkgs; do
                    if [ -n "$pkg_name" ]; then
                        options+=("📦 NPM Global: $pkg_name|npm:$pkg_name")
                    fi
                done
            fi
        fi
    fi

    if [ ${#options[@]} -eq 0 ]; then
        _sup_style "green" "🎉 All packages and tools are already up to date, BOSS!"
        return 0
    fi

    # Phase 2: Approval Selection
    local selected_items=()

    if [ "$auto_all" = true ] || ! _has_gum; then
        for opt in "${options[@]}"; do
            selected_items+=("${opt##*|}")
        done
    else
        echo "💡 Select packages to update (Space to toggle, Enter to confirm):"
        local display_labels=()
        for opt in "${options[@]}"; do
            display_labels+=("${opt%%|*}")
        done

        local chosen_labels
        chosen_labels=$(printf "%s\n" "${display_labels[@]}" | gum choose --no-limit --selected="*" --header="Package Update Selector")
        local exit_code=$?
        if [ $exit_code -ne 0 ] || [ -z "$chosen_labels" ]; then
            echo "Batal update, BOSS! 💨"
            return 0
        fi

        for opt in "${options[@]}"; do
            local label="${opt%%|*}"
            local item="${opt##*|}"
            if echo "$chosen_labels" | grep -F -q "$label"; then
                selected_items+=("$item")
            fi
        done
    fi

    if [ ${#selected_items[@]} -eq 0 ]; then
        echo "Tidak ada package yang dipilih."
        return 0
    fi

    # Phase 3: Parallel / Sequential Execution
    echo ""
    echo "⚡ Executing updates for ${#selected_items[@]} targets..."
    local start_time=$(date +%s)

    for item in "${selected_items[@]}"; do
        case "$item" in
            apt)
                _sup_style "cyan" "📦 Updating APT..."
                sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y && sudo apt autoclean -y
                ;;
            snap)
                _sup_style "cyan" "📦 Updating SNAP..."
                sudo snap refresh
                ;;
            bun)
                _sup_style "cyan" "🍞 Upgrading Bun..."
                bun upgrade
                ;;
            omp)
                _sup_style "cyan" "🧙 Upgrading Oh My Pi (omp)..."
                omp update --yes 2>/dev/null || omp update
                ;;
            rustup)
                _sup_style "cyan" "🦀 Updating Rust toolchain..."
                rustup update
                ;;
            brew)
                _sup_style "cyan" "🍺 Updating Homebrew..."
                brew update && brew upgrade
                ;;
            pip)
                _sup_style "cyan" "🐍 Updating outdated PIP packages..."
                pip3 list --outdated --format=freeze 2>/dev/null | cut -d = -f 1 | xargs -n1 pip3 install -U --break-system-packages --user 2>/dev/null || true
                ;;
            npm:*)
                local npm_pkg="${item#npm:}"
                _sup_style "cyan" "📦 Updating NPM Global Package: $npm_pkg..."
                npm install -g "$npm_pkg@latest"
                ;;
        esac
    done

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    echo ""
    if _has_gum; then
        gum style --border rounded --border-foreground "${TOKYO_NIGHT[green]}" --padding "1 2" "🎉 Update Selesai! ($duration detik)" "System & packages fresh, BOSS! 🚀"
    else
        printf "🎉 Update Selesai! (%d detik)\nSystem & packages fresh, BOSS! 🚀\n" "$duration"
    fi
}
