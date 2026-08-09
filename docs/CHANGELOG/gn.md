# Changelog — `gn`

> Riwayat lengkap perubahan untuk tool **`gn`** (Goblin Nexus CLI).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).


## [v2.0.0] - 2026-08-09

### Refactored
- **Nerd Font Icons Upgrade Across CLI**: Mengganti emoji warna-warni di seluruh output CLI (`gn --help`, `gn usage`, `gn ping`, `gn bench`, `gn config`, `gn doctor`, `shield.sh`, `gn.sh`) dengan simbol JetBrains Mono / Nerd Font icons (`󰄬`, `󰅚`, `󰀦`, `󰓅`, `󰒓`, `󱈸`, `󱎫`, `󰋼`, `󰑐`, `󰈙`, `󰓹`, `󰋽`, `󰚌`, `󰘚`) untuk tampilan terminal yang lebih bersih dan profesional.
- **3-Tier Hierarchical Usage Layout & Dynamic Progress Bars** (`usage.ts`, `formatter.ts`):
  - Rombak total layout `gn usage` menjadi hirarki 3-tingkat yang super terstruktur: `Provider Pool -> Email Account -> Quota Limits`.
  - Pembersihan total status badges (`󰄬 OK`) dan kata kunci redundant `"Daily · Usage (...)`" -> murni `"Google"`, `"Anthropic"`, `"OpenAI"`.
  - Progress bar tipis `━━━━────────` tanpa siku `[]` dan tanpa clutter.
  - Peningkatan dynamic color thresholds (<70% hijau, 70-99% kuning, >=100% merah).
- **Unified Subcommands & Codebase Consolidation**:
  - Peleburan subcommand `stats` dan `sessions` ke dalam `gn usage` (`--tokens` dan `--sessions`).
  - Penambahan `gn config` (`c`), `gn ping` (`p`), `gn bench` (`b`), dan `gn doctor --check` (`-c`).
- **Legacy Cleanup**: Pembersihan total tool legacy (`ocm`, `goblin-control`, `notes`).

### Added
- **TypeScript Native CLI Engine Architecture (Standalone v1.0.0 Release)**: Port total core `gn` dari Shell Script raksasa menjadi aplikasi TypeScript modular berbasis Bun/Node runtime di `tools-cli/src/gn/src/`.
- **Pure Terminal Formatter Utilities** (`utils/formatter.ts`):
  - Rendering fungsi murni tanpa side-effects untuk banner ASCII ANSI, visual quota bar, status badge (`🟢 OK`/`🟡 WARN`/`🔴 ERROR`), date formatter, dan dynamic align table.
  - Perbaikan `visibleWidth` vs `visibleLength` untuk menghitung visual character padding tabel TUI secara akurat meskipun mengandung warna ANSI dan emoji.
  - Presisi 4 desimal token cost USD pada `formatCost()`.
- **Multi-Runtime Launcher** (`tools-cli/bin/gn`): Peningkatan launcher wrapper dengan auto-fallback runtime (Bun → Node.js/tsx → Deno) dan fail-fast hint.

### Changed
- **CLI Subcommand Router Refactor** (`src/index.ts`):
  - Penataan ulang entry point CLI dengan dual-level help system (`<tool> --help` & `<tool> <command> --help`).
  - Penyelarasan versi global `GN_VERSION` menjadi `v0.3.26`.

### Removed
- **Legacy Shell & Bench Scripts Cleanup**:
  - Dihapus: `quarantine.sh`, `config.ts`, `bench.ts`, `bench-roles.ts`, `bench-storage.ts`, `pool-manager.ts`, `agent.sh`, `picker.sh`, `price.ts`, dan `doctor.sh`.
  - Pembersihan total sisa rujukan dead code `price` dan `doctor.sh` dari `help-formatter.sh` & `gn.sh`.

## [Unreleased]

### Added
- **`gn export / e` Multi-Source Credential Sync**: Ekspor credential `gn e` ditingkatkan — selain membaca SQLite database `agent.db`, ia kini otomatis menscan dan meng-export custom providers dari `~/.omp/agent/models.yml` (misal provider `peezy`) langsung ke `~/.shell/secret/<provider>/models_yml.json`.
- **`gn ping / p` & `gn bench / b` Custom Provider Support & Network Fallback**:
  - **Auto-Discovery Custom Models**: Mengenali model dari `~/.config/opencode/opencode.jsonc` dan `~/.omp/agent/models.yml` (misal `peezy/deepseek-v4-flash-0731`).
  - **Protokol `openai-responses` Support**: Otomatis me-route payload ping/bench sesuai tipe API (`openai-responses` `/v1/responses` vs standard `openai-completions` `/v1/chat/completions`).
  - **IPv4 Connection Fallback**: Node/Bun `family: 4` socket fallback untuk melewati kendala IPv6 `ENETUNREACH` / `ETIMEDOUT` pada gateway eksternal (seperti Peezy Gateway `api.p0.systems`).
- **Auto Telemetry Logger di Goblin Shield** (`shield-interceptor.ts`): Setiap request LLM yang melewati interceptor (port 4002 → 4000) otomatis dicatat ke `telemetry.db`.
  - Extract `usage` dari response JSON (`prompt_tokens`, `completion_tokens`, `cache_tokens`) — support OpenAI `/v1/chat/completions` dan Anthropic `/v1/messages`.
  - Hitung `cost_usd` real-time via pricing engine (`calculateCost` dari `pricing.ts`).
  - **Fire-and-forget**: Response di-clone dan dikonsumsi di background — **zero latency impact** ke response client.
  - **Resilient**: Semua error telemetry di-swallow — interceptor TIDAK PERNAH crash karena logging gagal.
- **Systemd User Service** (`gn-shield.service`): Daemon interceptor berjalan otomatis di background via `systemctl --user`.
  - Auto-restart (`Restart=always`, `RestartSec=2`).
  - Logging ke journald, bind port 4002, forward ke 4000.
  - Service file di `~/.config/systemd/user/gn-shield.service` + copy di `tools-cli/src/shield/gn-shield.service`.
- **`gn shield service` subcommand** (`shield.sh`): Manage systemd service — `install|remove|start|stop|restart|status`.
  - `start`/`stop`/`restart` otomatis prefer systemd jika service terinstal, fallback ke legacy PID-based daemon.
- **BARU `gn usage` engine** (`usage.ts`): Modul unified yang menggantikan `status-formatter.ts` + `burn.ts` dengan data 100% akurat (tanpa `assumedTotal 100k`).
  - **Quota Mode (`gn usage [provider]`)**: Fetch live usage limits dari broker `/v1/usage`. Menampilkan progress bar real, persentase akurat, status badge (`🟢 OK`/`⚠️ LOW`/`🔴 EXHAUSTED`), exact used/limit count, dan countdown `resetsAt`.
  - **Token Burn Mode (`gn usage --token [provider] [--days N]`)**: Query SQLite `client_usage` dari `~/.omp/agent/agent.db` untuk data real (requests, input/output/cache tokens, cost_usd). **BUKAN estimasi** — data asli dari database.
  - **JSON Mode (`gn usage --json`)**: Output JSON mentah untuk scripting/piping.
  - **Failure Resilience**: Graceful handling saat broker offline, DB locked, atau tabel `client_usage` kosong — pesan jelas tanpa crash.
- **Quick Token Summary**: Di mode quota, `usage.ts` otomatis menampilkan ringkasan token 7d jika `client_usage` punya data.

### Changed
- **`gn usage / u` routing** (`gn.sh`): Delegate langsung ke `usage.ts` — hapus pipe `omp usage --json | status-formatter.ts` dan panggilan `burn.ts`.
- **`help-formatter.sh`**: Level 2 help `usage` di-update — ganti `--history`/sparkline dengan `--token` mode, deskripsi dual-mode, visual indicators baru.
- **`gn bench`** (`bench.ts`): Hapus dependensi `bench-roles.ts` untuk role specialization. Benchmark sekarang menggunakan generic prompt tanpa system prompt complex, tanpa hybrid scoring.
- **`OmpQuotaAdapter` fresh-window filter** (`adapters/omp-quota.ts`): Query `fetchData()` rewrite total — hanya mengembalikan snapshot dari **batch polling terbaru broker** (baris dengan `recorded_at` dalam 1 jam terakhir dari `MAX(recorded_at)`), bukan `MAX(id) GROUP BY` polos yang sebelumnya menyedot snapshot stale dari akun lama (seperti `umumsriatmaja516@gmail.com`) dan weekly window yang broker sudah tidak refresh. Output `gn u` sekarang **identik dengan `omp usage` native**: tidak ada lagi baris 100% "expired" dari akun mati, tidak ada lagi weekly stale, tidak ada lagi github-copilot lama.
  - SQL: CTE `max_ts` meng-anchor batch terbaru, `WHERE recorded_at >= ts - 3600000 AND id IN (SELECT MAX(id) ... GROUP BY provider, account_key, limit_id)`.
  - Post-filter: drop baris dengan `resets_at < now - 3600000` (pengaman untuk baris yang lolos fresh-window tapi `resets_at` sudah lama lewat).
  - Post-dedup: safety-belt per `(provider, email, label)` — cegah duplikat visual saat broker menulis `limit_id` berbeda untuk quota user-facing yang sama.
  - Konstanta `FRESH_WINDOW_MS` (1 jam) di-export & `freshWindowMs` constructor param untuk testability.
- **`ollama-me.ts` Single Source of Truth refactor**: Credential akun Ollama Cloud sekarang dibaca **langsung dari SQLite `~/.omp/agent/agent.db` (tabel `auth_credentials`, `provider = 'ollama-cloud'`)**, BUKAN lagi gabungan file vault `~/.shell/secret/ollama-cloud/*.json` + DB (yang sebelumnya menghasilkan 6 entry duplikat/stale: `id-5.json`, `id-6.json`, `id-7.json` mirror DB + 3 file `*_gmail_com.json` legacy). Hasilnya: `gn u` & `gn om` sekarang murni menampilkan **3 Akun Utama** (satu per row di DB, urut by `id ASC`).
  - **Read-only via helper** `withDb()` / `getOmpAgentDb()` dari `utils/db.ts` (sesuai architect invariant). Tidak ada import langsung `bun:sqlite`.
  - **Exact match** `provider = 'ollama-cloud'` (sebelumnya `LIKE '%ollama%'`) — false-proof untuk provider baru seperti `ollama-cloud-pro`.
  - **Live HTTP fetch tetap aktif**: `POST ollama.com/api/me` (Bearer) untuk email/plan/id, `GET ollama.com/settings` (cookie) untuk session/weekly % jika cookie tersedia. Cache 15-menit tidak berubah.
  - **Type import**: `OllamaAccountMeta` interface duplicate di-import dari `types.ts` (canonical) — bukan lagi deklarasi lokal.
  - **Help text** `gn om --help` di-update: SUMBER DATA section & TROUBLESHOOTING merujuk ke `auth_credentials` (bukan lagi file vault). Empty-state message juga disesuaikan.

### Removed
- **`burn.ts`** & **`status-formatter.ts`**: File dihapus dari direktori. Keduanya sudah digantikan sepenuhnya oleh `usage.ts` — tidak ada routing yang memanggilnya lagi.
- **`assumedTotal 100k` matematika rekaan**: `burn.ts` sebelumnya menggunakan estimasi 100k token untuk menghitung cost — sekarang `usage.ts` hanya menampilkan data real dari SQLite atau jujur mengatakan "0 tokens burned".
- **Pembersihan Bom Waktu & Redundansi**:
  - **`quarantine.sh`** (575 LoC) — Manipulasi langsung SQLite `auth_credentials` (`DELETE FROM ...`) + rename file JSON credential. Penyebab DB state inconsistency & secret vault corrupt. Dihapus.
  - **`config.ts`** (~270 LoC) — Parser JSONC manual berbasis regex yang rapuh; penyebab utama `MALFORMED FUNCTION ERROR` & config corruption. Dihapus.
  - **Inline `gn export` SQL block** (~46 baris di `gn.sh`) — Direct `SELECT * FROM auth_credentials` + dump `apiKey` plaintext ke `~/.shell/secret/`. Dihapus.
  - **`bench.ts`** (487 LoC) — Redundan dengan REST API OMP `POST /v1/chat/completions`. Dihapus.
  - **`pool-manager.ts`** (385 LoC) — Redundan dengan OMP Auth-Broker snapshot API. Dihapus.
  - **`agent.sh`** (128 LoC) — Direct edit `opencode.jsonc` (raw sed) tanpa validasi; risiko malformed config. Dihapus.
  - **`picker.sh`** (75 LoC) — Caller ke `config.ts` yang sudah mati. Dihapus.
  - **Helper dead-code `_run_bench_action`** di `gn.sh` — Tidak ada caller setelah `bench.ts` dihapus. Dihapus.
  - **Direct SQL credential query di `doctor.sh`** (section 6 "Credential Health") — Sudah di luar scope OMP, akses langsung `auth_credentials` SQLite. Dihapus.
- **Deprecation Guard di `gn.sh`** (4 handler): `ping|p`, `bench|b`, `quarantine|q`, `export|e` sekarang hanya menampilkan warning + hint REST API OMP (`GET /healthz`, `POST /v1/chat/completions`, `POST /v1/credential/:id/disable`, `GET /v1/snapshot`) atau CLI `omp`/`ocm` sebagai gantinya. Level 1 help & `help-formatter.sh` Level 2 help untuk keempat command juga dihapus/di-update.
- **`help-formatter.sh`**: Hapus block Level 2 help untuk `ping`, `bench`, `quarantine`, `export`. Update help `doctor` — drop point "Credential health".

## [v0.3.15] - 2026-07-28

### Added
- **Global Ultra-Clean ASCII Art Banners (bagian dari suite CLI GN, ZF, FEX, OCM)**:
  - Penyesuaian banner visual seragam dengan font ASCII Art tebal presisi tinggi.
  - Penempatan nama tool dan versi persis di bawah banner dengan skema warna pure white & margin atas yang lega agar tidak menempel di prompt terminal (`shobixlinuxdev>`).

## [v0.3.13] - 2026-07-27

### Added
- **Ollama Cloud Real-time Scraper & Metadata Fetcher (`ollama-me.ts`)**:
  - Penarikan metadata akun Ollama Cloud resmi via `POST https://ollama.com/api/me` (Email, Plan, ID, Suspended Status) dengan auto-discovery dari SQLite DB `~/.omp/agent/agent.db` dan Secret Vault.
  - HTML Web Scraper untuk dashboard `https://ollama.com/settings` (ekstraksi persentase pemakaian persis 1:1 dari `session_usage_pct` & `weekly_usage_pct`).
  - Cache TTL 15 menit di `~/.cache/goblin-nexus/ollama-me-cache.json` untuk performa kilat.
  - Integration di `gn status`: Render diagram bar visual 28-karakter presisi 1-desimal per-akun Ollama Cloud.
  - Integration di `gn burn`: Menampilkan baris `Weekly Usage` & `Session Usage` lengkap dengan estimasi token (`17.00k tokens`) dan cost ($).

### Refactored
- **Code Review & Maintenance Improvements (`gn`)**:
  - Direct object mutation pada cumulative logic `burn.ts` diganti dengan Strict Immutability Map Update (`merged.set(key, { ... })`).
  - Positional array index matching untuk Ollama Cloud diubah menjadi Identity-based lookup (`metaByEmail` / `metaById`).
  - Komentar prioritas merge `burn.ts` disesuaikan dengan kode (`snapshot > history > broker`).
  - Error context logging ditambahkan pada scraper `ollama-me.ts`.

## [v0.3.11] - 2026-07-27

### Added
- **`gn` Dual-Level Help System**:
  - Subcommand Deep Help Manual (`help-formatter.sh`) untuk `ping`, `bench`, `status`, `burn`, `pool`, `shield`, `agent`.
  - Konsistensi akses help via `gn <command> --help`, `gn <command> -h`, atau `gn help <command>`.
  - Tampilan help estetik dengan visual header, deskripsi target, detail flag, dan contoh penggunaan praktis.

## [v0.3.9] - 2026-07-27

### Added
- **`gn bench` Dynamic Multi-Role Benchmark Engine**:
  - Modular System Prompt Roles (`coder`, `bugfix`, `planning`, `codereview`) tersimpan di `tools-cli/src/gn/prompts/roles/*.txt`.
  - Modular Dataset Test Cases tersimpan di `tools-cli/src/gn/prompts/datasets/*.json`.
  - **Dual-Source of Truth Scoring**: Hybrid Scoring Matcher (Keyword & Structural Rubric) + Self-Cleaning `tools-cli/src/gn/storage/output.md` untuk Agent Deep Analytics.
  - Storage Append-Only di `tools-cli/src/gn/storage/history.json` (auto-ignored oleh Git).
  - Mode Selector: `--provider <id>`, `--vs` / `--vs=m1,m2` (Adu Banteng cross-provider), `--role <role>`, dan `--timeout <sec>` (default 60s untuk bench, 10s untuk ping).
- **`gn ping` Visual UX Upgrade**: Clean status badges (`200 OK`, `429 LIMIT`), dynamic spinner, visual ANSI latency bar (`miniBar`), dan summary lineup.

### Changed
- `gn status` & `gn burn` layout formatting cleanups (penataan visual progress bar 28-char & pembersihan secret/opaque IDs).

## [v0.3.8] - 2026-07-27

### Added
- `gn burn` (`burn.ts` + `bu` alias) — Token & Cost Burn Tracker. Mengakses REST endpoint OMP Broker v17.1.4 (`GET /v1/usage/clients` & `GET /v1/usage/history`) untuk menampilkan token burn per client dengan breakdown input/output/cache tokens, estimated cost (USD), dan sparkline history (▁▂▃▄▅▆▇█). Mendukung flag `--history`, `--json`, `--days <int>`, `--provider <id>`. Degradasi elegan ke `omp usage --json` saat broker belum menyediakan field token burn, dengan pesan Goblin Roast yang ramah.
- `gn status` upgrade (`status-formatter.ts`) — Konsumsi JSON output `omp usage --json` lalu render dengan visual status dot (`●`/`○`/`✗`) berwarna ANSI, normalisasi `usedFraction`/`windowLabel` dari shape OMP v17.1.4, ringkasan `disabledCredentials` (mis. `✗ email — disabled 3d ago: re-login to restore`), dan `capacity` summary per-provider (mis. `capacity: 7d → 2.00/2 accounts used (0.00× quota left)`). Integrasi `gum style` opsional, fallback ANSI untuk TTY/non-TTY.
- `show_help` gn — Tambah subcommand `burn`/`bu` dengan deskripsi flag & contoh penggunaan di section `EXAMPLES`.

## [v0.3.5] - 2026-07-26

### Added
- `shield-interceptor.ts` Smart Fallback Array Chain — Dukungan `fallback_models` berbasis array candidates (`Primary -> Array[Fallback1, Fallback2]`) dengan multi-level sequential retry saat upstream mengembalikan status HTTP `410`, `429`, atau `5xx`.
- Header Debug `X-Goblin-Shield-Fallback` — Menampilkan metadata jejak fallback model pada response headers yang dikirimkan ke client/OpenCode.

## [v0.3.0] - 2026-07-26

### Added
- `gn pool` — Dynamic Account Pool Switching (`pool-manager.ts` & `gn.sh`) untuk isolation proxy & bypass SQLite DB via `OMP_AUTH_BROKER_ACCOUNT_POOL_FILE`.
- `gn` Visual Engine Update — Header ASCII Art `GN PROXY` Unicode Shade Block, `gum style` double border, spinner loading `_gn_spin`, dan Goblin Roast Error handling.
- `tools-cli/src/gn/` & `tools-cli/bin/gn` — Goblin Nexus CLI port dari `~/.shell/` untuk benchmark, model routing, dan agent model switcher.
- `tools-cli/src/shield/` — Goblin Privacy Shield Interceptor (`Bun.serve` proxy) untuk masking regex API keys/secrets.

### Changed
- `gn ping` & `gn bench` table output simplified — Menghapus kolom terduplikasi, hanya menampilkan Full Model ID & Latency/Speed secara ringkas.
