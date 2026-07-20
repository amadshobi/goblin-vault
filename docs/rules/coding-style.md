# Coding Style — Goblin Vault

Panduan gaya kode wajib untuk seluruh kontributor dan AI agent yang beroperasi di
**Goblin Vault**. Aturan ini turunan langsung dari hasil eksplorasi struktur repo
(`tools-cli/`, `scripts/`, `configs/`) dan selaras dengan prinsip engineering:
modularity, scalability, maintainability, reusable.

Setiap aturan punya badge severity:
- 🔴 **CRITICAL** — wajib, pelanggaran = blocker
- 🟠 **IMPORTANT** — kuat disarankan, review akan flags
- 🟢 **RECOMMENDED** — konvensi, baik diikuti

Bahasa dokumentasi: Indonesia (utama), English untuk istilah teknis.

---

## 1. Immutability 🔴 CRITICAL

SELALU buat objek baru, JANGAN mutasi objek yang sudah ada:

```
// SALAH: modify(original, field, value) → mengubah original in-place
// BENAR: update(original, field, value) → returns new copy dengan perubahan
```

Rationale: immutable data mencegah hidden side-effect, mempermudah debug, dan
memungkinkan concurrency yang aman.

### Aturan
- Fungsi transformasi HARUS mengembalikan salinan baru, bukan memutasi argumen.
- DILARANG mutasi array/objek via `Array.prototype.splice`, `Object.assign(target, src)`
  secara in-place, reassign field objek eksternal.
- Gunakan spread / `.map` / `.filter` / structured clone untuk menghasilkan copy.

### Contoh (dari repo — perlu diperbaiki)
```js
// src/ocm/utils.js — 🚨 MUTASI BERBAHAYA
parsedLines.splice(idx, 1);                 // salah: mutasi array original
parsedLines.splice(insertIndex, 0, ...newSection);

// BENAR
const next = parsedLines.filter((_, i) => i !== idx);
const inserted = [...next.slice(0, insertIndex), ...newSection, ...next.slice(insertIndex)];
return inserted;
```

### Referensi yang sudah baik (ikuti pola ini)
- `src/ocm/` → `updateAgentField`, `updateNestedField` mengembalikan salinan JSONC baru.
- Go → `sess := session.New(cfg, absDir)` (value/copy semantics).

---

## 2. File Size & Organization 🟠 IMPORTANT

MANY SMALL FILES > FEW LARGE FILES.

### Aturan
- **Maksimal 800 baris per file.** Target ideal: 200–400 baris.
- Fungsi maksimal ~50 baris; jika lebih, pecah.
- Pisahkan concern berdasar domain/feature, bukan tipe.
- Ekstrak utilities dari modul raksasa.

### File yang WAJIB direfactor (temuan explore)
| File | Baris | Tindakan |
|------|-------|----------|
| `src/fex/cmd/root.go` | 989 | pecah ke `cmd/modes/*.go` |
| `src/ocm/utils.js` | 587 | pecah ke `parser.js`, `models.js`, `update.js` |
| `src/fex/internal/tree/tree.go` | 393 | pecah ke `tree_core.go` + `tree_interactive.go` |

### Contoh yang sudah baik
- `src/ocm/ui/dashboard.js` (95), `src/ocm/ui/menu.js` (150), `src/fex/cmd/backup.go` (169).

---

## 3. Error Handling 🔴 CRITICAL

Tangani error eksplisit di setiap level. JANGAN telan error diam-diam.

### Aturan
- Semua fungsi yang bisa gagal mengembalikan / propagate error deskriptif.
- Kode berhadapan UI: tampilkan pesan ramah user + exit code jelas.
- Shell script yang berubah state: WAJIB `set -euo pipefail`.
- Hindari `2>/dev/null` yang menutupi error asli — log atau handle eksplisit.

### Contoh (ikuti pola ini)
```go
// Go — wrap dengan konteks
if err := sess.SetCwd(absDir); err != nil {
    return fmt.Errorf("session init: %w", err)
}
```
```js
// JS TUI — pesan ramah + exit
if (err) {
    p.cancel(color.red(err.message));
    process.exit(1);
}
```
```sh
# Shell — fail-fast
set -euo pipefail
```

### ⚠️ Yang perlu diperbaiki
- `src/fex/internal/ui/detect.go` → `DetectPreviewCmd()` terlalu sering `2>/dev/null`,
  menutupi kegagalan command eksternal.

---

## 4. Input Validation 🟠 IMPORTANT

Validasi di system boundary. JANGAN percaya input eksternal.

### Aturan
- Validasi argumen/flag user sebelum diproses (fail fast dengan pesan jelas).
- Command eksternal: cek keberadaan via `exec.LookPath` / `os.Stat` sebelum eksekusi.
- Validasi tipe data (mis. `isNaN(Number(val))` untuk field numerik).
- API response / file content → schema/shape check sebelum digunakan.

### Contoh (sudah baik)
```go
// Go — cek sebelum operasi
if _, statErr := os.Stat(path); statErr != nil {
    return fmt.Errorf("path tidak ditemukan: %w", statErr)
}
```
```js
// JS — validasi tipe
if (isNaN(Number(val))) {
    p.cancel(color.red("Step harus berupa angka"));
    return;
}
```

---

## 5. Naming Conventions 🟢 RECOMMENDED

Konsisten per bahasa (sudah dominan di repo, pertahankan):

| Bahasa | Function/Attr | File | Catatan |
|--------|---------------|------|---------|
| Go | `camelCase` | `snake_case.go` | ikuti idiom Go |
| JS | `camelCase` | `lowercase.js` | `parseArgs`, `cmd_add` |
| Shell | `snake_case` | `snake_case.sh` | `clear_last_lines`, `add_to_rc` |

- Nama jelas & deskriptif; hindari singkatan ambigu.
- Hindari variabel generik yang membingungkan (mis. `p` vs `utils` dipakai bergantian).

---

## 6. Reusable Utilities 🟠 IMPORTANT

Jangan duplikasi logika. Ekstrak ke modul bersama.

### Aturan
- Fungsi yang dipakai >1 tempat → pindah ke shared helper.
- Buat `helpers/` di luar `src/fex` agar reusable lintas tool.
- Untuk command eksternal, gunakan satu wrapper (`runExternal`, `runTmux`) dengan
  error handling seragam, bukan panggilan `exec` tersebar.

### Duplikasi yang harus diekstrak (temuan explore)
- `clearLastLines` (ANSI cleanup) — diduplikasi di beberapa script TUI.
- Fzf bindings builder: `buildFindModeBindings` vs `buildTreeModeBindings` (mirip).
- Format/warna TUI diulang di `gh-blin` & `ocm`.

---

## 7. Shell Scripting ISO 🔴 CRITICAL

### Aturan
- Script di `scripts/` & `bin/` yang berubah state → WAJIB `set -euo pipefail`.
- Guard command destruktif (`rm -rf`, `git reset --hard`) dengan konfirmasi/cek.
- Escape shell aman untuk argumen dinamis (`shEscape()`, `tmux split-window` dgn
  `shell=escape`) agar tidak inject/break.
- Usahakan POSIX-compliant bila memungkinkan; jika butuh Bash/Zsh, sebutkan eksplisit
  (shebang + comment).

### Status repo
- 11/15 script sudah `set -euo pipefail` ✅
- `src/fex/helpers/fzf-pick.sh`, `tmux-split.sh` sudah pakai escape aman ✅

---

## 8. Language & Emoji Convention 🟢 RECOMMENDED

- **Bahasa**: Indonesia untuk instruksi/prompt UI; English untuk term teknis
  (session, workspace, agent, credential).
- **Emoji**: gunakan konsisten. Tentukan set emoji per konteks (mode fzf 🔍/🌳,
  file 📁, issue 🐙) dan jangan acak di tiap TUI.
- Komentar: deskriptif, jelaskan "why" bukan "what".
- Dokumentasikan perubahan di `CHANGELOG.md` bila berdampak ke user.

---

## Pre-Commit Checklist

- [ ] Tidak ada mutasi objek existing (aturan #1)
- [ ] File ≤ 800 baris, fungsi ≤ 50 baris (aturan #2)
- [ ] Error tidak di-swallow, shell pakai `set -euo pipefail` (aturan #3, #7)
- [ ] Input divalidasi di boundary (aturan #4)
- [ ] Tidak ada duplikasi utilitas (aturan #6)
- [ ] `bash scripts/doctor.sh` & `bash scripts/check_syntax.sh` hijau

---

> *Dibuat oleh Goblin, dirawat oleh Goblin, untuk kedamaian terminal Goblin. 🍻👹*
