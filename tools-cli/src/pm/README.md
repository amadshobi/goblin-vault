# 🦀 `pm` — Universal Package & Registry Manager

Universal Package & Registry Manager berbasis **Rust + Ratatui + Tokio** di dalam Goblin Vault Command Center. Meleburkan kapabilitas scanner & updater dari `sup` dan interactive installer dari `ins.sh` ke dalam satu binary native berkemampuan tinggi.

---

## 🎯 Fitur Utama

- **3-Tab Split-Pane TUI (Ratatui)**:
  - **Tab 1: 🔄 Updates (Outdated Packages)** — Parallel scan, checkbox picker, batch execution, live execution log streamer.
  - **Tab 2: 🔍 Live Registry Search & Install** — Live multi-registry query ke Crates.io, NPM, PyPI, APT, dan Homebrew dengan preview pane metadata lengkap.
  - **Tab 3: 📦 Installed Packages Browser** — Inspeksi paket terpasang per ekosistem.
- **10 Ekosistem Terpadu**:
  - `apt`, `snap`, `flatpak`, `bun`, `omp`, `rustup`, `brew`, `pip`, `npm`, `cargo`.
- **Safe Sudo Engine**:
  - In-memory `Zeroizing<String>` buffer protection.
  - Injeksi aman stdin via `sudo -S -p ""` (anti bentrok TTY).
- **Headless & Scripting Mode**:
  - Mendukung `pm search <query>`, `pm install <pkg>`, `pm update [target]`, `pm list` langsung dari shell script tanpa spawn TUI.

---

## 🚀 Penggunaan CLI

```bash
# Buka Interactive TUI
pm
pm tui

# Cari paket di multi-registry
pm search react
pm search tokio --registry crates

# Install paket
pm install ripgrep --target apt
pm install typescript --target npm

# Update paket outdated
pm update
pm update --all
pm update apt
pm update npm

# List paket terinstall
pm list
pm list --target npm
```

---

## ⌨️ TUI Keybindings

| Key                   | Fungsi                                                    |
| --------------------- | --------------------------------------------------------- |
| `j` / `k` / `↑` / `↓` | Navigasi baris tabel & list                               |
| `1` / `2` / `3`       | Pindah Tab (Updates / Search / Installed)                 |
| `Tab` / `Shift-Tab`   | Pindah fokus Split-Pane (Sidebar ⇄ Table ⇄ Detail ⇄ Logs) |
| `Space`               | Toggle checklist paket yang ingin di-update               |
| `a`                   | Toggle Select All / Unselect All                          |
| `u` / `Enter`         | Eksekusi Update paket terpilih / Install paket            |
| `/`                   | Masuk ke mode Live Search                                 |
| `?`                   | Buka / tutup Help Modal                                   |
| `q` / `Esc`           | Keluar aplikasi secara aman                               |
