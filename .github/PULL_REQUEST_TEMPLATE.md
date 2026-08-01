## 📌 Description

Jelaskan secara singkat perubahan yang dilakukan dalam Pull Request ini, tujuan perbaikan/fitur, serta dampaknya pada repositori Goblin Vault.

Fixes #(issue_number)

---

## 🛠️ Type of Change

- [ ] 🐛 Bug fix (Perbaikan bug yang tidak merusak fitur existing)
- [ ] 🚀 New feature (Penambahan fitur baru yang backward-compatible)
- [ ] ⚠️ Breaking change (Perbaikan/fitur yang menyebabkan perubahan behavior existing)
- [ ] 🧹 Refactoring / Housekeeping (Pembersihan kode, optimasi, perapihan struktur)
- [ ] 📖 Documentation update (Perubahan/penambahan pada README, changelog, atau docs)

---

## 🔍 PR Checklist & Engineering Standards

Harap centang checklist di bawah ini sebelum meminta review:

- [ ] **Immutability Standard**: Tidak memutasi objek/array yang sudah ada (membuat copy baru).
- [ ] **Dual-Level Help Standard**: Jika menambahkan/mengubah CLI, sertakan help makro (`--help`) dan help kontekstual per-subcommand.
- [ ] **Syntax & Linter Check**: Sudah lolos pengujian `./scripts/check_syntax.sh`.
- [ ] **Modular Changelog**: Sudah memperbarui changelog per-tool di `docs/CHANGELOG/<tool>.md` (jika ada perubahan user-facing).
- [ ] **No Secrets**: Memastikan tidak ada credentials, API key, atau file `.env` yang terselip.
- [ ] **Fail-Fast & Friendly Error Handling**: Tangani error secara eksplisit dan berikan hint aksi perbaikan yang jelas.

---

## 🧪 Testing Verification

Jelaskan perintah atau pengujian manual yang telah dilakukan untuk memverifikasi perubahan ini:

```bash
# Perintah pengujian yang dijalankan
./scripts/check_syntax.sh
# ...
```

---

> *Dibuat oleh Goblin, dirawat oleh Goblin, untuk kedamaian terminal Goblin. 🍻👹*
