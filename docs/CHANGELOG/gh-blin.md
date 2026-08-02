# Changelog — `gh-blin`

> Riwayat lengkap perubahan untuk tool **`gh-blin`** (GitHub Assistant TUI).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [0.0.3] - 2026-08-02

### Added
- **5 Reasoning Effort Variant Flags** (`--high`, `--medium`, `--low`, `--auto`, `--none`):
  - Nested backend mapping default di `utils/models.json` (`models.backends[backend][variant]`) untuk dua backend: `opencode` dan `omp`.
  - Backend-aware resolver `resolveBackendVariantModel(backendName, variantOrModelName, cliOptions)` di `utils/config.js`:
    - Valid variant: `high` | `medium` | `low` | `auto` | `none`; fallback ke `config.variant`, default `high`.
    - Resolusi model: explicit model override → custom config (`variants[backend][variant]` / `variants[variant]`) → default `models.json`.
    - Return structured `{ model, variant, backend, thinking }` (mapping thinking: `high`/`medium`/`low`/`auto` → diri sendiri, `none` → `off`).
- **Integrasi 3 Huruf Sakti `omp`** (prompt optimizer) sebagai backend:
  - Runner `callOmp(prompt, options)` di `utils/ai.js` via `spawnSync('omp', ['-p', prompt, '--no-session', '--hide-thinking', ...])` (opsional `--model=...` & `--thinking=...`).
  - `callLLM()` kini berpijak pada **Strategy 0: `omp`** bila `useOmp` / `backend === 'omp'`, lalu fallback ke `opencode` (Strategy 1) → `curl` (Strategy 2).
  - `generateReview()` meresolve backend via `resolveBackendVariantModel()` dan meneruskan `useOmp`/`backend`/`model`/`thinking`.
- **Subcommand `pr review` — magic `omp` CLI**:
  - `gh-blin pr review <number> omp` → deteksi argumen posisional terakhir `omp`, di-`pop`, set `useOmp` / `backend = 'omp'`.
  - Flag variabel `--auto` (variant `auto`) & `--none` (variant `none`) didukung di `runCli()` (`index.js`).
  - `autoReviewAll()` meneruskan `model`, `variant`, `useOmp`, `backend` ke tiap `reviewPR()`.

---

## [0.0.3] - 2026-08-02

### Added
- **Backend `omp` Integration (Magic 3-Letter Syntax)**: Eksekusi AI review via runner `omp` (`omp -p ... --no-session --hide-thinking`) hanya dengan menambahkan kata `omp` di ujung perintah CLI (`gh-blin pr review <number> omp`). Sifatnya *stateless & ephemeral* (0 file sampah session tersimpan di disk).
- **5 Reasoning Effort / Variant Presets**: Dukungan 5 tingkat reasoning effort pada `gh-blin` dan `omp`: `--high` (`claude-3-5-sonnet` / `high`), `--medium` (`gemini-3.5-flash` / `medium`), `--low` (`gemini-2.5-flash` / `low`), `--eff-auto` / `--variant auto` (`gemini-2.0-flash` / `auto`), dan `--none` (`deepseek-chat` / `off` / non-reasoning instan).
- **Nested Backend Model Mapping (`utils/models.json`)**: Single source of truth yang memetakan model default dan variant presets secara terpisah antara backend `opencode` dan backend `omp`.

### Fixed
- **CLI Flag Collision Fix**: Memisahkan makna flag `--auto` (khusus batch review seluruh PRs) dari variant effort `auto` (`--eff-auto` / `--variant auto`) untuk menghindari tabrakan logika.
- **Error Context Preservation**: Tangkap `stderr` & error status dari `omp` (`callOmp`) agar tidak gagal diam-diam (*silent null return*).
- **Subprocess Cache**: Penambahan in-memory cache pada `hasCmd()` per-process lifetime untuk mencegah puluhan subprocess `--version` tak perlu di batch mode.
- **Precedence Warning**: Peringatan ramah di CLI jika flag `--model` dan `--variant` diset bersamaan, menjamin explicit `--model` selalu meng-override preset.
- **Visual Box Alignment**: Pembungkusan `truncateVisual` pada footer terminal box `formatReview` agar lebar border kotak tetap persis 62 karakter secara konsisten meski nama model/variant sangat panjang.

## [0.0.2] - 2026-08-01

### Added
- **Model Variant Presets (`high`, `medium`, `low`)**:
  - `DEFAULT_VARIANTS` preset terdefinisi di `utils/config.js`: `high` (Default Utama: `claude-3-5-sonnet`), `medium` (`goblin-nexus/gemini-3.5-flash`), `low` (`gemini-2.5-flash`).
  - Helper `resolveVariantModel()` di `utils/config.js` untuk resolusi otomatis variant, active variant config (`config.variant`), dan custom model override per-variant (`variants.high`, `variants.medium`, `variants.low`).
  - Subcommand `gh-blin config set variant <high|medium|low>` dan `gh-blin config set variants.<high|medium|low> <model_name>` dengan validasi input yang ketat.
  - Opsi pengaturan `Set Active Variant` & `Set Custom Model Variant` di TUI interaktif `configMenu()`.
  - Short flags `--high`, `--medium`, `--low`, serta `--variant <name>` di `runCli()` (`index.js`).
  - Dokumentasi **`Examples:`** dan **`Contoh Penggunaan:`** pada `CLI_HELP` dan `CONFIG_HELP` untuk memudahkan akses perintah CLI.
  - Penayangan tag variant pada terminal box `formatReview` (`Model: claude-3-5-sonnet (variant: high) · tokens: 2.150`) dan pencatatan atomik field `variant` di JSON review log `gh-blin-reviews.json`.
- **Subcommand `config`** (CLI non-interaktif & TUI interaktif):
  - `gh-blin config set <key> <value>` — menyimpan konfigurasi (mis. `model`).
  - `gh-blin config get [key]` — mengambil nilai key (polos) atau seluruh config (JSON).
  - `gh-blin config list` — menampilkan seluruh config sebagai daftar `key = value`.
  - Menu interaktif `Config` di TUI utama (pilihan View All / Get Key / Set Key / Back).
  - Dual-level help: `gh-blin config --help` menyajikan manual khusus subcommand config.
- **Model Tracking & Token Usage Logging**:
  - `utils/config.js` — penulisan atomik (`~/.config/goblin-vault/gh-blin-config.json` via tmp + `renameSync`), helper `loadConfig`, `saveConfig`, `getConfig`, `setConfig`, dan `resolveModel` (hierarki prioritas: `--model` > config file > `GH_BLIN_MODEL`/`OPENAI_MODEL` > `null`).
  - Estimasi token sederhana `estimateTokens(text)` (~4 char/token) di `utils/ai.js` untuk menghitung `prompt`, `completion`, dan `total` tokens.
  - Return terstruktur dari `generateReview()`: `{ review, prompt, model, backend, tokens: { prompt, completion, total } }`.
  - `recordReview()` di `utils/scheduler.js` menyimpan metadata `model`, `backend`, dan `tokens` utuh di JSON review log.
  - Penayangan hasil review di `utils/display.js` (`formatReview`) menyertakan footer ANSI-aware berisi model LLM, backend (`opencode`/`openai`), dan total token yang digunakan.
- **Subcommand `pr review`** (non-interaktif, via CLI argumen):
  - `gh-blin pr review <number>` — review satu PR via AI.
  - `gh-blin pr review --auto` / `--all` — batch review semua open PRs (untuk scheduled/cron).
  - `--publish` — memposting hasil review sebagai komentar resmi GitHub PR.
  - `--help` — help non-interaktif.
- **Opsi `Review PR (AI)`** di menu PR (TUI) yang membuka `reviewMenu()` (review per-PR atau batch + konfirmasi publish).
- **Modul baru**:
  - `utils/ai.js` — `buildReviewPrompt()` + `generateReview()`: LLM review dengan fallback strategi (`opencode run` → `OPENAI_API_KEY` via `curl --data-binary @-` → error + hint).
  - `utils/scheduler.js` — review log di `~/.config/goblin-vault/gh-blin-reviews.json` (helper `loadReviewLog`, `saveReviewLog`, `hasBeenReviewed`, `recordReview`, skip review untuk SHA yang sudah tercatat).
  - `commands/review.js` — orkestrasi `reviewPR()` / `autoReviewAll()` / `reviewMenu()` (fetch metadata+diff → generate → publish → record → display).
  - `utils/prompt.js` — `continuePrompt()` reusable.
- **Helper pendukung**:
  - `ghApi()` di `utils/gh.js` — akses REST API GitHub (GET/POST/PATCH/DELETE, body JSON via stdin).
  - `formatReview()` di `utils/display.js` — box review dengan border/header/stats.
  - `selectPR` di-export dari `commands/pr.js`.
  - `continuePrompt()` di `index.js` & `commands/pr.js` dipindah ke `utils/prompt.js`.

## [0.0.1] - 2026-07-06

### Added
- `gh-blin` — GitHub CLI wrapper.
- `gh_tui` — GitHub TUI (issues, PRs, releases, repos).
