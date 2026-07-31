#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus — Credential Quarantine Manager
# Anti-zombie: pindahkan credential exhausted/zombie dari
# SQLite DB agent.db dan .shell/secret/ ke .shell/secret/.quarantine/
# lalu auto-restart service.
#
# Granular Target — _q_add <target> mendukung:
#   1. Provider name (e.g. google-antigravity)  → quarantine seluruh provider
#   2. Email spesifik (e.g. sohibwong102@gmail.com) → quarantine single akun
#   3. Project ID / Account ID (e.g. rare-data-6vp89) → quarantine single proyek
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
        return
    fi
    local ts
    ts=$(date +%Y%m%d_%H%M%S)
    local backup="$BACKUP_DIR/agent-${ts}.db"
    cp "$db" "$backup"
    chmod 600 "$backup"
    echo "$backup"
}

# ── Resolve target type: provider vs email/projectId/accountId ──
# Output: "provider|<prov_name>"  or  "credential|<matched_field>|<value>"
_q_resolve_target() {
    local target="$1"
    if [ -z "$target" ]; then
        echo "error"
        return
    fi

    # 1. Cek apakah target cocok dengan nama provider yang ada di DB
    if [ -f "$OMP_DB" ] && command -v bun >/dev/null 2>&1; then
        local provider_match
        provider_match=$(bun -e "
        const fs = require('fs');
        const { Database } = require('bun:sqlite');
        const dbPath = '$OMP_DB';
        if (!fs.existsSync(dbPath)) process.exit(0);
        const db = new Database(dbPath, { readonly: true });
        const rows = db.query('SELECT DISTINCT provider FROM auth_credentials WHERE provider = ?').all('$target');
        db.close();
        if (rows.length > 0) {
            process.stdout.write('provider|' + rows[0].provider);
        }
        " 2>/dev/null || echo "")
        if [ -n "$provider_match" ]; then
            echo "$provider_match"
            return
        fi
    fi

    # 2. Cek juga apakah ada folder provider dengan nama tsb di secret vault
    if [ -d "$SECRET_DIR/$target" ]; then
        echo "provider|$target"
        return
    fi

    # 3. Fallback: treat as credential search (email/projectId/accountId)
    echo "credential|any|$target"
}

# ── LIST: Tampilkan daftar akun ter-karantina dengan info lengkap ──
_q_list() {
    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — LIST         ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""

    local total=0
    local any=false

    # 1. Scan quarantine files (files dengan extension .quarantine)
    if [ -d "$QUARANTINE_DIR" ]; then
        for qfile in "$QUARANTINE_DIR"/*.quarantine; do
            # Skip folder backups (jika di-glob karena nama kebetulan match)
            case "$(basename "$qfile")" in
                backups) continue ;;
            esac
            [ -f "$qfile" ] || continue
            local qfname
            qfname=$(basename "$qfile")
            # Extract original filename (strip .TIMESTAMP.quarantine suffix)
            local orig_name
            orig_name=$(echo "$qfname" | sed -E 's/\.[0-9]{4}[-]?[0-9]{2}[-]?[0-9]{2}[T_-]?[0-9-]+Z?\.quarantine$//')
            [ -z "$orig_name" ] && orig_name="$qfname"
            local info
            info=$(bun -e "
            const fs = require('fs');
            try {
              const parsed = JSON.parse(fs.readFileSync('$qfile', 'utf-8'));
              const email = parsed.email || '-';
              const projectId = parsed.projectId || parsed.accountId || '-';
              const provider = parsed.provider || '-';
              const qAt = parsed.quarantined_at || parsed._quarantined_at;
              let date = '(unknown)';
              if (qAt) date = new Date(qAt).toISOString().slice(0, 19).replace('T', ' ');
              // Also try extracting date from filename
              const m = '$qfname'.match(/\\.(\\d{4}[-_]?\\d{2}[-_]?\\d{2}[T_-]?[\\d-]*)/);
              if (!qAt && m) date = m[1].replace('T', ' ').slice(0, 19);
              console.log(\`\${email}|\${projectId}|\${provider}|\${date}\`);
            } catch (e) {
              console.log('parse_error|-|-|-');
            }
            " 2>/dev/null || echo "|-|-|-")
            IFS='|' read -r q_email q_project q_provider q_date <<< "$info"
            echo "  🔒 [$q_provider] $orig_name"
            echo "     Email       : $q_email"
            echo "     Project/ID  : $q_project"
            echo "     Quarantined : $q_date"
            echo "     File        : $qfname"
            echo ""
            total=$((total + 1))
            any=true
        done
    fi

    # 2. Scan quarantined credentials in SQLite (data.quarantined = true)
    if [ -f "$OMP_DB" ] && command -v bun >/dev/null 2>&1; then
        local sqlite_list
        sqlite_list=$(bun -e "
        const fs = require('fs');
        const { Database } = require('bun:sqlite');
        const dbPath = '$OMP_DB';
        if (!fs.existsSync(dbPath)) process.exit(0);
        const db = new Database(dbPath, { readonly: true });
        const rows = db.query('SELECT id, provider, data FROM auth_credentials').all();
        const out = [];
        for (const r of rows) {
          try {
            const parsed = JSON.parse(r.data);
            if (parsed.quarantined) {
              const email = parsed.email || '-';
              const projectId = parsed.projectId || parsed.accountId || '-';
              const qAt = parsed.quarantined_at;
              const date = qAt ? new Date(qAt).toISOString().slice(0, 19).replace('T', ' ') : '(unknown)';
              out.push(\`\${r.id}|\${r.provider}|\${email}|\${projectId}|\${date}\`);
            }
          } catch {}
        }
        db.close();
        process.stdout.write(out.join('\n'));
        " 2>/dev/null || echo "")
        if [ -n "$sqlite_list" ]; then
            while IFS= read -r line; do
                [ -z "$line" ] && continue
                IFS='|' read -r q_id q_provider q_email q_project q_date <<< "$line"
                echo "  🔒 (sqlite) [$q_provider] id=$q_id"
                echo "     Email       : $q_email"
                echo "     Project/ID  : $q_project"
                echo "     Quarantined : $q_date"
                echo ""
                total=$((total + 1))
                any=true
            done <<< "$sqlite_list"
        fi
    fi

    if ! $any; then
        echo "  (empty — no quarantined credentials)"
    else
        _q_success "Total: $total quarantined credential(s)"
    fi
    echo ""
}

# ── ADD: Quarantine by provider, email, or projectId ──
_q_add() {
    local target="${1:-}"
    if [ -z "$target" ]; then
        _q_err "Usage: gn quarantine add <provider|email|projectId|accountId>"
        exit 2
    fi

    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — ADD          ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""
    echo "  🎯 Target: $target"

    # Resolve target type
    local resolved
    resolved=$(_q_resolve_target "$target")
    local target_type target_value
    IFS='|' read -r target_type target_value _ <<< "$resolved"

    if [ "$target_type" = "error" ]; then
        _q_err "Target kosong atau tidak valid."
        exit 2
    fi

    echo "  📋 Resolved mode: $target_type"
    echo ""

    # 1. Backup DB (mandatory sebelum delete)
    local backup_path=""
    if [ -f "$OMP_DB" ]; then
        backup_path=$(_backup_db "$OMP_DB")
        echo "  ✔ Backup DB: $backup_path"
    fi

    local moved_files=0
    local deleted_rows=0

    # 2. SQLite operations
    if [ -f "$OMP_DB" ] && command -v bun >/dev/null 2>&1; then
        local sqlite_result
        sqlite_result=$(bun -e "
        const fs = require('fs');
        const path = require('path');
        const { Database } = require('bun:sqlite');
        const dbPath = '$OMP_DB';
        const targetType = '$target_type';
        const targetValue = $(printf '%s' "$target_value" | bun -e 'process.stdin.on("data", d=>process.stdout.write(JSON.stringify(d.toString().trim())))' || echo '""');
        const fallbackTarget = $(printf '%s' "$target" | bun -e 'process.stdin.on("data", d=>process.stdout.write(JSON.stringify(d.toString().trim())))' || echo '""');

        if (!fs.existsSync(dbPath)) { console.log('0|0|no_db'); process.exit(0); }
        const db = new Database(dbPath);

        // Find rows to delete
        let matchingRows = [];
        if (targetType === 'provider') {
            matchingRows = db.query('SELECT id, provider, data FROM auth_credentials WHERE provider = ?').all(targetValue);
        } else {
            // Search by email, projectId, accountId (LIKE substring)
            const pattern = '%' + (targetValue && targetValue !== 'any' ? targetValue : fallbackTarget) + '%';
            const allRows = db.query('SELECT id, provider, data FROM auth_credentials').all();
            for (const row of allRows) {
                try {
                    const parsed = JSON.parse(row.data);
                    const searchable = JSON.stringify(parsed);
                    if (searchable.toLowerCase().includes(pattern.toLowerCase().slice(1, -1))) {
                        matchingRows.push(row);
                    }
                } catch {}
            }
        }

        if (matchingRows.length === 0) {
            console.log('0|0|no_match');
            db.close();
            process.exit(0);
        }

        let moved = 0;
        let deleted = 0;
        for (const row of matchingRows) {
            // 1. Move JSON file ke .quarantine/
            try {
                const parsed = JSON.parse(row.data);
                const secretDir = process.env.HOME + '/.shell/secret';
                const qDir = secretDir + '/.quarantine';
                const provider = row.provider;
                const email = parsed.email || ('id-' + row.id);
                const cleanName = String(email).replace(/[^a-zA-Z0-9_-]/g, '_');
                const fname = cleanName + '.json';
                const srcPath = path.join(secretDir, provider, fname);
                if (fs.existsSync(srcPath)) {
                    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const dstPath = path.join(qDir, fname + '.' + ts + '.quarantine');
                    fs.renameSync(srcPath, dstPath);
                    try { fs.chmodSync(dstPath, 0o600); } catch {}
                    moved++;
                    console.error('MOVED:' + dstPath);
                }
            } catch (e) {}

            // 2. Delete from auth_credentials
            db.query('DELETE FROM auth_credentials WHERE id = ?').run(row.id);
            // 3. Delete from related tables
            db.query('DELETE FROM auth_credential_blocks WHERE credential_id = ?').run(row.id);
            db.query('DELETE FROM auth_credential_refresh_leases WHERE credential_id = ?').run(row.id);
            deleted++;
        }

        db.close();
        console.log(moved + '|' + deleted + '|ok');
        " 2>&1)
        # Parse result (skip stderr lines starting with MOVED:)
        local result_line
        result_line=$(echo "$sqlite_result" | { grep -E '^[0-9]+\|[0-9]+\|' || true; } | head -1)
        local move_count del_count status
        IFS='|' read -r move_count del_count status <<< "$result_line"
        moved_files=$move_count
        deleted_rows=$del_count

        # Log MOVED events ke stdout (handle empty match gracefully)
        { echo "$sqlite_result" | grep '^MOVED:' | sed 's/^MOVED:/  🔒 Moved file: /' | sed "s|$HOME|~|" | head -10; } || true

        if [ "$status" = "no_match" ]; then
            _q_warn "Tidak ada credential di SQLite yang cocok dengan target '$target'."
            # No SQLite match, but files might still exist
        fi
    fi

    # 3. Fallback: scan secret vault files jika SQLite tidak menemukan apa-apa
    if [ "$moved_files" -eq 0 ] && [ "$deleted_rows" -eq 0 ]; then
        local fallback_moved
        fallback_moved=$(bun -e "
        const fs = require('fs');
        const path = require('path');
        const target = $(printf '%s' "$target" | bun -e 'process.stdin.on("data", d=>process.stdout.write(JSON.stringify(d.toString().trim())))' || echo '""');
        const secretDir = '$SECRET_DIR';
        const qDir = '$QUARANTINE_DIR';
        let moved = 0;
        if (fs.existsSync(secretDir)) {
            for (const prov of fs.readdirSync(secretDir)) {
                const provDir = path.join(secretDir, prov);
                if (!fs.statSync(provDir).isDirectory()) continue;
                if (prov.startsWith('.')) continue;
                for (const file of fs.readdirSync(provDir)) {
                    if (!file.endsWith('.json')) continue;
                    const fullPath = path.join(provDir, file);
                    try {
                        const content = fs.readFileSync(fullPath, 'utf-8');
                        // Match: filename mengandung target, atau JSON content mengandung target
                        const lcTarget = target.toLowerCase();
                        if (file.toLowerCase().includes(lcTarget.replace(/@/g, '_')) ||
                            content.toLowerCase().includes(lcTarget)) {
                            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                            const dst = path.join(qDir, file + '.' + ts + '.quarantine');
                            fs.renameSync(fullPath, dst);
                            try { fs.chmodSync(dst, 0o600); } catch {}
                            moved++;
                            console.error('FALLBACK_MOVED:' + dst);
                        }
                    } catch {}
                }
            }
        }
        console.log(moved);
        " 2>&1)
        local fb_moved
        fb_moved=$(echo "$fallback_moved" | tail -1)
        if [[ "$fb_moved" =~ ^[0-9]+$ ]]; then
            moved_files=$fb_moved
        fi
        echo "$fallback_moved" | { grep '^FALLBACK_MOVED:' || true; } | sed 's/^FALLBACK_MOVED:/  🔒 File moved: /' | sed "s|$HOME|~|" | head -10
    fi

    # 4. Validation: pastikan minimal SATU hal ter-kuarantine
    if [ "$moved_files" -eq 0 ] && [ "$deleted_rows" -eq 0 ]; then
        _q_warn "Tidak ditemukan credential cocok untuk '$target' (cek ejaan/email/projectId)."
        _q_warn "DB tetap aman (backup tidak di-restore). Tidak ada perubahan."
        echo ""
        return 0
    fi

    # 5. Restart services
    echo ""
    echo "  🔄 Restarting OMP services..."
    if command -v systemctl >/dev/null 2>&1; then
        systemctl --user restart omp-broker.service 2>/dev/null && echo "  ✔ omp-broker restarted" || _q_warn "Gagal restart omp-broker.service"
        systemctl --user restart omp-gateway.service 2>/dev/null && echo "  ✔ omp-gateway restarted" || _q_warn "Gagal restart omp-gateway.service"
    fi

    echo ""
    _q_success "Quarantine selesai: ${deleted_rows} row(s) dihapus dari SQLite, ${moved_files} file JSON dipindahkan."
    echo "  📦 Backup DB: $backup_path"
    echo "  🔍 Untuk melihat: gn q list"
    if [ "$target_type" = "provider" ]; then
        echo "  ♻️  Untuk restore: gn q restore $target_value"
    else
        echo "  ♻️  Untuk restore: gn q restore $target"
    fi
    echo ""
}

# ── RESTORE: Kembalikan credential dari quarantine ──
_q_restore() {
    local target="${1:-}"
    if [ -z "$target" ]; then
        _q_err "Usage: gn quarantine restore <email|projectId|filename>"
        exit 2
    fi

    echo ""
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║     CREDENTIAL QUARANTINE — RESTORE      ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo ""
    echo "  🎯 Target: $target"

    # 1. Backup DB sebelum insert
    local backup_path=""
    if [ -f "$OMP_DB" ]; then
        backup_path=$(_backup_db "$OMP_DB")
        echo "  ✔ Backup DB: $backup_path"
    fi

    local restored_files=0
    local restored_rows=0

    # 2. Scan quarantine directory
    if [ -d "$QUARANTINE_DIR" ]; then
        local matches
        matches=$(bun -e "
        const fs = require('fs');
        const path = require('path');
        const target = $(printf '%s' "$target" | bun -e 'process.stdin.on("data", d=>process.stdout.write(JSON.stringify(d.toString().trim())))' || echo '""');
        const qDir = '$QUARANTINE_DIR';
        const secretDir = '$SECRET_DIR';
        const lcTarget = target.toLowerCase().replace(/@/g, '_');
        const out = [];
        for (const file of fs.readdirSync(qDir)) {
            if (!file.endsWith('.quarantine')) continue;
            const lcFile = file.toLowerCase();
            const fullPath = path.join(qDir, file);
            try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const lcContent = content.toLowerCase();
                if (lcFile.includes(lcTarget) || lcContent.includes(target.toLowerCase())) {
                    // Match! Extract original filename (strip .TIMESTAMP.quarantine)
                    const m = file.match(/^(.+?)\\.\\d{4}[-]?\\d{2}[-]?\\d{2}[T_-]?\\d*[-\\d]*\\.quarantine\$/);
                    const origName = m ? m[1] : file.replace(/\\..*\\.quarantine\$/, '');
                    // Determine provider from content
                    let provider = 'unknown';
                    try {
                        const parsed = JSON.parse(content);
                        provider = parsed.provider || 'unknown';
                    } catch {}
                    const dstDir = path.join(secretDir, provider);
                    const dstPath = path.join(dstDir, origName);
                    out.push(JSON.stringify({src: fullPath, dst: dstPath, provider, file}));
                }
            } catch {}
        }
        process.stdout.write(out.join('\n'));
        " 2>/dev/null || echo "")

        if [ -n "$matches" ]; then
            while IFS= read -r match_line; do
                [ -z "$match_line" ] && continue
                local src dst provider fname
                src=$(echo "$match_line" | bun -e 'process.stdin.on("data", d=>{const j=JSON.parse(d.toString().trim());process.stdout.write(j.src)})' 2>/dev/null)
                dst=$(echo "$match_line" | bun -e 'process.stdin.on("data", d=>{const j=JSON.parse(d.toString().trim());process.stdout.write(j.dst)})' 2>/dev/null)
                provider=$(echo "$match_line" | bun -e 'process.stdin.on("data", d=>{const j=JSON.parse(d.toString().trim());process.stdout.write(j.provider)})' 2>/dev/null)

                # Ensure dst dir exists
                mkdir -p "$(dirname "$dst")"
                # Move file back
                if mv "$src" "$dst" 2>/dev/null; then
                    chmod 600 "$dst" 2>/dev/null || true
                    echo "  ♻️  Restored: $src → $dst"
                    restored_files=$((restored_files + 1))
                    # Track fname for SQLite re-insert
                    fname=$(basename "$dst" .json)
                fi
            done <<< "$matches"
        fi
    fi

    # 3. Trigger OMP migrate (sinkronisasi DB dari local secrets)
    if [ "$restored_files" -gt 0 ] && command -v omp >/dev/null 2>&1; then
        echo ""
        echo "  🔄 Triggering omp auth-broker migrate --from-local..."
        if omp auth-broker migrate --from-local 2>&1 | tail -5; then
            echo "  ✔ omp migrate completed"
            restored_rows=1
        else
            _q_warn "omp migrate gagal, tapi file sudah di-restore ke secret vault."
        fi
    fi

    # 4. Restart services
    if [ "$restored_files" -gt 0 ]; then
        echo ""
        echo "  🔄 Restarting OMP services..."
        if command -v systemctl >/dev/null 2>&1; then
            systemctl --user restart omp-broker.service 2>/dev/null && echo "  ✔ omp-broker restarted" || _q_warn "Gagal restart omp-broker.service"
            systemctl --user restart omp-gateway.service 2>/dev/null && echo "  ✔ omp-gateway restarted" || _q_warn "Gagal restart omp-gateway.service"
        fi
    fi

    if [ "$restored_files" -eq 0 ]; then
        _q_warn "Tidak ditemukan credential di quarantine yang cocok dengan '$target'."
        echo "  Cek dengan: gn q list"
        return 0
    fi

    echo ""
    _q_success "Restore selesai: ${restored_files} file JSON dikembalikan ke secret vault."
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
    help|--help|-h|*)
        echo ""
        echo "  ╔══════════════════════════════════════════════╗"
        echo "  ║   GN QUARANTINE — Credential Sanitizer     ║"
        echo "  ╚══════════════════════════════════════════════╝"
        echo ""
        echo "  USAGE"
        echo "    gn quarantine <command> [target]"
        echo "    gn q <command> [target]"
        echo ""
        echo "  COMMANDS"
        echo "    list, l                  Lihat credential yang di-quarantine"
        echo "    add, a <target>          Quarantine credential (provider/email/project)"
        echo "    restore, r <target>      Restore credential dari quarantine"
        echo ""
        echo "  TARGET RESOLUTION (auto-detect)"
        echo "    <provider>               Cocok dengan nama provider → quarantine ALL akun"
        echo "                             (e.g. google-antigravity, openai-codex)"
        echo "    <email>                  Cocok dengan field email → single account"
        echo "                             (e.g. sohibwong102@gmail.com)"
        echo "    <projectId|accountId>    Cocok dengan project/account ID → single project"
        echo "                             (e.g. rare-data-6vp89, blissful-quanta-cggcw)"
        echo ""
        echo "  EXAMPLES"
        echo "    gn q list                              Daftar quarantine"
        echo "    gn q add google-antigravity            Quarantine semua akun AGY"
        echo "    gn q add sohibwong102@gmail.com        Quarantine 1 akun spesifik"
        echo "    gn q add blissful-quanta-cggcw         Quarantine by project ID"
        echo "    gn q restore sohibwong102@gmail.com    Restore 1 akun"
        echo "    gn q restore rare-data-6vp89           Restore by project ID"
        echo ""
        ;;
esac