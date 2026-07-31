# Changelog — `ocm`

> Riwayat lengkap perubahan untuk tool **`ocm`** (OpenCode Configurator TUI).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [v0.3.15] - 2026-07-28

### Added
- **Global Ultra-Clean ASCII Art Banners (bagian dari suite CLI GN, ZF, FEX, OCM)**:
  - Penyesuaian banner visual seragam dengan font ASCII Art tebal presisi tinggi.
  - Penempatan nama tool dan versi persis di bawah banner dengan skema warna pure white & margin atas yang lega agar tidak menempel di prompt terminal (`shobixlinuxdev>`).

## [v0.3.14] - 2026-07-28

### Refactored
- **`ocm` Full TypeScript Migration & Environment Auto-Discovery Engine**:
  - Konversi 100% modul `ocm` dari JavaScript CJS (`.js`) menjadi ESM TypeScript terstruktur (`.ts`) di bawah `tools-cli/src/ocm/src/`.
  - Penambahan `tsconfig.json` & definisi tipe data (`config.ts`, `models.ts`) untuk type safety penuh.
  - Fitur **Workspace Auto-Discovery**: Scanner dinamis mendukung variabel lingkungan `OPENCODE_CONFIG_DIR`, auto-detect `~/.config/opencode`, `~/.opencode`, CWD, dan sub-proyek.
  - **MCP Protocol Sync**: Mengubah toggle MCP server agar membaca & menulis field standar `enabled: true/false`.
  - **Compaction Keep Fix**: Penyelarasan `compaction.keep` menjadi nilai desimal fraksi (`0.0` - `1.0`).
  - Centralized Agent Management via `~/.opencode/opencode.jsonc`.

### Added
- **Dashboard Integrator on `ocm` TUI (`menu.js`)**:
  - Menampilkan ringkasan status aktif sebelum prompt aksi utama (`Active Workspace`, `Config File`, `Default Agent`, `Active Model`, `Last Session`, dan status validasi `API Keys`).
  - Membantu developer melihat state sistem OpenCode secara sekilas tanpa harus masuk ke sub-menu.

### Fixed
- **CLI Subcommand `ocm manage` Registry & Help**:
  - Mendaftarkan subcommand `manage` ke `validSubcommands` di `index.js`.
  - Melengkapi Level 3 Help untuk `ocm manage add --help`, `ocm manage edit --help`, dan `ocm manage delete --help`.

## [0.0.1] - 2026-07-06

### Added
- `ocm` — OpenCode Model manager wrapper.
