# Changelog — fex

> Riwayat hidup `fe` → `fex`. Dari bash satu file, jadi Go hybrid. Perjalanan seorang goblin.

---

## v4.0 — Go Hybrid (Coming Soon 🚀)

**Codename:** `fex`

Migrasi total dari bash ke Go hybrid. Bukan cuma rename — ini reinkarnasi.

### What's new
- 🦫 **Go core** — Cobra CLI, Viper config, proper error handling, concurrent-safe session
- 🎯 **4 modes**: find, tree, search, bookmarks — unified under `fex [mode] [args]`
- ⚙️ **YAML config** — `~/.config/fe/config.yaml` + env override (`FE_` prefix)
- 🔧 **Tool auto-detect** — `bat > cat`, `micro > nano > vim`, `fd > WalkFiles`
- 🗑️ **Delete confirm** — fzf dialog, bukan `rm -i`
- ✏️ **Rename dialog** — interactive, bukan `read -p`
- 🆕 **New file / folder** from tree mode
- 📋 **Copy path** to clipboard
- 🔍 **Full-screen preview** toggle
- 🎨 **File type icons** — Nerd Font per extension
- 📄 **Generic fzf wrapper** — `RunFzf[T]` with type params

### Breaking changes
- Binary name: `fe` → `fex`
- Config: bash env vars → `~/.config/fe/config.yaml`
- Bash modules `src/fe/` → diarsipkan. Go source di `src/fex/`

### Migration path
```bash
# Old fe users: fex is backward compatible for CLI args
fex              # same as fe
fex /path        # same as fe /path
fex --search q   # same as fe --search q
```

---

## v3.0 — Modular (Bash)

**Codename:** `fe modular`

Bash script dipecah dari 1 file → 8 modul. Masih bash, tapi lebih terstruktur.

### What's new
- 📦 **Modular source** — `config.sh`, `tmux.sh`, `ui.sh`, `find.sh`, `tree.sh`, `search.sh`, `bookmarks.sh`, `popup_input.sh`
- 🌳 **Tree mode** — folder explorer dengan inline fzf
- 📑 **Bookmarks mode** — dedicated bookmark browser
- 🔎 **Search mode** — ripgrep integration
- 🖥️ **Popup input** — tmux display-popup / fzf / read fallback
- 📁 **New file / folder** di tree mode
- 🗑️ **Delete confirmation** via fzf
- ✏️ **Rename dialog** via popup
- 🎨 **Responsive preview** — ukuran preview menyesuaikan terminal
- ⌨️ **More keybindings** — Ctrl-s (fullscreen), Ctrl-y (copy), Ctrl-x (unbookmark)

### Files
```
bin/fe              → Entry point
src/fe/
├── config.sh       → Bootstrap, tool detection
├── tmux.sh         → Tmux split, open file
├── ui.sh           → FZF args builder, keybindings
├── find.sh         → Find mode
├── tree.sh         → Tree mode (139 lines of bind hell)
├── search.sh       → Search mode
├── bookmarks.sh    → Bookmark mode
└── popup_input.sh  → Reusable popup input
```

### Known issues (why v4 happened)
- 🔴 Rename flow fragile — temp file state corruption
- 🔴 Quotes safety — path with spaces = disaster
- 🔴 Tree mode 139 lines of inline `--bind` — nightmare to maintain
- 🔴 Error handling — `set -e` gambling
- 🟡 FZF args duplicated between `ui.sh` and inline in `tree.sh`

---

## v2.0 — +micro (Bash)

**Codename:** `fe + editor`

Masih bash satu file, tapi tambah micro sebagai editor default + tmux split.

### What's new
- 🖥️ **Tmux split** — auto split window, open file di right pane
- 📝 **Micro integration** — preferred editor (fallback nano/vim)
- 📑 **Bookmarks** — add via Ctrl-b, file-backed
- 🔑 **Git status** — Ctrl-g from fzf
- 🗑️ **Delete file** with `rm -i` prompt
- ✏️ **Rename file** with temp file hack
- 🔄 **Search refine** — Ctrl-f reload with rg

### Architecture
```bash
fe              # Single bash script (~198 lines)
```

### Still bash
- Satu file — `config.sh`, `tmux.sh`, etc belum lahir
- `rm -i` untuk delete — UX ambigu
- `read -p` untuk rename — keluar dari fzf paradigm
- Temp file `fe-rename-target` — rawan nyisa

---

## v1.0 — Explorer (Bash)

**Codename:** `fe original`

The beginning. File explorer pake fzf. Nothing else.

### What's new
- 📂 **Browse files** — `fe [path]` → fzf
- 🔍 **Filter by extension** — `fe .js`
- 🚀 **Open in editor** — hardcoded micro
- 📋 **Basic fzf** — preview, enter to open

### Architecture
```bash
fe              # Single bash script
```

### The OG
- No tmux split
- No bookmarks
- No tree mode
- No search mode
- No delete/rename
- No git
- Just `find | fzf | micro`
- **But it worked.** That's what mattered.

---

*Dulu `fe`, sekarang `fex`. Evolusi goblin.* 🦫
