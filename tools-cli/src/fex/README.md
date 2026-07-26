
                                           ______ _____ __   __
                                           |  ____|  ___|\ \ / /
                                           | |__  | |__   \ V / 
                                           |  __| |  __|   > <  
                                           | |    | |___  / . \ 
                                           |_|    |____| /_/ \_\            

# fex — File Explorer (Go Hybrid)

> **fzf + tmux split + micro** — VS Code goblin edition file explorer.
> Karena `fe` udah diambil. Ini fex. Lebih cepet. Lebih goblin.

---

## 🧠 What is fex?

**fex** is a terminal-based file explorer / project browser built as a **Go hybrid**:

- **Go core** — CLI, config, fzf dispatch, file ops, session state, tree navigation
- **Bash helpers** — tmuz split/window management (karena shell masih king buat tmux)
- **fzf** — interactive selection, preview, multi-select
- **micro** — the actual editor (but fex is editor-agnostic)

Born from the ashes of the original bash-only `fe` v1→v3. Migrated to Go because **pure bash for this complexity is a nightmare** (10x revisions for one bugfix — ask BOSS).

---

## ✨ Features

| Feature | Status |
|---------|--------|
| 📂 Browse files (fd/find) | ✅ |
| 🔍 Text search (ripgrep) | ✅ |
| 🌳 Tree navigation (folder explorer) | ✅ |
| 📑 Bookmarks (add/remove/list) | ✅ |
| 🗑️ Delete with confirmation | ✅ |
| ✏️ Rename with dialog | ✅ |
| 📄 New file / folder | ✅ |
| 🖥️ Tmux split + open in right pane | ✅ |
| 🔑 Git status / log | ✅ |
| 📋 Copy path to clipboard | ✅ |
| 🔎 Full-screen preview toggle | ✅ |
| ⚙️ YAML config (`~/.config/fe/config.yaml`) | ✅ |
| 🎨 File type icons (Nerd Font) | ✅ |
| 🕐 Recent files | 🔜 |
| 🎯 Filter presets (`--code`, `--docs`, ...) | 🔜 |
| 📊 Sort options (`--sort=name|date|size`) | 🔜 |
| 🖼️ Image preview | 🔜 |
| 📦 Batch operations (move/copy/compress) | 🔜 |

---

## 🚀 Quick Start

```bash
# Build from source
cd tools-cli/src/fex
go build -o fex ./cmd/fex/
./fex

# Or just use the launcher
tools-cli/bin/fex

# Install to PATH
cp fex ~/.local/bin/
```

### Usage

```bash
fex                    # Browse current directory
fex /some/path         # Browse specific directory
fex .go                # Browse with extension filter
fex --tree             # Tree mode (folder explorer)
fex --search           # Search file contents (ripgrep)
fex --search "query"   # Search with query
fex --bookmarks        # Browse bookmarks
fex --help             # Full help
```

### Key Bindings (inside fzf)

| Key | Action |
|-----|--------|
| `Enter` | Open file in micro |
| `Ctrl-d` | Delete file (with confirm) |
| `Ctrl-r` | Rename file |
| `Ctrl-n` | New file (tree mode) |
| `Ctrl-k` | New folder (tree mode) |
| `Ctrl-g` | Git status / log |
| `Ctrl-y` | Copy file path |
| `Ctrl-b` | Add bookmark |
| `Ctrl-x` | Remove bookmark |
| `Ctrl-f` | Search (rg) within results |
| `Ctrl-o` | Open directory in tmux pane |
| `Ctrl-s` | Toggle fullscreen preview |
| `Tab` | Multi-select |

---

## 🏗️ Architecture

```
bin/fex               → Shell launcher (detek PATH → exec / build from source)
src/fex/
├── cmd/fex/main.go    → Entry point
├── cmd/root.go       → Cobra CLI + 4 mode dispatcher
├── internal/
│   ├── config/       → Viper YAML config loader
│   ├── fzf/          → Generic fzf wrapper (RunFzf[T])
│   ├── session/      → Session state + bookmarks (thread-safe)
│   ├── tmux/         → Tmux split (Go → bash helpers bridge)
│   ├── tree/         → Tree navigation + file listing
│   └── ui/           → ANSI styling, icons, tool detection
├── helpers/          → Bash scripts (tmux split/new-window)
└── go.mod
```

**Core philosophy:** 
- Go handles state, logic, CLI, fzf dispatch — **the brain**
- Bash helpers handle only tmux operations — **the muscle**
- No npm, no pip, no cargo — **zero runtime deps besides Go stdlib + fzf + fd/rg**

---

## ⚙️ Config

`~/.config/fe/config.yaml` — auto-generated on first run:

```yaml
editor: micro
preview: true
preview_size: 15
show_hidden: false
max_depth: 8
fd_binary: fd
rg_binary: rg
```

Override via env vars: `FE_EDITOR=nano fex`

---

## 🧩 Dependencies

| Tool | Required | Notes |
|------|----------|-------|
| fzf | ✅ Yes | Interactive selection + preview |
| micro | ❌ No | Preferred editor (fallback: nano > vim > vi) |
| fd | ❌ No | Fast file search (fallback: Go WalkFiles) |
| rg | ❌ No | Text search (fallback: grep) |
| bat | ❌ No | Syntax-highlighted preview (fallback: cat -n) |
| tmux | ❌ No | Split-pane open (fallback: open inline) |

---

## 🦫 Goblin Engineering Notes

- **Workflow > hype.** System > tools. Provider bisa diganti.
- **Bash untuk glue, Go untuk logic.** Jangan maksa salah satu ngelakuin sesuatu bukan takdirnya.
- **No corporate BS.** Ini tool buat goblin, bukan buat enterprise dashboard.
- **fex > fe.** Udah waktunya move on. Go lebih cepet, lebih aman, lebih maintainable.

---

## 📜 License

MIT — because even goblins believe in open source.

---

*Dibuat dengan ☕, 🦫, dan rasa frustrasi terhadap bash scripting.*
