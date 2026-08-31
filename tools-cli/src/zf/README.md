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
  <strong>ZF Navigation Engine (Go + Bubble Tea + Lipgloss)</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Language-Go-00ADD8?style=for-the-badge&logo=go&logoColor=white&labelColor=1F2937" alt="Go" />
  <img src="https://img.shields.io/badge/TUI-Bubble_Tea-F43F5E?style=for-the-badge&labelColor=1F2937" alt="Bubble Tea" />
  <img src="https://img.shields.io/badge/Navigation-Zoxide-EC4899?style=for-the-badge&labelColor=1F2937" alt="Zoxide" />
  <img src="https://img.shields.io/badge/Multiplexer-Tmux-84CC16?style=for-the-badge&logo=tmux&logoColor=white&labelColor=1F2937" alt="Tmux" />
  <br/><br/>
</p>

# zf — Rapid Directory Navigation & Workspace Launcher

> **High-Frequency Workspace Control Center** — Sistem navigasi direktori instan dan workspace launcher berbasis Zoxide & Tmux yang ditulis dengan Go, Bubble Tea, dan Lipgloss. Menghadirkan interactive 3-pane TUI minimalis dengan Git Inspector, File Tree, OpenCode Inverted Full-Pill selection, dan pure Nerd Font icons.

---

## 🧠 Overview & Filosofi

**zf** merevolusi cara developer berpindah direktori (`cd`) di terminal modern. Berbeda dengan eksplorasi file massal di `fex`, `zf` difokuskan sebagai **pusat komando harian** berbasis frekuensi kunjungan Zoxide. Dilengkapi dengan live Git Status, hierarki file tree instan, editor in-place suspension, dan peluncur tool developer (`fex`, `gb`, `lazygit`, `code`, `tmux`).

---

## 🚀 Fitur Utama & Mode

1. **Pixel-Perfect 3-Pane Layout**:
   - **Pane Kiri (Workspaces)**: Daftar folder terindeks Zoxide dengan ranking score dan live search (`/`).
   - **Pane Kanan Atas (Git Status)**: Branch aktif, ahead/behind upstream, last commit info, dan scrollable diff file list (`M`, `A`, `D`, `?`).
   - **Pane Kanan Bawah (File Tree)**: File tree hierarkis dengan colored devicons Nerd Font (``, ``, ``, ``, `󰈚`, ``).
2. **OpenCode-Style Inverted Full-Pill Highlight**:
   - Baris yang disorot kursor diisi blok warna aksen tema penuh dari ujung kiri sampai kanan tanpa ada celah belang.
   - Teks, ikon, dan skor di dalam baris aktif otomatis dibalik menjadi hitam pekat (`#11111B`) ber-kontras tinggi.
3. **Declarative JSON Theme Engine (`~/.config/zf/themes/`)**:
   - Format tema 8 field sederhana berbasis JSON (`Monokai`, `Catppuccin`, `TokyoNight`, `Nord`, `Gruvbox`).
   - Drop & play: pengguna dapat menambahkan file tema kustom baru di `~/.config/zf/themes/*.json`.
4. **Interactive Command Palette (`?`) & Theme Palette (`T`)**:
   - Akses cepat seluruh menu aksi dan penggantian tema secara visual ala Raycast / OpenCode Command Palette.
5. **In-Place Editor Suspension (`tea.ExecProcess`)**:
   - Tekan `Enter` atau `e` pada file di File Tree untuk membuka `$EDITOR` (Neovim/Micro). Saat keluar dari editor, ZF langsung kembali ke posisi TUI terakhir secara instan (0ms) dengan live auto-refresh status Git.
   - Folder Guard: Otomatis mengabaikan penekanan `Enter`/`e` jika kursor berada pada folder (anti salah buka direktori).
6. **Ergonomic Arrow Navigation (`←` / `→`) & Continuous Cycling**:
   - Berpindah fokus antar panel kiri dan kanan menggunakan tombol panah `←` dan `→`.
   - Navigasi wrap-around (`--cycle`) aktif secara default pada list workspace, status git, dan file tree.
7. **Streamlined Tmux Controller (`zf tm`)**:
   - Alias pendek `zf tm` dengan flag ringkas: `-l` (list), `-n` (new), `-i` (in/attach), `-d` (del).

---

## 🛠️ CLI Usage & Flags

```
USAGE:
  zf [flags]
  zf [command]

CORE COMMANDS:
  init [shell]      Generate shell integration hook (zsh, bash, fish)
  add  [path]       Register directory into Zoxide database (default: $PWD)
  del  [path]       Remove directory from database (interactive if empty)
  rank              Display indexed directories ordered by frecency score
  tm   [flags]      Manage Tmux sessions (aliases: tmux) [-l, -n, -i, -d]
  exec <cmd>        Select workspace via TUI and execute command

ACTION FLAGS (Jump & Launch):
  -f, --fex           Jump to workspace and launch Fex
  -g, --gb            Jump to workspace and launch GitHub Assistant (gb)
  -l, --lg            Jump to workspace and launch LazyGit
  -c, --code          Jump to workspace and open in VS Code
  -x, --exec <cmd>    Jump to workspace and execute custom command

CONFIGURATION & OPTIONS:
      --theme <name>  Set TUI theme palette (catppuccin, tokyonight, monokai, nord, gruvbox)
  -v, --version       Display version information
  -h, --help          Display help overview
```

---

## ⌨️ Cheatsheet Keybindings TUI

| Tombol | Fungsi & Aksi |
| :---: | :--- |
| **`j` / `k`** atau **`↑` / `↓`** | Pindah pilihan baris (Continuous Cycling wrap-around) |
| **`←` / `→`** | Pindah fokus panel (Workspaces ↔ File Tree) |
| **`Tab` / `Shift+Tab`** | Pindah fokus panel (Workspaces ➔ Git ➔ Tree) |
| **`/`** | Live search / filter workspace |
| **`Enter`** | Jump (`cd` ke direktori) saat di panel kiri / Edit file saat di panel kanan |
| **`e`** | Buka di `$EDITOR` (In-place pause & instant return) |
| **`t`** | Buka / buat sesi Tmux di direktori |
| **`f`** | Buka di `fex` |
| **`g`** | Buka di `gb` |
| **`l`** | Buka di `lazygit` |
| **`T`** | Buka Interactive Theme Palette (`~/.config/zf/themes/`) |
| **`?`** | Buka Interactive Command Palette |
| **`r`** | Reload data workspace & status git |
| **`d`** | Hapus direktori dari database Zoxide (*dengan konfirmasi modal*) |
| **`q` / `Ctrl+c` / `Esc`** | Keluar dari TUI |

---

## 🧩 Shell Integration

Agar perintah `zf` dapat memindahkan working directory (`cd`) langsung di terminal aktif BOSS, tambahkan baris berikut ke file konfigurasi shell:

### Zsh (`~/.zshrc`)
```bash
eval "$(zf init zsh)"
```

### Bash (`~/.bashrc`)
```bash
eval "$(zf init bash)"
```

### Fish (`~/.config/fish/config.fish`)
```fish
zf init fish | source
```
