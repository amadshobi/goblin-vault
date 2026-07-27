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
  proxy gateway (http://127.0.0.1:4000).

USAGE
  $ gn ping [target] [options]
  $ gn p [target] [options]

TARGETS
  config, cfg          Ping model yang terdaftar di ~/.config/opencode/opencode.jsonc (default)
  all                  Ping seluruh model yang di-expose oleh OMP gateway
  <provider_id>        Filter model berdasarkan nama provider (e.g. google-antigravity)

OPTIONS
  -f, --force          Skip cache 5 hari & paksa ping ulang
  -s, --select         Buka menu interactive picker setelah ping untuk update opencode.jsonc
  --timeout <sec>      Set custom timeout per request (default: 10 detik)
  --provider <id>      Filter 1 provider spesifik

EXAMPLES
  $ gn ping                              Ping model dari opencode.jsonc
  $ gn ping all --force                  Ping seluruh model gateway tanpa cache
  $ gn ping google-antigravity           Ping khusus model Google Antigravity
  $ gn ping --select                     Ping lalu pilih model untuk diaktifkan di OpenCode
HELP
            ;;
        bench|b)
            cat <<'HELP'
🧙‍♂️ GN BENCH — Dynamic Multi-Role Benchmark Engine & Adu Banteng

DESKRIPSI
  Mengukur latensi, throughput generasi (tokens/sec), dan kualitas (quality score)
  model AI menggunakan System Prompt Specialization & Dataset Test Cases nyata.

USAGE
  $ gn bench [target] [options]
  $ gn b [target] [options]

SPECIALIZATION ROLES (--role)
  coder                💻 Senior Software Engineer (clean code, LRU cache, type hints)
  bugfix               🐛 Senior Debugging Specialist (root cause analysis, race condition)
  planning             📐 Senior Technical Architect (system design 100k events/sec)
  codereview           👁️ Senior Code Reviewer (SQL injection & performance audit)

DUEL MODE (--vs)
  Adu Banteng cross-provider duel mode! Menguji model terbaik dari tiap provider
  di ring yang sama untuk membandingkan kecepatan & kualitasnya secara head-to-head.

SCORING & ANALYTICS
  - Dual-Source of Truth Scoring: Hybrid Matcher (Keyword & Code Structure Rubric)
  - Agent Analytics: Setiap run otomatis membuat & mereset file `tools-cli/src/gn/storage/output.md`
    yang berisi Soal (Prompt) + Jawaban (Model Response) untuk dianalisis oleh AI Agent.
  - History Storage: Hasil run otomatis di-append ke `tools-cli/src/gn/storage/history.json`.

OPTIONS
  --role <role_id>     Pilih role specialization (coder, bugfix, planning, codereview)
  --vs [model1,m2]     Aktifkan mode Adu Banteng (semua provider / spesifik model)
  --provider <id>      Filter 1 provider spesifik (e.g. ollama-cloud)
  --timeout <sec>      Set custom timeout per benchmark request (default: 60 detik)
  -f, --force          Skip cache & paksa benchmark ulang
  -s, --select         Pilih model terbaik hasil benchmark via interactive TUI

EXAMPLES
  $ gn bench                             Benchmark default (role: coder)
  $ gn bench --role bugfix               Benchmark khusus role debugging specialist
  $ gn bench --vs                        Adu Banteng model antar-provider
  $ gn bench --provider google-antigravity --timeout 30   Bench khusus Antigravity (timeout 30s)
  $ gn bench all -s                      Benchmark seluruh model lalu pilih model di TUI
HELP
            ;;
        status|s)
            cat <<'HELP'
🧙‍♂️ GN STATUS — Account Quota & Usage Monitor

DESKRIPSI
  Mengambil sisa kuota, limit window, dan status keaktifan per-akun terdaftar
  secara live dari OMP Auth Broker DB.

USAGE
  $ gn status [provider]
  $ gn s [provider]

VISUAL INDICATORS
  ● Green              Penggunaan kuota aman (< 70%)
  ● Yellow             Penggunaan kuota sedang (70% - 95%)
  ● Red                Penggunaan kuota hampir habis / exhausted (≥ 95%)
  ✗ Red Cross          Kredensial disabled / butuh re-login
  ○ Gray               Akun terdaftar tetapi belum ada data penggunaan

EXAMPLES
  $ gn status                            Cek kuota seluruh akun di semua provider
  $ gn status google-antigravity         Cek kuota khusus provider Google Antigravity
  $ gn status openai-codex               Cek kuota khusus provider OpenAI Codex
HELP
            ;;
        burn|bu)
            cat <<'HELP'
🧙‍♂️ GN BURN — Token & Cost Burn Tracker

DESKRIPSI
  Melacak jumlah konsumsi token (input, output, cache) dan estimasi biaya (USD)
  per-kredensial/akun yang terdaftar di broker.

USAGE
  $ gn burn [flags]
  $ gn bu [flags]

OPTIONS
  --history            Tampilkan visual sparkline history konsumsi (▁▂▃▄▅▆▇█)
  --json               Output raw JSON mentah (cocok untuk scripting / piping)
  --days <int>         Window hari untuk data history (default: 7 hari)
  --provider <id>      Filter 1 provider tertentu (e.g. github-copilot)

EXAMPLES
  $ gn burn                              Tampilkan tabel token & cost burn 7 hari terakhir
  $ gn burn --history --days 14          Dengan sparkline history 14 hari
  $ gn burn --provider google-antigravity Filter khusus provider Antigravity
  $ gn burn --json                       Output JSON mentah
HELP
            ;;
        pool|po)
            cat <<'HELP'
🧙‍♂️ GN POOL — Dynamic Account Pool Switcher & Isolation Proxy

DESKRIPSI
  Mengisolasi & mengelompokkan kredensial akun AI menjadi pool file dinamis,
  serta dapat menjalankan isolated auth-gateway foreground.

USAGE
  $ gn pool <provider> [options]
  $ gn po <provider> [options]

OPTIONS
  -l, --list           Lihat isi file pool yang sedang aktif (/tmp/goblin-pool.json)
  -s, --serve          Generate pool & jalankan isolated auth-gateway di foreground
  -o, --only <key>     Filter identity key / email tertentu (dapat diulang)
  --port <port>        Set custom port untuk isolated gateway (default: 4000)

EXAMPLES
  $ gn pool google-antigravity           Buat pool dari seluruh akun Antigravity
  $ gn pool google-antigravity -o user@gmail.com   Isolasi pool hanya untuk 1 akun
  $ gn pool --list                       Lihat daftar akun di pool file aktif
  $ gn pool google-antigravity --serve --port 4005 Launch isolated gateway di port 4005
HELP
            ;;
        shield|sh)
            cat <<'HELP'
🧙‍♂️ GN SHIELD — Privacy Shield Proxy Daemon

DESKRIPSI
  Mengamankan request AI dengan melakukan regex masking / sanitasi data sensitif
  (API keys, JWT, passwords, IP, credentials) sebelum dikirim ke upstream provider.

USAGE
  $ gn shield <command>
  $ gn sh <command>

COMMANDS
  enable               Aktifkan Privacy Shield & alihkan port opencode.jsonc ke proxy shield
  disable              Matikan Privacy Shield (direct mode ke gateway)
  start                Jalankan interceptor daemon tanpa mengubah config editor
  stop                 Hentikan interceptor daemon
  status               Cek status keaktifan shield daemon & fallback routing
  logs                 Live stream log sanitization data sensitif

EXAMPLES
  $ gn shield status                     Cek status keaktifan shield
  $ gn shield enable                     Aktifkan Privacy Shield
  $ gn shield disable                    Matikan Privacy Shield
  $ gn shield logs                       Lihat stream live log sanitization
HELP
            ;;
        agent|a)
            cat <<'HELP'
🧙‍♂️ GN AGENT — Agent Model Switcher TUI

DESKRIPSI
  Mengubah model AI yang digunakan oleh Agent OpenCode (misal: code, reviewer, architect)
  melalui TUI interaktif.

USAGE
  $ gn agent [agent_name]
  $ gn a [agent_name]

EXAMPLES
  $ gn agent                             Pilih agent & ganti model via TUI
  $ gn agent code                        Ganti model khusus untuk agent 'code'
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
