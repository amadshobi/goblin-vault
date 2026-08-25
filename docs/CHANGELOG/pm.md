# CHANGELOG: `pm` (Universal Package & Registry Manager)

Dokumentasi riwayat pembaruan, arsitektur, dan evolusi tool `pm` di dalam repositori **Goblin Vault**.

---

## [v0.1.0] — 2026-08-18

### 🚀 Initial Rust + Ratatui Major Release (Evolution of `sup` + `ins.sh`)

- **Full Rust & Ratatui Architecture**:
  - Menggantikan TypeScript / Bun (`sup`) dan Bash glue (`scripts/shell/ins.sh`) menjadi binary Rust native berkemampuan tinggi (`pm`).
  - Arsitektur berbasis async **Tokio**, UI **Ratatui + Crossterm**, HTTP Client **Reqwest**, dan CLI parser **Clap Derive**.
- **Unified 3-Tab Split-Pane TUI**:
  - **Tab 1: 🔄 Updates (Outdated Packages)**: Parallel multi-PM scanner, granular package picker, batch sequential updater dengan real-time log streaming.
  - **Tab 2: 🔍 Live Registry Search & Install**: Live multi-registry query ke Crates.io, NPM, PyPI, APT, dan Homebrew dengan preview pane metadata lengkap.
  - **Tab 3: 📦 Installed Packages Browser**: Inspeksi daftar paket terpasang lintas 10 ekosistem.
- **10 Ekosistem Package Manager & Toolchain Didukung**:
  - 📦 **System**: `apt` (Debian/Ubuntu), `snap` (Canonical), `flatpak` (Flathub).
  - 🍞 **Toolchains**: `bun` (Bun runtime), `omp` (Oh My Pi), `rustup` (Rust toolchain), `brew` (Homebrew).
  - 🛠️ **Dev Runtimes**: `pip` (Python PyPI), `npm` (Node.js NPM global), `cargo` (Rust Crates).
- **Safe In-Memory Zeroize Sudo Handling**:
  - Password sudo disimpan dalam memori terlindungi `Zeroizing<String>` dan diinjeksi via stdin (`sudo -S -p ""`) tanpa bentrok TTY/Crossterm.
  - Sudo password otomatis dibersihkan saat sesi ditutup (`app.sudo.clear()`).
- **Backward Compatibility Guarantees**:
  - `tools-cli/bin/sup` dijadikan thin compatibility launcher yang memetakan argumen ke `pm update`.
  - `scripts/shell/ins.sh` otomatis mendelegasikan perintah instalasi & pencarian ke `pm`.
