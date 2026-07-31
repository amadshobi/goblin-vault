# Changelog — `gn`

> Riwayat lengkap perubahan untuk tool **`gn`** (Goblin Nexus CLI).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Added
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

### Removed
- **`burn.ts`** & **`status-formatter.ts`**: File dihapus dari direktori. Keduanya sudah digantikan sepenuhnya oleh `usage.ts` — tidak ada routing yang memanggilnya lagi.
- **`assumedTotal 100k` matematika rekaan**: `burn.ts` sebelumnya menggunakan estimasi 100k token untuk menghitung cost — sekarang `usage.ts` hanya menampilkan data real dari SQLite atau jujur mengatakan "0 tokens burned".

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
