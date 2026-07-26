# ═══════════════════════════════════════════════════
# ZF — Zoxide & Tmux Navigation Engine (v1.2)
# Architecture: Modular Subshell Router
# ═══════════════════════════════════════════════════
zf() {
    # Resolve script folder dynamically or default to goblin-vault location
    local zf_dir
    if [ -n "${GOBLIN_VAULT_ROOT:-}" ]; then
        zf_dir="$GOBLIN_VAULT_ROOT/tools-cli/src/zf"
    elif [ -d "$HOME/civil/goblin-vault/tools-cli/src/zf" ]; then
        zf_dir="$HOME/civil/goblin-vault/tools-cli/src/zf"
    else
        zf_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    fi
    
    # Auto-source sub-modules
    source "$zf_dir/preview.sh" 2>/dev/null
    source "$zf_dir/tmux.sh" 2>/dev/null
    source "$zf_dir/zoxide_admin.sh" 2>/dev/null

    # ── Parse mode flag ──────────────────────────────────────────
    local mode=""
    case "${1:-}" in
        --help|-h)
            echo "Usage: zf [mode] [args] (v1.2)"
            echo ""
            echo "Directory picker → cd → optional tool execution / Zoxide & Tmux Management"
            echo ""
            echo "Modes (Picker + Tool):"
            echo "  (none)              Pick directory and cd"
            echo "  --fex, -f           Pick → cd → fex (file explorer)"
            echo "  --fextr, -t         Pick → cd → fex --tree (tree viewer)"
            echo "  --gh-blin, -g       Pick → cd → gh-blin (GitHub TUI)"
            echo "  --lg, -l            Pick → cd → lazygit"
            echo "  --omp, -o           Pick → cd → omp (Oh My Pi)"
            echo "  --opencode, -oc     Pick → cd → opencode"
            echo "  --code, -c          Pick → cd → code . (VS Code)"
            echo "  --tmux new          Pick → cd → new tmux session"
            echo ""
            echo "Zoxide Admin Modes:"
            echo "  --add, -a [dir]     Add path to zoxide DB (default: current PWD)"
            echo "  --del, -d           Interactive fzf picker to remove path from zoxide DB"
            echo "  --rank, -r          View zoxide ranking list with scores"
            echo ""
            echo "Tmux Session Modes:"
            echo "  --tmux in           List → attach tmux session"
            echo "  --tmux kill         List → kill tmux session"
            echo "  --help, -h          Show this help"
            return 0
            ;;
        --fex|-f)       mode="fex";      shift ;;
        --fextr|-t)     mode="fextr";    shift ;;
        --gh-blin|-g)   mode="gh-blin";  shift ;;
        --lg|-l)        mode="lg";       shift ;;
        --omp|-o)       mode="omp";      shift ;;
        --opencode|-oc) mode="opencode"; shift ;;
        --code|-c)      mode="code";     shift ;;
        --add|-a)
            shift
            _zf_zoxide_admin_handler add "$@"
            return $?
            ;;
        --del|-d)
            shift
            _zf_zoxide_admin_handler del "$@"
            return $?
            ;;
        --rank|-r)
            shift
            _zf_zoxide_admin_handler rank "$@"
            return $?
            ;;
        --tmux)
            shift
            case "${1:-}" in
                new|in|kill) mode="tmux:$1"; shift ;;
                *) echo "❌ zf: --tmux butuh subcommand (new / in / kill)"; return 1 ;;
            esac
            if [ "$mode" = "tmux:in" ] || [ "$mode" = "tmux:kill" ]; then
                _zf_tmux_handler "$mode"
                return $?
            fi
            ;;
    esac

    # ── Directory picker (zoxide + fzf) ─────────────────────────
    # load config.sh dynamically if it exists in the goblin-vault configs
    if [ -f "${GOBLIN_VAULT_ROOT:-}/configs/shell/config.sh" ]; then
        source "${GOBLIN_VAULT_ROOT}/configs/shell/config.sh"
    elif [ -f "$HOME/civil/goblin-vault/configs/shell/config.sh" ]; then
        source "$HOME/civil/goblin-vault/configs/shell/config.sh"
    else
        source "$HOME/.shell/core/config.sh" 2>/dev/null || true
    fi

    if ! command -v zoxide >/dev/null 2>&1; then
        echo "❌ Error: 'zoxide' tidak ditemukan di sistem."
        return 1
    fi
    if ! command -v fzf >/dev/null 2>&1; then
        echo "❌ Error: 'fzf' tidak ditemukan di sistem."
        return 1
    fi

    local _ZF_PREVIEW_CMD
    _ZF_PREVIEW_CMD=$(_zf_get_preview_cmd)

    # Build header based on mode
    local header='   Ketik cari •   Enter jump •   Esc keluar'
    if [ -n "$mode" ]; then
        case "$mode" in
            fex)      header="$header → run fex";;
            fextr)    header="$header → run fex --tree";;
            gh-blin)  header="$header → run gh-blin";;
            lg)       header="$header → run lazygit";;
            omp)      header="$header → run omp";;
            opencode) header="$header → run opencode";;
            code)     header="$header → open VS Code";;
            tmux:new) header="$header → new tmux session";;
        esac
    fi

    local dir
    dir=$(zoxide query -l | sed "s|^$HOME|~|" | head -n 100 | fzf \
        --cycle \
        --layout=reverse \
        --info=inline \
        --border=rounded \
        --margin='1,2' \
        --prompt='   Jump → ' \
        --pointer='❯' \
        --marker='✔' \
        --header="$header" \
        --color="$(_fzf_colors 2>/dev/null)" \
        --bind 'ctrl-u:clear-query,ctrl-w:backward-kill-word,ctrl-r:reload(zoxide query -l | sed "s|^'"$HOME"'|~|" | head -n 100),change:reload(zoxide query -l {q} | sed "s|^'"$HOME"'|~|" | head -n 100)' \
        --preview "$_ZF_PREVIEW_CMD" \
        --preview-window='right:55%:border-rounded:wrap' \
        --highlight-line)

    if [ -n "$dir" ]; then
        # Kembalikan ~ menjadi path $HOME asli agar bisa dieksekusi cd / zoxide
        dir="${dir/#\~/$HOME}"

        # Pindah ke direktori hasil pilihan
        __zoxide_z "$dir" 2>/dev/null || z "$dir" 2>/dev/null || cd "$dir"

        # Offer focus lock (silent if focus is active or dir isn't lock-worthy)
        focus_offer_lock 2>/dev/null

        # ── Action mode: jalankan tool di direktori yang dipilih ─
        case "$mode" in
            fex)      command fex ;;
            fextr)    command fex --tree ;;
            gh-blin)  command gh-blin ;;
            lg)       command lazygit ;;
            omp)      command omp ;;
            opencode) command opencode ;;
            code)     command code . ;;
            tmux:new)
                local name
                name=$(printf '' | fzf --print-query --prompt='Session name: ' \
                    --query="" \
                    --header='Enter session name (Enter to confirm)' \
                    --border=rounded \
                    --layout=reverse \
                    --margin='1,2' \
                    2>/dev/null | tail -1)
                [ -z "$name" ] && echo "Batal. 🍃" && return 0
                tmux new-session -d -s "$name" -c "$PWD" 2>/dev/null
                if [ -n "$TMUX" ]; then
                    tmux switch-client -t "$name" 2>/dev/null
                else
                    tmux attach-session -t "$name" 2>/dev/null
                fi
                ;;
        esac
    fi
}
