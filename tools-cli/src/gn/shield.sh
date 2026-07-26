#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Privacy Shield CLI Manager (gn-shield)
# ─────────────────────────────────────────────────────────────

# Determine shield location dynamically
if [ -n "${GOBLIN_VAULT_ROOT:-}" ]; then
    SHIELD_DIR="$GOBLIN_VAULT_ROOT/tools-cli/src/shield"
elif [ -d "$HOME/civil/goblin-vault/tools-cli/src/shield" ]; then
    SHIELD_DIR="$HOME/civil/goblin-vault/tools-cli/src/shield"
else
    SHIELD_DIR="$HOME/.shell/security"
fi

INTERCEPTOR_SCRIPT="$SHIELD_DIR/shield-interceptor.ts"
PID_FILE="$SHIELD_DIR/shield.pid"
LOG_FILE="$SHIELD_DIR/shield.log"

LISTEN_PORT="${SHIELD_LISTEN_PORT:-4002}"
TARGET_PORT="${SHIELD_TARGET_PORT:-4000}"

show_help() {
    echo "🛡️ Goblin Privacy Shield Manager"
    echo ""
    echo "Usage: gn shield [command]"
    echo ""
    echo "Commands:"
    echo "  enable, on  🚀 Aktifkan Privacy Shield & auto-switch opencode.jsonc ke Port $LISTEN_PORT"
    echo "  disable, off 🛑 Matikan Privacy Shield & auto-revert opencode.jsonc ke Port $TARGET_PORT"
    echo "  start       Jalankan Interceptor Daemon tanpa mengubah config opencode"
    echo "  stop        Matikan Interceptor Daemon tanpa mengubah config opencode"
    echo "  restart     Restart Interceptor Daemon"
    echo "  status      Cek status keaktifan Privacy Shield & listening port"
    echo "  logs        Lihat live log sanitization & request traffic"
    echo "  rules       Buka / edit masking regex rules.json"
    echo ""
}

is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

start_shield() {
    if is_running; then
        echo "🛡️ [Goblin Shield] Shield daemon sudah berjalan! (PID: $(cat "$PID_FILE"))"
        return 0
    fi

    echo "🚀 [Goblin Shield] Starting Privacy Interceptor Daemon (Port $LISTEN_PORT -> $TARGET_PORT)..."
    nohup bun run "$INTERCEPTOR_SCRIPT" > "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    sleep 1

    if is_running; then
        echo "✅ [Goblin Shield] Daemon aktif di PID $pid!"
        echo "📡 Active Interceptor Endpoint: http://127.0.0.1:$LISTEN_PORT/v1"
    else
        echo "❌ [Goblin Shield] Gagal mengaktifkan daemon. Cek logs: gn shield logs"
    fi
}

stop_shield() {
    if is_running; then
        local pid=$(cat "$PID_FILE")
        echo "🛑 [Goblin Shield] Stopping daemon (PID: $pid)..."
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        echo "✅ [Goblin Shield] Daemon dihentikan."
    else
        echo "ℹ️ [Goblin Shield] Daemon tidak sedang berjalan."
    fi
}

switch_opencode_port() {
    local target_port="$1"
    local config_file="$HOME/.config/opencode/opencode.jsonc"

    if [ -f "$config_file" ]; then
        echo "🔧 [Goblin Shield] Updating $config_file baseURL port to $target_port..."
        bun -e '
          const fs = require("fs");
          const path = "'"$config_file"'";
          let content = fs.readFileSync(path, "utf-8");
          const targetPort = "'"$target_port"'";
          const updated = content.replace(/http:\/\/127\.0\.0\.1:\d+\/v1/g, `http://127.0.0.1:${targetPort}/v1`);
          fs.writeFileSync(path, updated, "utf-8");
          console.log(`✅ [Goblin Shield] opencode.jsonc updated -> http://127.0.0.1:${targetPort}/v1`);
        '
    else
        echo "⚠️ [Goblin Shield] Config $config_file tidak ditemukan!"
    fi
}

case "${1:-}" in
    enable|on)
        start_shield
        switch_opencode_port "$LISTEN_PORT"
        ;;
    disable|off)
        stop_shield
        switch_opencode_port "$TARGET_PORT"
        ;;
    start)
        start_shield
        ;;
    stop)
        stop_shield
        ;;
    restart)
        stop_shield
        sleep 1
        start_shield
        ;;
    status)
        if is_running; then
            echo "🟢 [Goblin Shield Status] Active & Protecting! (PID: $(cat "$PID_FILE"))"
            echo "📡 Endpoint: http://127.0.0.1:$LISTEN_PORT -> Target Gateway: http://127.0.0.1:$TARGET_PORT"
        else
            echo "🔴 [Goblin Shield Status] Inactive (Bypass / Direct Gateway Mode)"
        fi
        ;;
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f "$LOG_FILE"
        else
            echo "📜 Log file belum ada."
        fi
        ;;
    rules)
        echo "📝 File Rules: $SHIELD_DIR/rules.json"
        if command -v micro >/dev/null 2>&1; then
            micro "$SHIELD_DIR/rules.json"
        elif [ -n "$EDITOR" ]; then
            $EDITOR "$SHIELD_DIR/rules.json"
        else
            cat "$SHIELD_DIR/rules.json"
        fi
        ;;
    help|--help|-h|*)
        show_help
        ;;
esac
