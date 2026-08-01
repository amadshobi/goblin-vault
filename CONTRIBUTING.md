# 🤝 Contributing to Goblin Vault

Terima kasih telah tertarik untuk berkontribusi di **Goblin Vault**! 🍻👹

Repositori ini adalah pusat komando dan arsenal terminal utility yang dirancang agar stabil, cepat, dan minim friksi. Untuk menjaga agar codebase tetap bersih, konsisten, dan mudah dipelihara, harap baca panduan kontribusi di bawah ini sebelum membuat Pull Request.

---

## 📜 Principles & Engineering Standards

Setiap kontribusi di repositori ini WAJIB mematuhi panduan teknis utama yang ada di [`AGENTS.md`](./AGENTS.md) dan [`docs/rules/coding-style.md`](./docs/rules/coding-style.md):

1. **Immutability (KRITIS)**:
   - Buat objek/array baru saat melakukan transformasi data. JANGAN memutasi objek/array in-place.
2. **File Organization (Cohesion)**:
   - Utamakan file kecil dan terfokus (200–400 baris typical, maksimal 800 baris).
3. **CLI UX & Dual-Level Help Standard**:
   - Level 1 Help (`<tool> --help`): Rangkuman makro ringkas.
   - Level 2 Help (`<tool> <command> --help` atau `<tool> help <command>`): Manual kontekstual rinci per-subcommand.
   - Gunakan ANSI block header style & visual status badges (`✅`, `⚠️`, `❌`).
4. **Fail-Fast & Friendly Error Handling**:
   - Tangani error secara eksplisit, sertakan *Goblin Roast Hint* perbaikan yang ramah terminal.
5. **No Secrets**:
   - DILARANG MENYERTAKAN API keys, credentials, atau file sensitif di dalam repositori.

---

## 🛠️ Local Development Setup

### Prasyarat Environment
- **OS**: Linux (Zsh/Bash) atau macOS
- **Runtime**: Node.js ≥ 20.x, Bun ≥ 1.0, Go ≥ 1.22
- **Tools Integrasi Terminal**: `fzf`, `tmux`, `zoxide` (opsional tapi disarankan)

### Langkah Setup
1. Fork & clone repositori:
   ```bash
   git clone https://github.com/amadshobi/goblin-vault.git
   cd goblin-vault
   ```
2. Pasang Git hooks lokal (Wajib untuk syntax check otomatis):
   ```bash
   ./scripts/install-hooks.sh
   ```
3. Uji kesehatan environment terminal:
   ```bash
   ./scripts/doctor.sh
   ```

---

## 🔄 Workflow Kontribusi

1. **Buat Feature Branch**:
   Gunakan script worktree bawaan atau buat branch dari `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feat/nama-fitur-kamu
   # atau fix/nama-bug-kamu
   ```

2. **Lakukan Perubahan Kode**:
   - Tulis kode yang fokus, terisolasi, dan mudah dibaca.
   - Selalu Quote variabel path di shell script (`set -euo pipefail`).

3. **Verifikasi & Format Standard**:
   Jalankan check syntax sebelum meng-commit:
   ```bash
   ./scripts/check_syntax.sh
   ```

4. **Update Changelog Modular**:
   Jika perubahan berdampak langsung pada pengguna (user-facing), perbarui changelog terkait di folder `docs/CHANGELOG/<tool>.md` (misal `sup.md`, `fex.md`, `gn.md`). Jangan mengubah master `CHANGELOG.md` secara langsung.

5. **Commit & Push**:
   Gunakan pesan commit yang deskriptif (format Conventional Commits):
   - `feat(sup): tambah verbose mode streaming`
   - `fix(fex): perbaiki binding key navigation`
   ```bash
   git add .
   git commit -m "feat(tool): deskripsi singkat perubahan"
   git push origin feat/nama-fitur-kamu
   ```

6. **Buka Pull Request**:
   - Buat PR menargetkan branch **`dev`** (Bukan `main` langsung).
   - Isi formulir PR Template dengan rinci.
   - Pastikan CI build & lint check berwarna hijau!

---

## 🍻 Butuh Bantuan?

Jika ada pertanyaan atau ide gila yang ingin didiskusikan terlebih dahulu, silakan buka [GitHub Discussions](https://github.com/amadshobi/goblin-vault/discussions) atau laporkan via [Issue Tracker](https://github.com/amadshobi/goblin-vault/issues).

Happy Hacking, Fellow Goblin! 👹🔥
