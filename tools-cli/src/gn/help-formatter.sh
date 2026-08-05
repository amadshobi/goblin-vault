#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus CLI — Level 2 Contextual Help Formatter
# Provides deep manual guides per subcommand
# ─────────────────────────────────────────────────────────────

_show_subcommand_help() {
    local cmd="${1:-}"
    case "$cmd" in
        usage|u)
            cat <<'HELP'
🧙‍♂️ GN USAGE — Account Quota & Real Token Burn Dashboard

DESKRIPSI
  Dashboard terpadu dengan data 100% real (tanpa matematika rekaan):
  - Live quota usage per-akun dari broker OMP (/v1/usage)
  - Real token burn & cost dari SQLite DB (tabel client_usage)

  Tersedia dua mode: Quota (default) dan Token Burn (--token).

USAGE
  $ gn usage [provider] [options]
  $ gn u [provider] [options]

MODES
  (default)  Tampilkan dashboard kuota live (Daily/Weekly) per akun
             dengan progress bar, persentase akurat, status badge
             (🟢 OK / ⚠️  LOW / 🔴 EXHAUSTED), dan countdown reset.
  --token    Mode token burn & cost REAL dari SQLite agent.db
             (tabel client_usage: requests, input/output/cache tokens, $)
             BUKAN estimasi — data asli dari database.

OPTIONS
  --token, -t        Mode real token burn (SQLite client_usage)
  --json             Output JSON mentah (cocok untuk scripting / piping)
  --days <int>       Window hari untuk data token burn (default: 7)
  --provider <id>    Filter 1 provider tertentu (bisa sebagai argumen)

VISUAL INDICATORS
  🟢 OK              Penggunaan kuota aman (< 70%)
  ⚠️  LOW            Penggunaan kuota sedang (70% - 95%)
  🔴 EXHAUSTED       Penggunaan kuota hampir habis / exhausted (≥ 95%)
  ✗                  Kredensial disabled / butuh re-login

EXAMPLES
  $ gn usage                           Dashboard kuota live semua akun
  $ gn usage google-antigravity        Filter provider Antigravity
  $ gn usage --token                   Token burn & cost real semua provider
  $ gn usage --token google-antigravity --days 14   Token AGY 14 hari
  $ gn usage --json                    Output JSON mentah kuota
  $ gn usage --token --json            Output JSON mentah token burn
HELP
            ;;
        doctor|doc)
            cat <<'HELP'
🧙‍♂️ GN DOCTOR — Full-Chain System & Credential Health Diagnostic

DESKRIPSI
  Memeriksa kesehatan full-chain infrastruktur OMP:
  1. Service status (omp-broker, omp-gateway)
  2. Port availability (4000, 4001)
  3. SQLite database integrity (agent.db)
  4. Broker authentication token
  5. Gateway API health check
  6. Secret vault integrity

USAGE
  $ gn doctor
  $ gn doc

EXAMPLES
  $ gn doctor          Jalankan diagnostic full-chain
HELP
            ;;
        *)
            cat <<'HELP'
🧙‍♂️ GOBLIN NEXUS CLI — HELPER

Command tidak dikenali atau tidak memiliki deep help khusus.
Gunakan `gn --help` untuk melihat daftar lengkap command utama.
HELP
            ;;
    esac
}
