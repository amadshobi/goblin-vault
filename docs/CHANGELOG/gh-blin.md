# Changelog — `gh-blin`

> Riwayat lengkap perubahan untuk tool **`gh-blin`** (GitHub Assistant TUI).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [0.0.2] - 2026-08-01

### Added
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
