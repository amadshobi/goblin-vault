<p align="center">
  <br/>
  <pre align="center">
 ███████╗███████╗██╗  ██╗
 ██╔════╝██╔════╝╚██╗██╔╝
 █████╗  █████╗   ╚███╔╝ 
 ██╔══╝  ██╔══╝   ██╔██╗ 
 ██║     ███████╗██╔╝ ██╗
 ╚═╝     ╚══════╝╚═╝  ╚═╝
  </pre>
  <br/><br/>
  <strong>File Explorer TUI (Go Hybrid)</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Language-Go%201.22-00F0FF?style=for-the-badge&logo=go&logoColor=black&labelColor=0D1117" alt="Go" />
  <img src="https://img.shields.io/badge/CLI-Cobra-A855F7?style=for-the-badge&logo=go&logoColor=white&labelColor=0D1117" alt="Cobra" />
  <img src="https://img.shields.io/badge/Engine-fzf-FF007F?style=for-the-badge&labelColor=0D1117" alt="fzf" />
  <img src="https://img.shields.io/badge/Integration-Tmux-84CC16?style=for-the-badge&logo=tmux&logoColor=white&labelColor=0D1117" alt="Tmux" />
  <img src="https://img.shields.io/badge/Editor-Neovim%20%7C%20Micro-10B981?style=for-the-badge&logo=neovim&logoColor=white&labelColor=0D1117" alt="Editor Neovim / Micro" />
  <br/><br/>
  <img src="../../../docs/assets/gif/fex.gif" alt="fex demo" width="800" />
  <br/>
</p>

# fex — File Explorer TUI

> **fzf + tmux split + micro** — File Explorer hibrida berkinerja tinggi, modular, dan ramah tmux untuk era terminal modern.

---

## 🧠 Deskripsi Singkat

**fex** adalah pengelola berkas terminal (TUI) berbasis Go hibrida yang menggabungkan kecepatan pemrosesan statis Go dengan flesibilitas manajemen pane tmux via Bash helpers. Dibangun untuk menggantikan script shell `fe` yang lambat, `fex` menawarkan navigasi instan menggunakan mesin pencari `fzf`, integrasi penyunting kode favorit (default `micro`), pencarian teks secara menyeluruh (`ripgrep`), dan bookmark direktori.

---

## ✨ Fitur & Kelebihan Utama

- 🚀 **Go Hybrid Architecture**: Otak logika, manajemen bookmark, status CLI, dan fzf dispatch ditangani oleh Go, sedangkan aksi manipulasi tmux window didistribusikan ke Bash helpers.
- 🌳 **4 Mode Navigasi Utama**:
  1. **Find Mode** — Mencari file berdasarkan nama dengan filter presisi.
  2. **Tree Mode** — Navigasi hierarki folder yang interaktif.
  3. **Search Mode** — Melakukan pencarian teks di dalam file menggunakan ripgrep (`rg`).
  4. **Bookmarks Mode** — Akses instan ke direktori-direktori penting yang telah disimpan.
- 🖥️ **Tmux Integration**: Mendukung pembukaan file secara langsung pada pane split tmux di sebelah kanan atau jendela baru.
- ⚙️ **Dual-Level Help System**: Bantuan dasar via `fex --help` dan bantuan Command tingkat lanjut via subcommand.

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`fex --help`)
Menyajikan daftar global options, mode eksekusi utama, serta shortcut keyboard bawaan.

### Level 2 Help
Setiap subcommand pendukung (seperti `kill`, `editor`, `backup`) memiliki dokumentasi parameter internal tersendiri:
```bash
fex <subcommand> --help
```

---

## ⌨️ Pintasan Keyboard (Di Dalam UI Fzf)

| Key | Aksi |
|-----|------|
| `Enter` | Buka file di Editor default |
| `Ctrl-d` | Hapus file (dengan konfirmasi aman) |
| `Ctrl-r` | Ganti nama file / direktori |
| `Ctrl-n` | Buat file baru (Tree mode) |
| `Ctrl-k` | Buat folder baru (Tree mode) |
| `Ctrl-g` | Tampilkan status/log git |
| `Ctrl-y` | Salin path file ke clipboard |
| `Ctrl-b` | Tambahkan direktori ke Bookmark |
| `Ctrl-x` | Hapus direktori dari Bookmark |
| `Ctrl-f` | Lakukan search ripgrep di dalam hasil |
| `Ctrl-o` | Buka direktori di pane tmux baru |
| `Ctrl-s` | Toggle tampilan preview ukuran penuh |
| `Tab` | Pilih banyak file sekaligus (*multi-select*) |

---

## 📋 Penggunaan & Contoh Perintah

```bash
# Menjelajahi direktori saat ini
fex

# Menjelajahi path tertentu
fex /var/log

# Membuka dengan filter ekstensi file
fex .go

# Membuka dalam Tree Mode (Folder Explorer)
fex --tree

# Melakukan pencarian isi file secara instan
fex --search "func main"

# Mengakses daftar bookmark direktori
fex --bookmarks
```

---

## 📂 Struktur File & Arsitektur

```
src/fex/
├── cmd/
│   └── fex/
│       ├── main.go            # Entry point binary
│       ├── root.go            # Root command & Cobra parser
│       ├── search_mode.go     # Logika search mode (ripgrep)
│       └── tree_mode.go       # Logika tree mode (folder explorer)
├── internal/
│   ├── config/                # Parser Viper YAML configuration
│   ├── fzf/                   # Wrapper generic untuk fzf execution
│   ├── session/               # Manajemen session statis & Bookmarks
│   ├── tmux/                  # Jembatan IPC Go ke script tmux shell
│   ├── tree/                  # File scanner & tree generator
│   └── ui/                    # Render Nerd Font icons & ANSI styling
├── helpers/                   # Script shell untuk manipulasi pane tmux
├── docs/                      # Manual dan detail manual internal
└── go.mod
```

---

## ⚙️ Konfigurasi (`~/.config/fe/config.yaml`)

File konfigurasi otomatis dibuat pada saat pertama kali `fex` dijalankan:

```yaml
editor: micro
preview: true
preview_size: 15
show_hidden: false
max_depth: 8
fd_binary: fd
rg_binary: rg
```

---

## 🧩 Dependencies & Prasyarat

- **Compiler**: Go `1.22` atau versi lebih tinggi
- **Required System Tools**: `fzf`
- **Optional Tools (Rekomendasi)**: `fd` (find fallback), `rg` (ripgrep), `bat` (syntax highlight preview), `tmux` (split preview).
