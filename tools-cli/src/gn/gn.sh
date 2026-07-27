#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus UI Helpers & Style Engine
# ─────────────────────────────────────────────────────────────

_has_gum() { command -v gum >/dev/null 2>&1; }

_gn_header() {
    local title="${1:-GOBLIN NEXUS}"
    if _has_gum; then
        gum style \
            --foreground 212 --border-foreground 99 --border double \
            --align center --width 60 --margin "1 0" --padding "0 2" \
            "🧙‍♂️ $title 👹"
    else
        echo "=========================================================="
        echo "  🧙‍♂️ $title 👹"
        echo "=========================================================="
    fi
}

_gn_info() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 117 "ℹ️  $msg"
    else
        echo "ℹ️  $msg"
    fi
}

_gn_success() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 82 "✅ $msg"
    else
        echo "✅ $msg"
    fi
}

_gn_warn() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 214 "⚠️  $msg"
    else
        echo "⚠️  $msg"
    fi
}

_gn_roast_err() {
    local msg="$1"
    local hint="${2:-}"
    if _has_gum; then
        gum style --foreground 196 --bold "🔥 [Goblin Roast Error]" "$msg"
        [ -n "$hint" ] && gum style --foreground 220 "💡 Hint: $hint"
    else
        echo "🔥 [Goblin Roast Error] $msg"
        [ -n "$hint" ] && echo "💡 Hint: $hint"
    fi
}

_gn_spin() {
    local title="$1"
    shift
    if _has_gum; then
        gum spin --spinner dot --title "$title" -- "$@"
    else
        echo "⏳ $title..."
        "$@"
    fi
}

set -euo pipefail

GN_DIR="$(cd "$(dirname "$0")" && pwd)"
ANTIGRAVITY_DIR="$HOME/.shell/secret/antigravity"
OLLAMA_DIR="$HOME/.shell/secret/ollama-cloud"
SECRET_DIR="$HOME/.shell/secret"
POOL_FILE="${GN_POOL_FILE:-/tmp/goblin-pool.json}"
GATEWAY_PORT="${GN_GATEWAY_PORT:-4000}"
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
 ▄▀▀▀ █▀▀▄   █▀▀█ █▀▀7 █▀▀█ █  █ █  █
 █  █ █  █   █▀▀█ █▀▀  █  █ ▀▀▄█ ▀▀▄█
 ▀▀▀▀ ▀  ▀   █    ▀    ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
 Goblin Nexus Proxy CLI v2.3.0 • Powered by OMP Engine

USAGE
  $ gn <command> [options]

CORE COMMANDS
  ping, p [target]       ⚡ Auto-discover & ping latency model AI (default: opencode.jsonc)
  bench, b [target]      📊 Latency & generation throughput benchmark (tok/s)
  status, s [provider]   📈 Cek sisa kuota & usage per-akun terdaftar di broker
  burn, bu [flags]       🔥 Token & cost burn tracker (REST broker + sparkline history)
    --history            Tampilkan sparkline usage history
    --json               Output JSON mentah (untuk piping/scripting)
    --days <int>         Window history (default: 7)
    --provider <id>      Filter 1 provider (e.g. google-antigravity)

ROUTING & POOL
  pool, po <provider>    🔁 Dynamic account pool generator & isolation proxy
    -l, --list           Lihat isi file pool aktif (/tmp/goblin-pool.json)
    -s, --serve          Generate pool & start isolated auth-gateway foreground
    -o, --only <key>     Filter identity key tertentu (dapat diulang)
    --port <port>        Set custom port untuk gateway (default: 4000)
  agent, a [name]        🤖 Ganti model agent OpenCode via interactive TUI
  shield, sh [command]   🛡️ Privacy Shield proxy daemon (regex masking filter)
    enable / disable     Aktifkan/matikan shield & switch port opencode.jsonc
    start / stop         Control interceptor daemon tanpa ganti config
    status / logs        Cek status keaktifan & stream live log sanitization

CREDENTIAL MANAGEMENT
  import, i              📥 Import credential JSON dari ~/.shell/secret/ ke broker DB
  export, e              📤 Export active credentials dari SQLite DB ke JSON vault
  login, l [provider]    🔑 Login akun OAuth / API key provider baru via browser
  sync, sy               🔄 Sync API key dari environment variables ke broker

SERVICE CONTROL
  restart, r             🔄 Restart systemd user services (omp-broker & omp-gateway)
  logs, lg               📋 Live stream log proxy omp-gateway via journalctl
  help, h                📜 Tampilkan panduan penggunaan ini

OPTIONS
  -f, --force            Skip cache & paksa ping/bench ulang
  -s, --select           Pilih model hasil ping/bench untuk update opencode.jsonc

EXAMPLES
  # 1. Core Model Diagnostics
  $ gn ping                              Ping semua model di opencode.jsonc
  $ gn ping all --force                  Ping seluruh model gateway tanpa cache
  $ gn ping --select                     Ping lalu pilih model untuk diaktifkan
  $ gn bench all -s                      Benchmark semua model lalu pilih

  # 2. Account Quota & Status
  $ gn status                            Cek sisa kuota semua akun AI
  $ gn status google-antigravity         Cek kuota khusus provider Google Antigravity

  # 2b. Token & Cost Burn
  $ gn burn                              Token burn per client (REST broker)
  $ gn burn --history --days 14          Dengan sparkline history 14 hari
  $ gn burn --json                       Raw JSON untuk piping/scripting

  # 3. Dynamic Account Pool & Isolation
  $ gn pool google-antigravity           Bangun pool dari semua kredensial Antigravity
  $ gn pool google-antigravity --only user@gmail.com   Pool hanya untuk 1 akun
  $ gn pool --list                       Lihat isi pool file yang sedang aktif
  $ gn pool google-antigravity --serve --port 4005     Launch isolated gateway di port 4005

  # 4. Privacy Shield Proxy
  $ gn shield status                     Cek status Privacy Shield daemon
  $ gn shield enable                     Aktifkan Privacy Shield & auto-routing
  $ gn shield disable                    Matikan Privacy Shield (direct mode)
  $ gn shield logs                       Lihat stream live log sanitization

  # 5. Agent Model Switcher
  $ gn agent                             Pilih agent & ganti model via TUI
  $ gn agent code                        Ganti model khusus untuk agent 'code'

  # 6. Credential Vault Management
  $ gn import                            Import file JSON dari ~/.shell/secret/
  $ gn export                            Export kredensial dari DB ke file JSON
  $ gn login google-antigravity          Login OAuth akun Antigravity baru
  $ gn sync                              Sync API Key dari env vars ke broker

  # 7. Service Control
  $ gn restart                           Restart background service omp-broker & gateway
  $ gn logs                              Lihat live logs dari proxy omp-gateway
HELP
}

case "${1:-}" in
    ping|p)
        shift
        _gn_header "MODEL PING ENGINE"
        run_with_optional_picker ping "$@"
        ;;
    bench|b)
        shift
        _gn_header "MODEL BENCHMARK ENGINE"
        run_with_optional_picker bench "$@"
        ;;
    status|s)
        shift || true
        _gn_header "ACCOUNT QUOTA & USAGE"
        _gn_info "Fetching live usage limit across all authenticated accounts..."
        echo ""
        # Pipe JSON output through the formatter for visual status dots,
        # disabled-credentials warnings, and capacity summary.
        if ! omp usage --json ${1:+"--provider=$1"} \
                | bun "$GN_DIR/status-formatter.ts" ${1:+"--provider=$1"}; then
            _gn_roast_err "Gagal mengambil data kuota dari OMP broker!" "Pastikan service omp-broker aktif (`gn restart`)."
        fi
        ;;
    burn|bu)
        shift
        # In --json mode skip header so the output stays pipe-clean.
        json_mode=false
        for arg in "$@"; do
            if [ "$arg" = "--json" ]; then json_mode=true; break; fi
        done
        if ! $json_mode; then
            _gn_header "TOKEN & COST BURN TRACKER"
        fi
        bun "$GN_DIR/burn.ts" "$@"
        ;;
    import|i)
        _gn_header "CREDENTIAL IMPORTER"
        _gn_spin "Importing credentials from secret vault ($SECRET_DIR)..." bash -c '
            omp auth-broker import "'"$ANTIGRAVITY_DIR"'" 2>/dev/null || true
            omp auth-broker import "'"$OLLAMA_DIR"'" --provider=ollama-cloud 2>/dev/null || true
        '
        _gn_success "Credential import completed!"
        ;;
    login|l)
        prov="${2:-google-antigravity}"
        _gn_header "OAUTH & KEY LOGIN"
        _gn_info "Logging into provider: $prov"
        omp auth-broker login "$prov" || _gn_roast_err "Login terganggu atau dibatalkan!"
        ;;
    export|e)
        _gn_header "DYNAMIC CREDENTIAL EXPORT"
        _gn_info "Exporting active credentials from SQLite DB to $SECRET_DIR..."
        bun -e '
          const sqlite3 = require("bun:sqlite");
          const fs = require("fs");
          const path = require("path");
          const dbPath = process.env.HOME + "/.omp/agent/agent.db";
          if (!fs.existsSync(dbPath)) {
            console.error("❌ Database agent.db tidak ditemukan!");
            process.exit(1);
          }
          const db = new sqlite3.Database(dbPath);
          const rows = db.query("SELECT * FROM auth_credentials;").all();
          const baseSecretDir = process.env.HOME + "/.shell/secret";
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
        ' || _gn_roast_err "Gagal meng-export credential!"
        ;;
    sync|sy)
        _gn_header "CREDENTIAL SYNC"
        _gn_spin "Syncing env API keys & credentials to broker..." omp auth-broker migrate --from-local --include-env --include-oauth
        _gn_success "Sync completed!"
        ;;
    shield|sh)
        shift
        bash "$GN_DIR/shield.sh" "$@"
        ;;
    agent|a)
        shift
        bash "$GN_DIR/agent.sh" "$@"
        ;;
    pool|po)
        shift
        # Modes:
        #   gn pool --list
        #   gn pool <provider> [--only <key> ...] [--serve] [--port <port>]
        list_mode=false
        serve_mode=false
        serve_port="$GATEWAY_PORT"
        pool_provider=""
        pool_only=()
        while [ $# -gt 0 ]; do
            arg="$1"
            case "$arg" in
                -l|--list)
                    list_mode=true
                    shift
                    ;;
                -s|--serve)
                    serve_mode=true
                    shift
                    ;;
                -o|--only)
                    [ $# -ge 2 ] || { echo "❌ --only requires a value" >&2; exit 2; }
                    pool_only+=("$2")
                    shift 2
                    ;;
                --port)
                    [ $# -ge 2 ] || { echo "❌ --port requires a value" >&2; exit 2; }
                    serve_port="$2"
                    shift 2
                    ;;
                -h|--help)
                    show_help
                    exit 0
                    ;;
                --*)
                    echo "❌ unknown flag: $arg" >&2
                    exit 2
                    ;;
                *)
                    if [ -z "$pool_provider" ]; then
                        pool_provider="$arg"
                        shift
                    else
                        echo "❌ unexpected positional arg: $arg" >&2
                        exit 2
                    fi
                    ;;
            esac
        done

        if $list_mode; then
            if [ -f "$POOL_FILE" ]; then
                echo "📄 Pool file: $POOL_FILE"
                cat "$POOL_FILE"
            else
                echo "ℹ️  no pool file at $POOL_FILE (run: gn pool <provider>)"
                exit 1
            fi
            exit 0
        fi

        if [ -z "$pool_provider" ]; then
            echo "❌ gn pool requires a <provider> (e.g. 'google-antigravity') or --list" >&2
            exit 2
        fi

        # Build pool by delegating to the TypeScript helper. Secrets
        # are read-only from ~/.shell/secret; only identity keys end
        # up in /tmp/goblin-pool.json.
        pm_args=("$pool_provider")
        if [ "${#pool_only[@]}" -gt 0 ]; then
            pm_args+=(--only "${pool_only[@]}")
        fi
        GN_SECRET_DIR="$SECRET_DIR" \
        GN_POOL_OUT="$POOL_FILE" \
            bun "$GN_DIR/pool-manager.ts" "${pm_args[@]}"

        if ! $serve_mode; then
            echo "ℹ️  pool ready but gateway NOT started. Use --serve to launch it."
            exit 0
        fi

        # --serve: launch gateway with the pool file injected.
        # We still need OMP_AUTH_BROKER_URL because `omp auth-gateway
        # serve` is itself a broker client — the pool only filters
        # credentials within the broker snapshot.
        broker_url="${OMP_AUTH_BROKER_URL:-http://127.0.0.1:4001}"
        broker_token=""
        if [ -z "${OMP_AUTH_BROKER_TOKEN:-}" ]; then
            token_path="$HOME/.omp/auth-broker.token"
            if [ -f "$token_path" ]; then
                broker_token="$(cat "$token_path")"
            fi
        else
            broker_token="$OMP_AUTH_BROKER_TOKEN"
        fi
        if [ -z "$broker_token" ]; then
            echo "❌ --serve needs OMP_AUTH_BROKER_TOKEN or \$HOME/.omp/auth-broker.token" >&2
            exit 1
        fi

        echo "🚀 Launching omp auth-gateway on 127.0.0.1:${serve_port}"
        echo "   pool: $POOL_FILE"
        echo "   broker: $broker_url"
        exec env \
            OMP_AUTH_BROKER_URL="$broker_url" \
            OMP_AUTH_BROKER_TOKEN="$broker_token" \
            OMP_AUTH_BROKER_ACCOUNT_POOL_FILE="$POOL_FILE" \
            omp auth-gateway serve --bind="127.0.0.1:${serve_port}" --no-auth
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
