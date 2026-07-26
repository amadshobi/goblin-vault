# ── Module: Interactive Tmux Management (v1.2) ─────────────
_zf_tmux_handler() {
    local mode="$1"
    
    if ! command -v tmux >/dev/null 2>&1; then
        echo "❌ tmux gak terinstall."
        return 1
    fi
    
    local sessions
    sessions=$(tmux list-sessions -F "#S" 2>/dev/null)

    if [ -z "$sessions" ]; then
        if [ "$mode" = "tmux:kill" ]; then
            echo "Gak ada sesi aktif, BOSS. 🍃"
            return 0
        fi
        # tmux:in fallback — tawarin buat bikin baru via fzf
        local name
        name=$(printf '' | fzf --print-query --prompt='Session name: ' \
            --query="" \
            --header='Gak ada sesi. Ketik nama buat bikin baru, Esc batal' \
            --border=rounded \
            --layout=reverse \
            --margin='1,2' \
            2>/dev/null | tail -1)
        if [ -n "$name" ]; then
            tmux new-session -s "$name" 2>/dev/null || tmux new -s "$name"
        fi
        return 0
    fi

    local chosen
    chosen=$(echo "$sessions" | fzf \
        --prompt='    Session → ' \
        --header='Pilih tmux session' \
        --layout=reverse \
        --border=rounded \
        --cycle \
        --margin='1,2' \
        --pointer='❯')

    [ -z "$chosen" ] && echo "Batal. 🍃" && return 0

    if [ "$mode" = "tmux:in" ]; then
        if [ -n "$TMUX" ]; then
            tmux switch-client -t "$chosen"
        else
            tmux attach-session -t "$chosen"
        fi
    else
        # tmux:kill — kill session, auto-switch semua client sebelum kill
        local current_session
        current_session=$(tmux display-message -p '#{session_name}' 2>/dev/null)

        local other_sessions
        other_sessions=$(tmux list-sessions -F "#S" 2>/dev/null | grep -v "^$chosen$" || true)

        # Kalo yang dipilih adalah session sekarang dan ada sesi lain →
        # switch SEMUA client (popup + main terminal) ke sesi lain sebelum kill
        if [ "$chosen" = "$current_session" ] && [ -n "$other_sessions" ]; then
            local target
            target=$(echo "$other_sessions" | head -1)

            while read -r client; do
                [ -z "$client" ] && continue
                tmux switch-client -c "$client" -t "$target" 2>/dev/null || true
            done < <(tmux list-clients -F '#{client_name}' -t "$chosen" 2>/dev/null)

            echo "➡️  Pindah ke session '$target'"
        fi

        tmux kill-session -t "$chosen"
        echo "🗑️  Session '$chosen' dibantai! 💀"
    fi
}
