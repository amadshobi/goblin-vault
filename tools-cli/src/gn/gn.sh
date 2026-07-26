#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus CLI - Modular Entrypoint (gn.sh)
# ─────────────────────────────────────────────────────────────

GN_DIR="$(cd "$(dirname "$0")" && pwd)"
ANTIGRAVITY_DIR="$HOME/.shell/secret/antigravity"
OLLAMA_DIR="$HOME/.shell/secret/ollama-cloud"
mkdir -p "$ANTIGRAVITY_DIR" "$OLLAMA_DIR"

run_with_optional_picker() {
    local action="$1"
    shift
    local available_file="${TMPDIR:-/tmp}/gn-last-available.json"

    local select_mode=false
    for arg in "$@"; do
        if [ "$arg" = "--select" ] || [ "$arg" = "-s" ]; then
            select_mode=true
            break
        fi
    done

    bun "$GN_DIR/bench.ts" "$action" "$@"

    if $select_mode; then
        if [ -f "$available_file" ]; then
            bash "$GN_DIR/picker.sh" "$available_file"
        else
            echo "⚠️  Tidak ada data available models untuk dipilih. File: $available_file"
        fi
    fi
}

show_help() {
    cat <<'HELP'
🧙‍♂️ Goblin Nexus Manager (gn)

Usage: gn <command> [options]

Commands:
  ping, p [prov|config]   ⚡ Auto-discover & ping model (default: opencode.jsonc)
    -s, --select          Setelah ping, pilih model untuk update opencode.jsonc
  bench, b [prov|config]  📊 Latency & speed benchmark
    -s, --select          Setelah bench, pilih model untuk update opencode.jsonc
  status, s [prov]        📊 Lihat sisa kuota & usage per-akun
  import, i               📥 Import semua file JSON dari ~/.shell/secret/
  login, l [prov]         🔑 Login akun OAuth / API Key baru
  export, e               📤 Export credential aktif ke JSON
  sync, sy                🔄 Sync API key dari env ke broker
  shield, sh [cmd]        🛡️ Privacy Shield (start, stop, status, logs, rules)
  agent, a [agent_name]   🤖 Ganti model untuk agent tertentu via TUI
  restart, r              🔄 Restart service omp-broker & omp-gateway
  logs, lg                📋 Lihat log live omp-gateway proxy
  help, h                 Tampilkan bantuan ini

Options:
  --force, -f             Skip cache (untuk ping/bench)
  --select, -s            Pilih model hasil ping/bench untuk update config

Examples:
  gn ping                 Ping semua model dari opencode.jsonc
  gn ping --select        Ping lalu pilih model untuk diaktifkan
  gn bench --force        Benchmark ulang tanpa cache
  gn bench all -s         Benchmark semua model gateway lalu pilih
  gn agent code           Ganti model untuk agent code
  gn shield enable        Aktifkan privacy shield
HELP
}

case "${1:-}" in
    ping|p)
        shift
        run_with_optional_picker ping "$@"
        ;;
    bench|b)
        shift
        run_with_optional_picker bench "$@"
        ;;
    status|s)
        echo "📊 [Goblin Nexus] Fetching usage & quota limit across all accounts..."
        omp usage ${2:+"--provider=$2"}
        ;;
    import|i)
        echo "📥 [Goblin Nexus] Importing credentials from $ANTIGRAVITY_DIR & $OLLAMA_DIR..."
        omp auth-broker import "$ANTIGRAVITY_DIR" 2>/dev/null || true
        omp auth-broker import "$OLLAMA_DIR" --provider=ollama-cloud 2>/dev/null || true
        echo "✅ Import completed!"
        ;;
    login|l)
        prov="${2:-google-antigravity}"
        echo "🔑 [Goblin Nexus] Logging into $prov..."
        omp auth-broker login "$prov"
        ;;
    export|e)
        echo "📤 [Goblin Nexus] Dynamic Export active credentials to JSON..."
        bun -e '
          const sqlite3 = require("bun:sqlite");
          const fs = require("fs");
          const path = require("path");
          const db = new sqlite3.Database("/home/shobixlinuxdev/.omp/agent/agent.db");
          const rows = db.query("SELECT * FROM auth_credentials;").all();
          const baseSecretDir = "/home/shobixlinuxdev/.shell/secret";
          rows.forEach(r => {
            const provider = r.provider || "unknown";
            const targetDir = path.join(baseSecretDir, provider);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
            let parsed = {};
            try { parsed = JSON.parse(r.data); } catch (e) { parsed = { raw: r.data }; }
            const identifier = parsed.email || parsed.username || (parsed.access ? parsed.access.slice(0, 12) : null) || `id-${r.id}`;
            const cleanId = String(identifier).replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `${cleanId}.json`;
            const filePath = path.join(targetDir, filename);
            const payload = { provider, id: r.id, ...parsed };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            console.log(`✅ [${provider}] Exported -> ${filePath}`);
          });
        '
        ;;
    sync|sy)
        echo "🔄 [Goblin Nexus] Syncing env API keys & credentials to broker..."
        omp auth-broker migrate --from-local --include-env --include-oauth
        ;;
    shield|sh)
        shift
        bash "$GN_DIR/shield.sh" "$@"
        ;;
    agent|a)
        shift
        bash "$GN_DIR/agent.sh" "$@"
        ;;
    restart|r)
        echo "🔄 [Goblin Nexus] Restarting OMP Proxy services..."
        systemctl --user restart omp-broker.service omp-gateway.service
        echo "✅ Services restarted!"
        ;;
    logs|lg)
        journalctl --user -u omp-gateway.service -f
        ;;
    help|h|--help|-h|*)
        show_help
        ;;
esac
