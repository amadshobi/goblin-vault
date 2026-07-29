#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus — Control-Plane CLI
# Ultra-clean command router untuk diagnostik, benchmark,
# quota tracking, credential management, dan service control.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GN_DIR="$(cd "$(dirname "$0")" && pwd)"
SECRET_DIR="$HOME/.shell/secret"
GATEWAY_PORT="${GN_GATEWAY_PORT:-4000}"

mkdir -p "$SECRET_DIR"

# Source Level 2 Contextual Help Formatter
source "$GN_DIR/help-formatter.sh"

_has_gum() { command -v gum >/dev/null 2>&1; }

_gn_header() {
    local title="${1:-GOBLIN NEXUS}"
    echo ""
    echo -e "\033[1;37m  ██████╗ ███╗   ██╗\033[0m"
    echo -e "\033[1;37m ██╔════╝ ████╗  ██║\033[0m"
    echo -e "\033[1;37m ██║  ███╗██╔██╗ ██║\033[0m"
    echo -e "\033[1;37m ██║   ██║██║╚██╗██║\033[0m"
    echo -e "\033[1;37m ╚██████╔╝██║ ╚████║\033[0m"
    echo -e "\033[1;37m  ╚═════╝ ╚═╝  ╚═══╝\033[0m"
    echo -e "  \033[1;37m   Goblin Nexus\033[0m \033[1;37m\n $title\033[0m\n"
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

_is_help_requested() {
    for arg in "$@"; do
        if [ "$arg" = "--help" ] || [ "$arg" = "-h" ]; then
            return 0
        fi
    done
    return 1
}

# ── HELP ──
show_help() {
    echo ""
    echo -e "\033[1;37m  ██████╗ ███╗   ██╗\033[0m"
    echo -e "\033[1;37m ██╔════╝ ████╗  ██║\033[0m"
    echo -e "\033[1;37m ██║  ███╗██╔██╗ ██║\033[0m"
    echo -e "\033[1;37m ██║   ██║██║╚██╗██║\033[0m"
    echo -e "\033[1;37m ╚██████╔╝██║ ╚████║\033[0m"
    echo -e "\033[1;37m  ╚═════╝ ╚═╝  ╚═══╝\033[0m"
    echo -e "  \033[1;37m   Goblin Nexus\033[0m \033[1;37m\n Powered by OMP Engine\033[0m\n"
    cat <<'HELP'
USAGE
  $ gn <command> [subcommand_or_flags]
  $ gn <command> --help                     💡 Panduan mendalam per-command!

DIAGNOSTICS & BENCHMARK
  ping, p [target]       ⚡ Health check & latensi model AI
  bench, b [target]      📊 Benchmark sederhana (TTFT, tok/s, latency)

QUOTA & COST TRACKING
  usage, u [provider]    📈 Dashboard kuota live + token burn & cost tracker
  price, prc             💰 Custom pricing engine — list/set/calc per-1M token

CREDENTIAL MANAGEMENT
  quarantine, q <cmd>    🔒 Karantina credential zombie/exhausted (list|add|restore)
  export, e              📤 Export credential SQLite ke JSON vault

SERVICE CONTROL
  doctor, doc            🩺 Full-chain system & credential health diagnostic
  restart, r             🔄 Restart systemd user services (omp-broker, omp-gateway)
  logs, lg               📜 Live stream proxy logs

  help, h [command]      📜 Tampilkan panduan ini atau level-2 help per command

EXAMPLES
  $ gn ping               Ping model dari opencode.jsonc
  $ gn bench --provider google-antigravity   Benchmark provider tertentu
  $ gn usage              Dashboard kuota + token burn
  $ gn doctor             Full diagnostic
  $ gn q list             Lihat credential ter-quarantine
  $ gn q add ollama-cloud  Karantina semua credential Ollama
  $ gn price                 Lihat tabel harga per 1M token
  $ gn price set anthropic claude-sonnet-4 --input 3.00 --output 15.00
HELP
}

# ── PING & BENCH: delegasi ke bench.ts ──
_run_bench_action() {
    local action="$1"
    shift

    if _is_help_requested "$@"; then
        _gn_header "HELP MANUAL: GN ${action^^}"
        _show_subcommand_help "$action"
        return 0
    fi

    _gn_header "MODEL ${action^^} ENGINE"
    bun "$GN_DIR/bench.ts" "$action" "$@"
}

# ── COMMAND ROUTER ──
case "${1:-}" in
    ping|p)
        shift
        _run_bench_action ping "$@"
        ;;
    bench|b)
        shift
        _run_bench_action bench "$@"
        ;;
    usage|u)
        shift
        if _is_help_requested "$@"; then
            _gn_header "HELP MANUAL: GN USAGE"
            _show_subcommand_help "usage"
            exit 0
        fi

        # Delegate langsung ke usage.ts — engine tunggal untuk quota & token burn
        bun "$GN_DIR/usage.ts" "$@"
        ;;
    doctor|doc)
        shift
        if _is_help_requested "$@"; then
            _gn_header "HELP MANUAL: GN DOCTOR"
            _show_subcommand_help "doctor"
            exit 0
        fi
        bash "$GN_DIR/doctor.sh" "$@"
        ;;
    quarantine|q)
        shift
        if _is_help_requested "$@"; then
            _gn_header "HELP MANUAL: GN QUARANTINE"
            _show_subcommand_help "quarantine"
            exit 0
        fi
        bash "$GN_DIR/quarantine.sh" "$@"
        ;;
    price|prc)
        shift
        if _is_help_requested "$@"; then
            _gn_header "HELP MANUAL: GN PRICE"
            _show_subcommand_help "price"
            exit 0
        fi
        bun "$GN_DIR/price.ts" "$@"
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
            const identifier = parsed.email || parsed.username || (parsed.access ? parsed.access.slice(0, 12) : null) || "id-" + r.id;
            const cleanId = String(identifier).replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = cleanId + ".json";
            const filePath = path.join(targetDir, filename);
            const payload = { provider, id: r.id, ...parsed };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            console.log("✅ [" + provider + "] Exported -> " + filePath);
          });
        ' || _gn_roast_err "Gagal meng-export credential!"
        ;;
    restart|r)
        echo "🔄 [Goblin Nexus] Restarting OMP Proxy services..."
        systemctl --user restart omp-broker.service omp-gateway.service
        echo "✅ Services restarted!"
        ;;
    logs|lg)
        journalctl --user -u omp-gateway.service -f
        ;;
    help|h|--help|-h)
        subcmd="${2:-}"
        if [ -n "$subcmd" ]; then
            _gn_header "HELP MANUAL: GN ${subcmd^^}"
            _show_subcommand_help "$subcmd"
        else
            show_help
        fi
        ;;
    *)
        show_help
        ;;
esac
