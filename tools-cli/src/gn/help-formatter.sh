#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Goblin Nexus CLI — Level 2 Contextual Help Formatter
# Provides deep manual guides per subcommand
# ─────────────────────────────────────────────────────────────

_show_subcommand_help() {
    local cmd="${1:-}"
    case "$cmd" in
        ping|p)
            cat <<'HELP'
🧙‍♂️ GN PING — Model Health & Latency Prober

DESKRIPSI
  Memeriksa keaktifan (health check) & latensi model AI yang terhubung via
  proxy gateway dari GN_GATEWAY_BASE_URL atau baseURL opencode.jsonc
  (fallback: http://127.0.0.1:4000/v1).

USAGE
  $ gn ping [target] [options]
  $ gn p [target] [options]

TARGETS
  config, cfg          Ping model yang terdaftar di ~/.config/opencode/opencode.jsonc (default)
  all                  Ping seluruh model yang di-expose oleh OMP gateway
  <provider_id>        Filter model berdasarkan nama provider (e.g. google-antigravity)

OPTIONS
  -f, --force          Skip cache & paksa ping ulang
  --timeout <sec>      Set custom timeout per request (default: 10 detik)
  --provider <id>      Filter 1 provider spesifik
  GN_GATEWAY_BASE_URL  Override endpoint gateway, e.g. http://127.0.0.1:4002/v1

EXAMPLES
  $ gn ping                              Ping model dari opencode.jsonc
  $ gn ping all --force                  Ping seluruh model tanpa cache
  $ gn ping google-antigravity           Ping khusus model Google Antigravity
  $ GN_GATEWAY_BASE_URL=http://127.0.0.1:4002/v1 gn ping --force
HELP
            ;;
        bench|b)
            cat <<'HELP'
🧙‍♂️ GN BENCH — Simple Benchmark Engine

DESKRIPSI
  Mengukur latensi, throughput (tokens/sec), dan time-to-first-token (TTFT)
  model AI secara jujur tanpa role specialization.

USAGE
  $ gn bench [target] [options]
  $ gn b [target] [options]

TARGETS
  config, cfg          Benchmark model dari opencode.jsonc (default)
  all                  Benchmark seluruh model gateway
  <provider_id>        Filter model berdasarkan provider

OPTIONS
  --provider <id>      Filter 1 provider spesifik (e.g. ollama-cloud)
  --timeout <sec>      Set custom timeout per benchmark (default: 60 detik)
  -f, --force          Skip cache & paksa benchmark ulang
  GN_GATEWAY_BASE_URL  Override endpoint gateway

EXAMPLES
  $ gn bench                             Benchmark default
  $ gn bench --provider google-antigravity  Benchmark khusus Antigravity
  $ gn bench all --timeout 30            Benchmark semua model (timeout 30s)
HELP
            ;;
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
  6. Credential health (deteksi exhausted/quarantined)
  7. Secret vault integrity

USAGE
  $ gn doctor
  $ gn doc

EXAMPLES
  $ gn doctor          Jalankan diagnostic full-chain
HELP
            ;;
        quarantine|q)
            cat <<'HELP'
🧙‍♂️ GN QUARANTINE — Credential Zombie Sanitizer

DESKRIPSI
  Mengelola credential exhausted/zombie dengan memindahkannya dari
  SQLite agent.db dan .shell/secret/ ke .shell/secret/.quarantine/.
  Backup SQLite otomatis dibuat sebelum modifikasi (immutable safety).
  Service di-restart secara otomatis setelah operasi.

USAGE
  $ gn quarantine <command> [args]
  $ gn q <command> [args]

COMMANDS
  list, l              Lihat credential yang sedang di-quarantine
  add, a <provider>    Pindahkan seluruh credential provider ke quarantine
  restore, r <provider> Kembalikan credential dari quarantine

EXAMPLES
  $ gn q list                       Lihat daftar quarantine
  $ gn q add google-antigravity     Karantina credential AGY
  $ gn q restore ollama-cloud       Kembalikan credential Ollama
HELP
            ;;
        export|e)
            cat <<'HELP'
🧙‍♂️ GN EXPORT — Credential Vault Exporter

DESKRIPSI
  Mengexport credential aktif dari SQLite agent.db ke file JSON
  di ~/.shell/secret/<provider>/ untuk backup & portability.

USAGE
  $ gn export
  $ gn e

EXAMPLES
  $ gn export           Export seluruh credential ke secret vault
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
