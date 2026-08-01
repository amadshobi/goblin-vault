<p align="center">
  <br/>
  <pre align="center">
  ██████╗  ██████╗███╗   ███╗
 ██╔═══██╗██╔════╝████╗ ████║
 ██║   ██║██║     ██╔████╔██║
 ██║   ██║██║     ██║╚██╔╝██║
 ╚██████╔╝╚██████╗██║ ╚═╝ ██║
  ╚═════╝  ╚═════╝╚═╝     ╚═╝
  </pre>
  <br/><br/>
  <strong>OpenCode Configurator TUI v1.2.0</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Version-1.2.0-A855F7?style=for-the-badge&labelColor=1F2937" alt="Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=1F2937" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Bun-FFFDF5?style=for-the-badge&logo=bun&logoColor=black&labelColor=1F2937" alt="Bun" />
  <img src="https://img.shields.io/badge/TUI-Clack-FF5722?style=for-the-badge&labelColor=1F2937" alt="Clack TUI" />
  <img src="https://img.shields.io/badge/Scope-OpenCode%20Manager-00E5FF?style=for-the-badge&labelColor=1F2937" alt="OpenCode" />
  <br/><br/>
  <img src="../../../docs/assets/gif/ocm-demo.gif" alt="ocm demo" width="800" />
  <br/>
</p>

# ocm — OpenCode Configurator TUI `v1.2.0`

> **TUI Configuration Dashboard Manager** — Manajemen visual interaktif untuk setelan OpenCode, konfigurasi agent, server MCP, provider model AI, session, dan referensi.

---

## 🧠 Deskripsi Singkat

**ocm** adalah dashboard visual berbasis Clack TUI yang didesain khusus sebagai pusat konfigurasi OpenCode. Memanfaatkan runtime Bun dan modul TypeScript, `ocm` mempermudah developer menyetel file config JSON/JSONC, memanipulasi list server MCP, mengatur credentials API Key secara grafis, serta menavigasi riwayat session database OpenCode secara aman.

---

## 🚀 Fitur Utama & Menu Dashboard

- 🤖 **Agent Config**: Menyetel karakteristik agent, batasan iterasi (*max steps*), instructions template prompt, dan target models.
- 🔌 **MCP Servers Management**: Mengaktifkan, mematikan, atau mendaftarkan sub-process server Model Context Protocol (MCP) baru.
- 🔑 **Providers Credentials**: Kelola endpoint baseURL, token authentication, dan credentials global per-provider AI (seperti Google, OpenAI, Anthropic, Ollama, dll).
- 🧬 **Session Database Manager**: Melihat daftar session aktif, mengekspor event logs history ke format markdown, serta menghapus data session lama.
- 🩺 **Doctor System Configuration**: Diagnosa integritas file konfigurasi sistem secara otomatis dan lakukan perbaikan instan (*auto-fix*).
- 🎛️ **Settings Switcher**: Mengubah parameter global, status token compaction, serta mengubah direktori project workspace aktif.

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`ocm --help` atau `ocm -h`)
Menampilkan overview command dasar, argumen CLI yang didukung, serta global flags:

### Level 2 Help (`ocm <command> --help`)
Menampilkan petunjuk parameter dan opsi CLI spesifik per-subcommand (misalnya detil argumen `--fix` pada command `ocm doctor`).

---

## 📋 Penggunaan & Contoh Perintah

### Membuka Dashboard TUI Utama (Default)
```bash
ocm
```

### Membuka Sub-menu Interaktif Secara Langsung
```bash
ocm agent
ocm providers
ocm mcp
ocm session
```

### Menjalankan Diagnosa Mandiri (Doctor CLI)
```bash
# Diagnosa interaktif
ocm doctor

# Diagnosa + auto-fix non-interaktif
ocm doctor --fix
```

### Mengganti Workspace Target Project Aktif
```bash
ocm -p /home/user/project-lain
```

---

## 📂 Struktur File & Arsitektur

```
src/ocm/
├── src/
│   ├── index.ts        # CLI Entry-point & router argumen
│   ├── commands/       # Modul sub-menu command logical handlers
│   │   ├── agent.ts    # Configurator untuk parameter agent
│   │   ├── doctor.ts   # Diagnosa & recovery config files
│   │   ├── mcp.ts      # Setup plugin MCP servers
│   │   ├── models.ts   # View perbandingan schema model AI
│   │   ├── providers.ts# Editor API Keys & credentials
│   │   ├── reference.ts# Management file reference docs
│   │   ├── session.ts  # Database session manager
│   │   └── settings.ts # System toggle config (compaction, dll)
│   ├── ui/             # Modul render layout TUI Clack
│   │   ├── common.ts   # Element visual reusable & styling
│   │   ├── dashboard.ts# Layout utama main dashboard menu
│   │   └── menu.ts     # Loop handler navigasi state
│   ├── types/          # Definisi file interface TS & schema model
│   └── utils/          # File system & path helpers
├── package.json
└── tsconfig.json
```

---

## 🧩 Dependencies & Prasyarat

- **Runtime**: [Bun](https://bun.sh)
- **TUI Framework**: `@clack/prompts` & `picocolors`
- **Konfigurasi Target**: `opencode.json` / `opencode.jsonc` di environment project workspace.
