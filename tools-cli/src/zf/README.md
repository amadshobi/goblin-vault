<p align="center">
  <br/>
  <pre align="center">
 ███████╗███████╗
 ╚══███╔╝██╔════╝
   ███╔╝ █████╗  
  ███╔╝  ██╔══╝  
 ███████╗██║     
 ╚══════╝╚═╝     
  </pre>
  <br/><br/>
  <strong>Zoxide & Tmux Helper (Pure Shell)</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Language-Zsh-10B981?style=for-the-badge&logo=gnu-bash&logoColor=white&labelColor=0D1117" alt="Zsh" />
  <img src="https://img.shields.io/badge/Navigation-Zoxide-EC4899?style=for-the-badge&labelColor=0D1117" alt="Zoxide" />
  <img src="https://img.shields.io/badge/Multiplexer-Tmux-84CC16?style=for-the-badge&logo=tmux&logoColor=white&labelColor=0D1117" alt="Tmux" />
  <img src="https://img.shields.io/badge/Finder-fzf-FF007F?style=for-the-badge&labelColor=0D1117" alt="fzf" />
  <br/><br/>
  <img src="../../../docs/assets/gif/zf-demo.gif" alt="zf demo" width="800" />
  <br/>
</p>

# zf — Zoxide & Tmux Helper

> **Fast Directory Navigation & Shell Integrator** — Pemandu navigasi direktori instan berbasis shell Zsh/Bash, terintegrasi dengan Zoxide, Fzf, Tmux, dan editor.

---

## 🧠 Deskripsi Singkat

**zf** adalah fungsi utilitas shell Zsh modular yang menggabungkan kemampuan indeks database zoxide dengan GUI pencarian interaktif `fzf` untuk mempercepat pemindahan direktori (`cd`). Selain navigasi murni, `zf` mendukung *Action Mode* untuk melompat langsung ke direktori tujuan lalu langsung mengeksekusi tool developer pilihan (seperti membuka editor, menjalankan `fex`, `lazygit`, atau meluncurkan sesi `tmux`).

---

## 🚀 Fitur Utama & Mode

1. **Smart Jump & Pick (`cd`)**:
   - `zf` — Membuka picker interaktif `fzf` berisi daftar direktori yang sering diakses (skor zoxide) lengkap dengan visual tree preview panel di sebelah kanan. Memilih direktori akan langsung memindahkan shell aktif (`cd`).
2. **Action Mode (Jump + Exec)**:
   - `--fex, -f` — Lompat ke direktori + jalankan `fex` (File Explorer).
   - `--fextr, -t` — Lompat ke direktori + jalankan `fex --tree`.
   - `--gh-blin, -g` — Lompat ke direktori + jalankan `gh-blin` (GitHub TUI).
   - `--lg, -l` — Lompat ke direktori + jalankan `lazygit`.
   - `--code, -c` — Lompat ke direktori + buka VS Code.
3. **Zoxide Database Administrator**:
   - `--add, -a` — Daftarkan direktori aktif/pilihan ke database zoxide.
   - `--del, -d` — Pilih dan hapus direktori dari index database zoxide secara interaktif.
   - `--rank, -r` — Tampilkan daftar direktori terindeks beserta skor frekuensi kunjungan (*ranking scores*).
4. **Tmux Session Management**:
   - `--tmux new` — Lompat ke direktori + buat/masuk sesi tmux baru.
   - `--tmux in` — Tampilkan session active + attach ke tmux session.
   - `--tmux kill` — Tampilkan list active session + matikan/kill tmux session pilihan.

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`zf --help` atau `zf -h`)
Menampilkan daftar manual argumen flags, mode integrasi tools, manajemen zoxide admin, dan control session tmux.

---

## 📋 Penggunaan & Contoh Perintah

### Navigasi Interaktif Standar
```bash
zf
```
*Gunakan tombol ketik untuk menyaring, Enter untuk JUMP (cd), Esc untuk keluar.*

### Navigasi Langsung Jalankan Fex
```bash
zf -f
```

### Membuka Project Terpilih di VS Code
```bash
zf -c
```

### Menghapus Folder dari Index Zoxide
```bash
zf --del
```

### Attach ke Sesi Tmux Aktif
```bash
zf --tmux in
```

---

## 📂 Struktur File & Arsitektur

```
src/zf/
├── zf.sh               # Entry point utama, parser mode, dan dispatcher fzf
├── preview.sh          # Helper generator tampilan preview window di sebelah kanan fzf
├── tmux.sh             # Logic session manager, attach/switch client, dan kill-session
└── zoxide_admin.sh     # Logic database helper (add/delete/rank path di zoxide)
```

---

## 🧩 Dependencies & Prasyarat

- **Shell**: Zsh atau Bash (posix-compliant router)
- **Required Tools**: `zoxide`, `fzf`
- **Optional Target Tools**: `tmux`, `lazygit`, `fex`, `code` (VS Code).
