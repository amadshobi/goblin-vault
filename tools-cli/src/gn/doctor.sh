#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus — Full-Chain System & Credential Health Doctor
# Diagnostik menyeluruh: service status, port, database,
# token auth, gateway API, dan kesehatan credential
# ─────────────────────────────────────────────────────────────
set -euo pipefail

_has_gum() { command -v gum >/dev/null 2>&1; }

_echo() {
    local color="$1"
    local prefix="$2"
    local msg="$3"
    if _has_gum; then
        gum style --foreground "$color" "$prefix $msg"
    else
        echo "$prefix $msg"
    fi
}

_info()    { _echo "117" "ℹ️"  "$1"; }
_ok()      { _echo "82"  "✅" "$1"; }
_warn()    { _echo "214" "⚠️" "$1"; }
_err()     { _echo "196" "❌" "$1"; }

_doctor_run() {
    local exit_code=0

    echo ""
    echo "  ╔══════════════════════════════════════════════════════╗"
    echo "  ║      GOBLIN NEXUS — SYSTEM DOCTOR                   ║"
    echo "  ║      Full-Chain Health Diagnostic                   ║"
    echo "  ╚══════════════════════════════════════════════════════╝"
    echo ""

    # ── 1. Service Status ──
    _info "Checking OMP service status..."
    for svc in omp-broker.service omp-gateway.service; do
        if systemctl --user is-active --quiet "$svc" 2>/dev/null; then
            _ok "$svc is running"
        else
            _err "$svc is NOT running"
            exit_code=1
        fi
    done
    echo ""

    # ── 2. Port Check ──
    _info "Checking gateway ports..."
    for port in 4000 4001; do
        if ss -tlnp "sport = :$port" 2>/dev/null | grep -q ":$port"; then
            _ok "Port $port is listening"
        else
            _warn "Port $port is NOT listening (may be intentional)"
        fi
    done
    echo ""

    # ── 3. SQLite Database ──
    _info "Checking OMP Agent database..."
    local db_path="$HOME/.omp/agent/agent.db"
    if [ -f "$db_path" ]; then
        local db_size
        db_size=$(stat -c%s "$db_path" 2>/dev/null || echo 0)
        if [ "$db_size" -gt 0 ]; then
            _ok "agent.db found ($((db_size / 1024)) KB)"
        else
            _warn "agent.db is empty"
        fi
    else
        _err "agent.db NOT FOUND at $db_path"
        exit_code=1
    fi
    echo ""

    # ── 4. Broker Token ──
    _info "Checking broker authentication..."
    if [ -n "${OMP_AUTH_BROKER_TOKEN:-}" ]; then
        _ok "OMP_AUTH_BROKER_TOKEN is set (env)"
    elif [ -f "$HOME/.omp/auth-broker.token" ]; then
        local tok
        tok=$(cat "$HOME/.omp/auth-broker.token" 2>/dev/null || true)
        if [ -n "$tok" ]; then
            _ok "auth-broker.token found at ~/.omp/"
        else
            _warn "auth-broker.token is empty"
        fi
    else
        _warn "No broker token found (set OMP_AUTH_BROKER_TOKEN or create ~/.omp/auth-broker.token)"
    fi
    echo ""

    # ── 5. Gateway Health via API ──
    _info "Pinging gateway API (port 4000)..."
    if command -v curl >/dev/null 2>&1; then
        local gw_status
        gw_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4000/v1/models" 2>/dev/null || echo "000")
        case "$gw_status" in
            200) _ok "Gateway API responds 200 OK" ;;
            000) _warn "Gateway API unreachable (connection refused)" ;;
            *)   _warn "Gateway API returned HTTP $gw_status" ;;
        esac
    else
        _warn "curl not available, skipping gateway API check"
    fi
    echo ""

    # ── 6. Credential Health ──
    _info "Scanning credential health..."
    if command -v bun >/dev/null 2>&1 && [ -f "$db_path" ]; then
        local health
        health=$(bun -e "
        const fs = require('fs');
        const { Database } = require('bun:sqlite');
        const dbPath = '$db_path';
        if (!fs.existsSync(dbPath)) { console.log('0|0|0'); process.exit(0); }
        const db = new Database(dbPath, { readonly: true });
        const rows = db.query('SELECT provider, data FROM auth_credentials').all();
        let total = 0;
        let ex = 0;
        let providers = [];
        for (const row of rows) {
            total++;
            const p = row.provider || 'unknown';
            if (!providers.includes(p)) providers.push(p);
            try {
                const d = JSON.parse(row.data);
                if (d.quarantined || d.exhausted) ex++;
            } catch (_) {}
        }
        db.close();
        console.log(total + '|' + ex + '|' + providers.join(','));
        " 2>/dev/null || echo "0|0|")
        local total_creds="${health%%|*}"
        local rest="${health#*|}"
        local exhausted_creds="${rest%%|*}"
        local providers_list="${rest#*|}"

        if [ "$total_creds" -gt 0 ]; then
            _ok "$total_creds credential(s) registered in DB"
            _info "Providers: ${providers_list:-none}"
            if [ "$exhausted_creds" -gt 0 ]; then
                _warn "$exhausted_creds credential(s) are quarantined/exhausted"
                _info "Run 'gn quarantine list' for details"
            fi
        else
            _warn "No credentials found in database (run 'gn export' first?)"
        fi
    else
        _warn "bun not available or DB missing, skipping credential health check"
    fi
    echo ""

    # ── 7. Secret Vault ──
    _info "Checking secret vault..."
    local secret_dir="$HOME/.shell/secret"
    if [ -d "$secret_dir" ]; then
        local secret_count
        secret_count=$(find "$secret_dir" -maxdepth 2 -name "*.json" 2>/dev/null | wc -l)
        _ok "Secret vault found with $secret_count credential file(s)"
    else
        _warn "Secret vault not found at $secret_dir"
    fi
    echo ""

    # ── Summary ──
    echo "  ────────────────────────────────────────────────────"
    if [ "$exit_code" -eq 0 ]; then
        echo "  🟢 All checks passed! Sistem sehat."
    else
        echo "  🔴 $exit_code check(s) failed. Perbaiki issue di atas."
    fi
    echo ""

    return "$exit_code"
}

# ── Main ──
case "${1:-}" in
    --help|-h)
        echo ""
        echo "🧙‍♂️ GN DOCTOR — Full-Chain System & Credential Health Diagnostic"
        echo ""
        echo "DESKRIPSI"
        echo "  Memeriksa kesehatan full-chain: service status, port, database,"
        echo "  token authentication, gateway API, dan kesehatan credential."
        echo ""
        echo "USAGE"
        echo "  gn doctor"
        echo "  gn doc"
        echo ""
        echo "EXAMPLES"
        echo "  \$ gn doctor    Jalankan diagnostic full-chain"
        echo ""
        ;;
    *)
        _doctor_run
        ;;
esac
