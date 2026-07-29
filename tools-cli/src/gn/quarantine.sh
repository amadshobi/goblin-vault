#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus — Credential Quarantine Manager
# Anti-zombie: pindahkan credential exhausted/zombie dari
# SQLite DB agent.db dan .shell/secret/ ke .shell/secret/.quarantine/
# lalu auto-restart service.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

QUARANTINE_DIR="$HOME/.shell/secret/.quarantine"
SECRET_DIR="$HOME/.shell/secret"
OMP_DB="$HOME/.omp/agent/agent.db"
BACKUP_DIR="$QUARANTINE_DIR/backups"

mkdir -p "$QUARANTINE_DIR" "$BACKUP_DIR"

_has_gum() { command -v gum >/dev/null 2>&1; }

_q_success() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 82 "✅ $msg"
    else
        echo "✅ $msg"
    fi
}

_q_warn() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 214 "⚠️  $msg"
    else
        echo "⚠️  $msg"
    fi
}

_q_err() {
    local msg="$1"
    if _has_gum; then
        gum style --foreground 196 --bold "❌ $msg"
    else
        echo "❌ $msg"
    fi
}

# ── Backup SQLite DB sebelum modifikasi (Strict Immutability) ──
_backup_db() {
    local db="$1"
    if [ ! -f "$db" ]; then
        echo ""
        return
    fi
    local ts
    ts=$(date +%Y%m%d_%H%M%S)
    local backup="$BACKUP_DIR/agent-${ts}.db"
    cp "$db" "$backup"
    chmod 600 "$backup"
    echo "$backup"
}

_q_list() {
    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — LIST         ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""

    if [ ! -d "$QUARANTINE_DIR" ]; then
        echo "  (empty — no quarantined credentials)"
        echo ""
        return
    fi

    local total=0
    local any=false
    for prov_dir in "$QUARANTINE_DIR"/*/; do
        [ -d "$prov_dir" ] || continue
        local provider
        provider=$(basename "$prov_dir")
        local count=0
        local files_list=""
        for f in "$prov_dir"/*.json; do
            [ -f "$f" ] || continue
            local name
            name=$(basename "$f" .json)
            files_list="$files_list\n      - $name"
            count=$((count + 1))
        done
        if [ "$count" -gt 0 ]; then
            echo "  🔒 $provider: $count credential(s)"
            echo -e "$files_list"
            total=$((total + count))
            any=true
        fi
    done

    if ! $any; then
        echo "  (empty — no quarantined credentials)"
    else
        echo ""
        _q_success "Total: $total quarantined credential(s)"
    fi
    echo ""
}

_q_add() {
    local provider="${1:-}"
    if [ -z "$provider" ]; then
        _q_err "Usage: gn quarantine add <provider>"
        exit 2
    fi

    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — ADD          ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""

    # 1. Backup DB (immutable safety)
    local backup_path
    backup_path=$(_backup_db "$OMP_DB")
    if [ -n "$backup_path" ]; then
        echo "  ✔ Backup DB: $backup_path"
    fi

    local moved=0

    # 2. Move credential files dari secret vault ke quarantine
    local secret_prov_dir="$SECRET_DIR/$provider"
    local quarantine_prov_dir="$QUARANTINE_DIR/$provider"
    mkdir -p "$quarantine_prov_dir"

    if [ -d "$secret_prov_dir" ]; then
        for f in "$secret_prov_dir"/*.json; do
            [ -f "$f" ] || continue
            local fname
            fname=$(basename "$f")
            mv "$f" "$quarantine_prov_dir/$fname"
            echo "  🔒 Moved: $f → $quarantine_prov_dir/$fname"
            moved=$((moved + 1))
        done
    fi

    # 3. Mark credentials di SQLite sebagai quarantined
    if [ -f "$OMP_DB" ] && command -v bun >/dev/null 2>&1; then
        bun -e "
        const fs = require('fs');
        const { Database } = require('bun:sqlite');
        const dbPath = '$OMP_DB';
        const provider = '$provider';
        if (!fs.existsSync(dbPath)) process.exit(0);
        const db = new Database(dbPath);
        const rows = db.query('SELECT id, data FROM auth_credentials WHERE provider LIKE ?').all(provider);
        let updated = 0;
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.data);
                parsed.quarantined = true;
                parsed.quarantined_at = Date.now();
                db.query('UPDATE auth_credentials SET data = ? WHERE id = ?').run(JSON.stringify(parsed), row.id);
                updated++;
            } catch (_) {}
        }
        db.close();
        console.log('  ✔ SQLite: ' + updated + ' credential(s) marked as quarantined');
        "
    fi

    # 4. Restart services
    echo ""
    echo "  🔄 Restarting OMP services..."
    systemctl --user restart omp-broker.service 2>/dev/null || _q_warn "Gagal restart omp-broker.service"
    systemctl --user restart omp-gateway.service 2>/dev/null || _q_warn "Gagal restart omp-gateway.service"

    echo ""
    _q_success "Quarantine complete! ${moved} file(s) moved, service restarted."
    echo "  To restore: gn quarantine restore $provider"
    echo ""
}

_q_restore() {
    local provider="${1:-}"
    if [ -z "$provider" ]; then
        _q_err "Usage: gn quarantine restore <provider>"
        exit 2
    fi

    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — RESTORE      ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""

    local quarantine_prov_dir="$QUARANTINE_DIR/$provider"
    local secret_prov_dir="$SECRET_DIR/$provider"

    if [ ! -d "$quarantine_prov_dir" ]; then
        _q_err "No quarantined credentials for provider '$provider'"
        exit 1
    fi

    mkdir -p "$secret_prov_dir"
    local restored=0

    for f in "$quarantine_prov_dir"/*.json; do
        [ -f "$f" ] || continue
        local fname
        fname=$(basename "$f")
        mv "$f" "$secret_prov_dir/$fname"
        echo "  ♻️  Restored: $f → $secret_prov_dir/$fname"
        restored=$((restored + 1))
    done

    # Unmark quarantine di SQLite
    if [ -f "$OMP_DB" ] && command -v bun >/dev/null 2>&1; then
        bun -e "
        const fs = require('fs');
        const { Database } = require('bun:sqlite');
        const dbPath = '$OMP_DB';
        const provider = '$provider';
        if (!fs.existsSync(dbPath)) process.exit(0);
        const db = new Database(dbPath);
        const rows = db.query('SELECT id, data FROM auth_credentials WHERE provider LIKE ?').all(provider);
        let updated = 0;
        for (const row of rows) {
            try {
                const parsed = JSON.parse(row.data);
                if (parsed.quarantined) {
                    delete parsed.quarantined;
                    delete parsed.quarantined_at;
                    db.query('UPDATE auth_credentials SET data = ? WHERE id = ?').run(JSON.stringify(parsed), row.id);
                    updated++;
                }
            } catch (_) {}
        }
        db.close();
        console.log('  ✔ SQLite: ' + updated + ' credential(s) restored');
        "
    fi

    # Clean up empty quarantine provider dir
    rmdir "$quarantine_prov_dir" 2>/dev/null || true

    echo ""
    echo "  🔄 Restarting OMP services..."
    systemctl --user restart omp-broker.service 2>/dev/null || _q_warn "Gagal restart omp-broker.service"
    systemctl --user restart omp-gateway.service 2>/dev/null || _q_warn "Gagal restart omp-gateway.service"

    echo ""
    _q_success "Restore complete! ${restored} file(s) restored, service restarted."
    echo ""
}

# ── Main ──
case "${1:-}" in
    list|l|-l|--list)
        _q_list
        ;;
    add|a)
        shift
        _q_add "${1:-}"
        ;;
    restore|r)
        shift
        _q_restore "${1:-}"
        ;;
    *)
        echo ""
        echo "  ╔══════════════════════════════════════════════╗"
        echo "  ║   GN QUARANTINE — Credential Sanitizer     ║"
        echo "  ╚══════════════════════════════════════════════╝"
        echo ""
        echo "  USAGE"
        echo "    gn quarantine <command> [args]"
        echo "    gn q <command> [args]"
        echo ""
        echo "  COMMANDS"
        echo "    list, l              Lihat credential yang di-quarantine"
        echo "    add, a <provider>    Pindahkan credential provider ke quarantine"
        echo "    restore, r <provider> Kembalikan credential dari quarantine"
        echo ""
        echo "  EXAMPLES"
        echo "    gn q list                       Lihat daftar quarantine"
        echo "    gn q add google-antigravity     Quarantine credential AGY"
        echo "    gn q restore ollama-cloud       Restore credential Ollama"
        echo ""
        ;;
esac
