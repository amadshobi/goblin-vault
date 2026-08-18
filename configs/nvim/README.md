# 🌌 NeoVim Custom Configuration Master

> **Crafted with passion by [amadshobi](https://github.com/amadshobi)**  
> _A high-velocity, ultra-ergonomic Neovim distribution blending the simplicity of Micro/VS Code with the powerhouse speed of LazyVim & Snacks.nvim._

---

## ⚡ Core Philosophy & Architecture

Setup ini dirancang untuk **menghilangkan friksi mental** saat beralih antara GUI editor (VS Code), lightweight terminal editor (Micro), dan IDE modal tingkat lanjut (Neovim).

- **Hybrid Familiarity**: Shortcut standar modern (`Ctrl-S` save, `Ctrl-Z` undo, `Ctrl-Y` redo, `Ctrl-A` select all, `Ctrl-C`/`Ctrl-V` clipboard) bekerja di semua mode tanpa perlu selalu memikirkan Normal/Insert state.
- **Snappy Performance**: Didukung oleh **Blink.cmp** (engine autocompletion Rust/C speed) dan **Snacks.nvim** modern framework.
- **Micro-Style Navigation**: `whichwrap` aktif untuk navigasi panah lintas baris, `Ctrl-X` untuk quit instan, dan `Ctrl-B` untuk menutup buffer.
- **Zero Configuration Lag**: OpenCode JSON Schema otomatis tervalidasi untuk `opencode.json` & `.opencode/`.

---

## 🧰 Arsenal & Plugin Highlights

| Component                   | Technology                                          | Rationale & Power                                                            |
| :-------------------------- | :-------------------------------------------------- | :--------------------------------------------------------------------------- |
| **Framework**               | [LazyVim](https://github.com/LazyVim/LazyVim)       | Modular plugin management dengan lazy loading instan.                        |
| **Completion**              | [Blink.cmp](https://github.com/Saghen/blink.cmp)    | Autocomplete engine super kencang dengan fuzzy matcher presisi.              |
| **UI Suite**                | [Snacks.nvim](https://github.com/folke/snacks.nvim) | Floating Terminal (`<F4>` / `<Alt-t>`), Fast Picker, Explorer, & Git viewer. |
| **LSP & Schemas**           | Mason + Nvim-LSPConfig                              | Language servers otomatis + Schema validator untuk OpenCode ecosystem.       |
| **Multi-Cursor**            | `vim-visual-multi`                                  | Multi-cursor editing ala VS Code / Sublime Text (`Ctrl-N`).                  |
| **Formatting**              | Conform.nvim + Stylua                               | Auto formatting on save untuk Lua, TypeScript, Python, dan JSON.             |
| **Git Superpowers**         | Gitsigns.nvim                                       | Real-time gutter diffs, blame lines, dan hunk stage navigasi.                |
| **Dictionary Autocomplete** | Custom Dictionary                                   | Kamus kustom `dict/fronmatter-yml.md` untuk Markdown & YAML frontmatter.     |

---

## ⌨️ Daftar Keybindings & Shortcuts Lengkap

### 1. General & Editing (Micro / VS Code Style)

| Shortcut |     Mode      | Aksi                                                  |
| :------- | :-----------: | :---------------------------------------------------- |
| `Ctrl-S` | `i`, `n`, `v` | 💾 **Save File** instan                               |
| `Ctrl-X` |   `n`, `i`    | 🚪 **Quit** Neovim                                    |
| `Ctrl-X` |      `v`      | ✂️ **Cut** seleksi teks ke system clipboard           |
| `Ctrl-C` |      `v`      | 📋 **Copy** seleksi teks ke system clipboard          |
| `Ctrl-V` | `i`, `n`, `v` | 📥 **Paste** dari system clipboard                    |
| `Ctrl-Z` |   `i`, `n`    | ↩️ **Undo** (langsung dari Insert mode)               |
| `Ctrl-Y` |   `i`, `n`    | 🔁 **Redo** (langsung dari Insert mode)               |
| `Ctrl-A` |   `i`, `n`    | 📑 **Select All** seluruh dokumen                     |
| `Ctrl-K` |   `i`, `n`    | 🗑️ **Delete Line** (Hapus 1 baris aktif)              |
| `Ctrl-N` |      `n`      | 📄 **New Buffer** / file baru                         |
| `Ctrl-B` |      `n`      | ❌ **Close Buffer** aktif                             |
| `Ctrl-E` |   `n`, `i`    | 💻 **Command Bar** (`:`)                              |
| `Ctrl-R` |   `n`, `i`    | 🔄 **Toggle Mode**: Edit (Insert) ⇄ Read-Only/Command |

### 2. Navigation & Line Manipulation

| Shortcut                |     Mode      | Aksi                                        |
| :---------------------- | :-----------: | :------------------------------------------ |
| `Alt-Up` / `Alt-Down`   | `n`, `i`, `v` | ↕️ **Move Line** naik/turun (VS Code style) |
| `Alt-Shift-Up` / `Down` | `n`, `i`, `v` | 📑 **Duplicate Line** ke atas / bawah       |
| `Alt-/`                 | `n`, `i`, `v` | 💬 **Toggle Comment** baris/seleksi         |
| `Tab` / `Shift-Tab`     |   `v`, `n`    | ⏩ **Indent / Dedent** teks                 |
| `Ctrl-Left` / `Right`   |   `n`, `i`    | 🔤 Navigasi per-kata                        |
| `Ctrl-Backspace`        |   `n`, `i`    | ⌫ Hapus 1 kata ke belakang                  |
| `Ctrl-Delete`           |   `n`, `i`    | ⌦ Hapus 1 kata ke depan                     |
| `Alt-,` / `Alt-.`       |      `n`      | 🔄 Navigasi buffer sebelumnya / berikutnya  |

### 3. Floating Terminal, Search & Tools

| Shortcut              |     Mode      | Aksi                                              |
| :-------------------- | :-----------: | :------------------------------------------------ |
| `<F4>` atau `<Alt-t>` | `n`, `i`, `t` | 🖥️ **Toggle Floating Terminal** (Snacks.terminal) |
| `Ctrl-F`              |   `n`, `i`    | 🔍 **Live Project Grep Search** (Snacks.picker)   |
| `Ctrl-H`              |      `n`      | 🔎 **Grep String under cursor**                   |
| `Ctrl-O`              |      `n`      | 📁 **Snacks File Explorer** di direktori aktif    |

---

## 📁 Struktur Konfigurasi

```text
configs/nvim/
├── init.lua                 # Entrypoint konfigurasi
├── lazyvim.json             # Konfigurasi modul LazyVim
├── lazy-lock.json           # Pin lock version untuk kestabilan plugin
├── dict/                    # Kamus kustom lokal
│   └── fronmatter-yml.md    # Autocomplete schema frontmatter
├── snippets/                # Koleksi custom snippet
│   ├── markdown.json
│   └── yaml.json
└── lua/
    ├── config/
    │   ├── autocmds.lua     # Statusline kustom & dictionary hook
    │   ├── keymaps.lua      # Micro-style master keybinding engine
    │   ├── lazy.lua         # Plugin manager boostrap
    │   └── options.lua      # Seamless whichwrap & visual options
    └── plugins/
        ├── blink.lua        # Blink.cmp completion setup
        ├── colors.lua       # Themes (Darcula / TokyoNight)
        ├── formatting.lua   # Conform formatter
        ├── gitsigns.lua     # Git gutter integration
        ├── lsp.lua          # LSP servers + OpenCode JSON schema
        ├── snacks.lua       # Floating terminal & picker tools
        ├── vscode-ui.lua    # VSCode visual layout
        └── which-key.lua    # Interactive key cheatsheet
```

---

## 🚀 Cara Instalasi & Sinkronisasi

### Metode 1: Menggunakan Goblin Vault Installer

Jalankan installer resmi Goblin Vault untuk auto-symlink:

```bash
./scripts/install.sh config
# atau jalankan seluruh suite:
./scripts/install.sh all
```

### Metode 2: Menggunakan FEX Command

```bash
fex restore nvim
```

### Metode 3: Manual Symlink

```bash
mkdir -p ~/.config
ln -sfn ~/civil/goblin-vault/configs/nvim ~/.config/nvim
```

---

> _Designed & Maintained by **amadshobi** for the ultimate Goblin Terminal Experience. 🍻👹_
