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
  <img src="https://img.shields.io/badge/Language-Go%201.22-00F0FF?style=for-the-badge&logo=go&logoColor=black&labelColor=1F2937" alt="Go" />
  <img src="https://img.shields.io/badge/CLI-Cobra-A855F7?style=for-the-badge&logo=go&logoColor=white&labelColor=1F2937" alt="Cobra" />
  <img src="https://img.shields.io/badge/Engine-fzf-FF007F?style=for-the-badge&labelColor=1F2937" alt="fzf" />
  <img src="https://img.shields.io/badge/Integration-Tmux-84CC16?style=for-the-badge&logo=tmux&logoColor=black&labelColor=1F2937" alt="Tmux" />
  <img src="https://img.shields.io/badge/Editor-Neovim%20%7C%20Micro-10B981?style=for-the-badge&logo=neovim&logoColor=white&labelColor=1F2937" alt="Editor Neovim / Micro" />
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

| Key          | Aksi                                                                                                                     |
| :----------- | :----------------------------------------------------------------------------------------------------------------------- |
| `Enter`      | Buka file di Editor default / Masuk direktori                                                                            |
| `Tab`        | 🔄 Beralih mode secara instan (**Tree Mode ⇄ Flat Find Mode**)                                                           |
| `Alt-c`      | 📋 Tandai file/folder untuk **Salin (Copy)**                                                                             |
| `Alt-m`      | 📦 Tandai file/folder untuk **Pindah (Move / Cut)**                                                                      |
| `Ctrl-v`     | 📥 **Tempel (Paste)** file/folder di direktori aktif                                                                     |
| `Ctrl-d`     | 🗑️ Hapus file/folder (dengan konfirmasi aman)                                                                            |
| `Ctrl-r`     | ✏️ Ganti nama file / direktori                                                                                           |
| `Ctrl-n`     | 📄 Buat file baru (Tree mode)                                                                                            |
| `Ctrl-k`     | 📁 Buat folder baru (Tree mode)                                                                                          |
| `Ctrl-g`     | 🐙 **Context-Aware Git**: **File Diff & Commit History** (jika kursor di file) / **lazygit TUI** (jika kursor di folder) |
| `Ctrl-y`     | 📋 Salin path file ke clipboard OS (**Universal OSC 52 + Wayland/X11**)                                                  |
| `Ctrl-f`     | 🔍 Buka pencarian konten file interaktif (**ripgrep search mode**)                                                       |
| `Ctrl-b`     | ⭐ Tambahkan direktori ke Bookmark                                                                                       |
| `Ctrl-x`     | ❌ Hapus direktori dari Bookmark                                                                                         |
| `Ctrl-o`     | 🖥️ Buka direktori di pane tmux sebelah                                                                                   |
| `Ctrl-s`     | 🖥️ Toggle tampilan preview ukuran penuh / half                                                                           |
| `Ctrl-h / ?` | ❓ Buka dialog popup bantuan seluruh keybindings                                                                         |

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

## ⚙️ Konfigurasi (`~/.config/fex/config.yaml`)

File konfigurasi otomatis dibuat pada saat pertama kali `fex` dijalankan (dengan fallback auto-migrasi dari legacy `~/.config/fe/config.yaml`). Template master tersimpan di repositori vault pada `configs/fex/config.yaml`:

```yaml
# General
find_depth: 5
find_filter: -not -path "*/.npm/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/vendor/*" -not -path "*/target/debug/*" -not -path "*/dist/*"
bookmarks_file: ~/.cache/fex-bookmarks

# Tools & Layout
editor: "" # auto-detect (micro > nano > vim > vi)
editor_opts: ""
preview_cmd: "" # auto-detect (bat > batcat > cat -n)
use_fd: true
preview_size: up:75%

# Keybindings Override
keybindings:
  switch_mode: tab # Tree ⇄ Flat find
  search: ctrl-f # Live Ripgrep search
  git: ctrl-g # Git history & diff / lazygit
  help: ctrl-h # Keybindings popup
  copy_path: ctrl-y # Copy path (OSC 52)
  mark_copy: alt-c # Copy mark
  mark_move: alt-m # Move mark
  paste: ctrl-v # Paste
  rename: ctrl-r # Rename
  delete: ctrl-d # Delete
  new_file: ctrl-n # New file
  new_folder: ctrl-k # New folder
  toggle_preview: ctrl-p # Toggle preview
  toggle_layout: ctrl-s # Toggle layout
  bookmark: ctrl-b # Bookmark
  unbookmark: ctrl-x # Unbookmark
  tmux_pane: ctrl-o # Tmux split right
```

### 📦 Backup & Restore Config

Integrasi sinkronisasi config langsung ke goblin-vault:

- `fex backup fex` / `fex restore fex` — backup/restore config `fex`
- `fex backup micro` / `fex restore micro` — backup/restore config `micro` editor
- `fex backup all` / `fex restore all` — backup/restore seluruh tool configs sekaligus

---

## 🧩 Dependencies & Prasyarat

- **Compiler**: Go `1.22` atau versi lebih tinggi
- **Required System Tools**: `fzf`
- **Optional Tools (Rekomendasi)**: `fd` (find fallback), `rg` (ripgrep), `bat` (syntax highlight preview), `tmux` (split preview).
