# Coding Style — Goblin Vault

Panduan ini berisi aturan coding yang relatif stabil untuk **Goblin Vault**.
Isinya sengaja dibuat sebagai **policy**, bukan audit report, bukan refactor backlog,
dan bukan snapshot kondisi repo hari ini.

Kalau ada temuan spesifik seperti file yang perlu di-refactor, command yang bermasalah,
atau status jumlah script yang sudah lulus check, taruh di issue, changelog, atau
catatan history — jangan di file ini.

## Severity

- 🔴 **MUST** — wajib, pelanggaran bisa jadi blocker.
- 🟠 **SHOULD** — sangat disarankan, boleh dilanggar dengan alasan jelas.
- 🟢 **MAY** — preferensi/convention, ikuti kalau tidak ada alasan kuat.

Bahasa dokumentasi utama adalah Indonesia. Istilah teknis boleh memakai English kalau
lebih natural, misalnya `workflow`, `session`, `config`, `validation`, `error handling`,
dan `dependency`.

---

## 1. Prinsip Umum 🔴 MUST

- Prioritaskan kode yang stabil, jelas, dan mudah di-debug.
- Perubahan harus kecil, fokus, dan reversible bila memungkinkan.
- Jangan menambah abstraction hanya karena terlihat rapi; abstraction harus mengurangi
  duplikasi nyata atau memperjelas boundary.
- Jangan menyembunyikan side-effect. Kalau fungsi membaca file, menulis file, menjalankan
  command eksternal, atau mengubah state, buat efeknya jelas dari nama, lokasi, atau flow.
- Hindari magic behavior yang membuat CLI sulit diprediksi.

---

## 2. Data & Immutability 🟠 SHOULD

Immutability adalah default yang baik, terutama untuk transformasi config, JSON/JSONC,
state TUI, dan data yang diterima dari luar fungsi.

### Aturan

- Jangan mutasi input object/array dari caller kecuali kontraknya jelas.
- Untuk transformasi data, prefer return object/array baru.
- Mutasi lokal boleh kalau scoped, tidak keluar dari fungsi, dan membuat kode lebih sederhana.
- Hindari global mutable state kecuali benar-benar diperlukan dan lifecycle-nya jelas.

### Contoh

```js
// Prefer: return copy baru
const nextItems = items.filter((item) => item.enabled);

// Boleh: mutasi lokal yang tidak bocor keluar fungsi
const lines = [];
for (const item of nextItems) {
  lines.push(formatItem(item));
}
```

Intinya: yang dilarang bukan “semua mutasi”, tapi mutasi yang bikin side-effect
tersembunyi dan susah dilacak.

---

## 3. File Organization 🟠 SHOULD

- Prefer many small focused files daripada satu file raksasa.
- Satu file sebaiknya punya satu tanggung jawab utama.
- File yang terlalu besar perlu dipertimbangkan untuk dipecah, tapi ukuran bukan satu-satunya
  metric. Cohesion lebih penting daripada angka baris.
- Fungsi panjang boleh dipecah kalau sudah mencampur parsing, validation, rendering,
  side-effect, dan error handling dalam satu tempat.
- Organisasi modul sebaiknya berdasarkan domain/feature, bukan semata-mata tipe file.

Rule praktis:

- 🟢 200–400 baris: biasanya nyaman.
- 🟠 >800 baris: perlu alasan jelas atau rencana pemecahan.
- 🔴 File besar yang banyak concern dan sulit dites: refactor.

---

## 4. Error Handling 🔴 MUST

- Tangani error secara eksplisit.
- Jangan silent swallow error tanpa fallback yang jelas.
- Error internal boleh detail; pesan ke user harus tetap ramah dan actionable.
- CLI harus punya exit code yang masuk akal.
- Saat wrapping error, tambahkan konteks supaya sumber masalah bisa dilacak.

### Go

```go
if err := runTask(); err != nil {
    return fmt.Errorf("run task: %w", err)
}
```

### JavaScript

```js
try {
  await runTask();
} catch (err) {
  console.error(`Gagal menjalankan task: ${err.message}`);
  process.exit(1);
}
```

### Shell

Script yang mengubah state wajib fail-fast:

```sh
set -euo pipefail
```

`2>/dev/null` boleh dipakai untuk probing command eksternal, selama ada fallback atau
handling yang jelas. Yang dilarang adalah menutup error lalu lanjut seolah semua aman.

---

## 5. Input Validation 🔴 MUST

Validasi semua input di boundary sistem.

- Validasi argumen CLI sebelum diproses.
- Validasi path sebelum dipakai untuk read/write.
- Validasi shape config/file sebelum diasumsikan benar.
- Validasi dependency command eksternal sebelum dieksekusi.
- Fail fast dengan pesan yang jelas.

Contoh boundary yang wajib divalidasi:

- CLI flags dan positional arguments.
- File path dari user.
- JSON/JSONC/YAML config.
- Environment variables.
- Output command eksternal.
- Response API.

---

## 6. Shell Scripting Standards 🔴 MUST

- Script yang mengubah state wajib memakai `set -euo pipefail`.
- Quote semua path dan argumen dinamis.
- Command destruktif seperti `rm -rf`, `git reset --hard`, dan overwrite file massal wajib
  punya guard atau validasi target.
- Hindari eval kecuali benar-benar tidak ada opsi lain.
- Kalau script membutuhkan Bash/Zsh-specific feature, sebutkan lewat shebang dan komentar.
- Prefer command yang predictable daripada alias/function dari environment user.

---

## 7. External Commands & Dependencies 🟠 SHOULD

- Cek dependency command eksternal sebelum dipakai.
- Berikan pesan install/fallback yang jelas kalau dependency tidak tersedia.
- Jangan menambah dependency besar tanpa alasan yang terukur.
- Bungkus pemanggilan command eksternal di helper kalau dipakai berulang atau butuh behavior
  error handling yang konsisten.

---

## 8. Naming & Formatting 🟢 MAY

Ikuti idiom bahasa masing-masing.

| Bahasa | Function/Variable | File | Catatan |
|--------|-------------------|------|---------|
| Go | `camelCase` / exported `PascalCase` | `snake_case.go` | Ikuti idiom Go |
| JS | `camelCase` | `lowercase.js` | Nama harus jelas dan searchable |
| Shell | `snake_case` | `snake_case.sh` | Cocok untuk function dan variable |

Aturan umum:

- Nama harus menjelaskan maksud, bukan cuma tipe.
- Hindari singkatan ambigu.
- Komentar menjelaskan “why”, bukan mengulang “what”.
- Konsisten dengan style file sekitar sebelum memperkenalkan style baru.

---

## 9. CLI UX 🟠 SHOULD

Goblin Vault berisi banyak CLI dan TUI, jadi UX terminal harus dijaga.

- Output normal jangan terlalu noisy.
- Error harus jelas, ramah, dan kasih next step bila memungkinkan.
- Help text harus sesuai behavior aktual.
- Prompt interaktif harus aman untuk dibatalkan.
- Jangan membuat automation yang melakukan destructive action tanpa konfirmasi atau guard.
- Emoji boleh dipakai untuk memperjelas konteks, tapi jangan sampai mengganggu parsing output.

### Standard Banner ASCII Header 🟠 SHOULD

Setiap alat CLI/TUI utama di Goblin Vault sebaiknya menyajikan header help / landing menu menggunakan **ANSI Block Header Style** agar konsisten:
- **Font Style**: Gunakan Unicode Solid Block Font (`█`, `▀`, `▄`, `╔`, `╗`, `╚`, `╝`).
- **Layout & Spacing**: Tempatkan nama alat CLI dan versinya persis di **bawah** banner ASCII art, dan sertakan margin 1 baris kosong (`echo ""`) di atas banner agar tidak menempel pada prompt terminal user (`shobixlinuxdev>`).
- **Coloring**: Default warna banner adalah **Pure White (`\033[1;37m`)** untuk kesan ultra-clean & berkelas (kecuali tool khusus seperti `OCM` yang memiliki skema warna identitas tersendiri).

---

## 10. Documentation & Changelog 🟠 SHOULD

- Update dokumentasi kalau behavior user-facing berubah.
- Update `CHANGELOG.md` untuk perubahan yang berdampak ke pengguna tools.
- Jangan menaruh audit report, backlog, atau status repo temporer di coding-style.
- Catatan temuan spesifik sebaiknya masuk ke issue, `docs/history/`, atau dokumen planning
  yang memang lifecycle-nya sementara.

---

## Pre-Change Checklist

- [ ] Perubahan kecil dan fokus.
- [ ] Input user/config tervalidasi.
- [ ] Error handling eksplisit dan tidak silent swallow.
- [ ] Shell script state-changing memakai `set -euo pipefail`.
- [ ] Path dan argumen dinamis di-quote dengan aman.
- [ ] Tidak ada secret/credential masuk repo.
- [ ] Dokumentasi/changelog di-update bila behavior user-facing berubah.

---

> *Coding style harus jadi kompas, bukan museum snapshot repo. 🍻👹*
