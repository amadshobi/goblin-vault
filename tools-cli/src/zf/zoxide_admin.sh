# ── Module: Zoxide Database Management (v1.2) ──────────────
_zf_zoxide_admin_handler() {
    local action="$1"
    shift
    
    if ! command -v zoxide >/dev/null 2>&1; then
        echo "❌ Error: 'zoxide' tidak ditemukan di sistem."
        return 1
    fi
    if ! command -v fzf >/dev/null 2>&1; then
        echo "❌ Error: 'fzf' tidak ditemukan di sistem."
        return 1
    fi

    case "$action" in
        add)
            local target_dir="${1:-$PWD}"
            target_dir=$(eval echo "$target_dir")
            if [ -d "$target_dir" ]; then
                zoxide add "$target_dir"
                echo "✅ Direktori '$target_dir' berhasil ditambahkan ke zoxide DB! 🚀"
            else
                echo "❌ Error: Direktori '$target_dir' tidak ditemukan!"
                return 1
            fi
            ;;
        del)
            local chosen
            chosen=$(zoxide query -l | sed "s|^$HOME|~|" | fzf \
                --multi \
                --cycle \
                --layout=reverse \
                --border=rounded \
                --margin='1,2' \
                --prompt=' 🗑️  Remove from DB → ' \
                --pointer='❯' \
                --header='Pilih direktori yang mau dihapus dari zoxide DB (Tab buat multi-select)' \
                --color="$(_fzf_colors 2>/dev/null)")

            [ -z "$chosen" ] && echo "Batal. 🍃" && return 0

            echo "$chosen" | while read -r line; do
                [ -z "$line" ] && continue
                local real_path="${line/#\~/$HOME}"
                zoxide remove "$real_path" 2>/dev/null
                echo "🗑️  Dihapus dari DB: $line"
            done
            echo "✨ Selesai bersihin zoxide DB! 👍"
            ;;
        rank)
            zoxide query -ls | fzf \
                --cycle \
                --layout=reverse \
                --border=rounded \
                --margin='1,2' \
                --prompt=' 📊 Zoxide Ranking → ' \
                --pointer='❯' \
                --header='Score | Path (Urut dari frekuensi tertinggi)' \
                --color="$(_fzf_colors 2>/dev/null)"
            ;;
    esac
}
