<p align="center">
  <br/>
  <pre align="center">
  ██████╗ ██╗  ██╗    ██████╗ ██╗     ██╗███╗   ██╗
 ██╔════╝ ██║  ██║    ██╔══██╗██║     ██║████╗  ██║
 ██║  ███╗███████║    ██████╔╝██║     ██║██╔██╗ ██║
 ██║   ██║██╔══██║    ██╔══██╗██║     ██║██║╚██╗██║
 ╚██████╔╝██║  ██║    ██████╔╝███████╗██║██║ ╚████║
  ╚═════╝ ╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚═╝╚═╝  ╚═══╝
  </pre>
  <br/><br/>
  <strong>GitHub Assistant TUI v1.0.0</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Version-1.0.0-A855F7?style=for-the-badge&labelColor=1F2937" alt="Version" />
  <img src="https://img.shields.io/badge/Runtime-Node.js%20%E2%89%A5%2020-22C55E?style=for-the-badge&logo=nodedotjs&logoColor=white&labelColor=1F2937" alt="Node" />
  <img src="https://img.shields.io/badge/TUI-Clack-FF5722?style=for-the-badge&labelColor=1F2937" alt="Clack TUI" />
  <img src="https://img.shields.io/badge/CLI-GitHub%20CLI-00E5FF?style=for-the-badge&logo=github&logoColor=black&labelColor=1F2937" alt="GitHub CLI" />
  <br/><br/>
  <img src="../../../docs/assets/screenshoot/fex-help.png" alt="gb demo" width="800" />
  <br/>
</p>

# gb — GitHub Assistant TUI `v1.0.0`

> **TUI GitHub Client** — Pengelola interaktif berbasis terminal untuk Pull Request, Issues, Releases, dan autentikasi GitHub.

---

## 🧠 Deskripsi Singkat

**gb** adalah antarmuka terminal interaktif (TUI) berbasis Node.js yang membungkus command-line interface GitHub resmi (`gh`). Menggunakan Clack TUI, `gb` mengotomatiskan pengelolaan alur kerja harian (issues, pull requests, release tagging, auth status) tanpa perlu mengetik parameter CLI yang panjang atau membuka web browser.

---

## 🚀 Fitur Utama & Menu Navigasi

- 🔀 **Pull Requests Manager (`pr`)**: Melihat daftar PR aktif, membuat PR baru, memeriksa status CI checks, serta melakukan merge PR langsung dari terminal.
- 🐛 **Issues Manager (`issues`)**: Menjelajah daftar issue terbuka/tertutup, membuat issue baru, serta menambahkan komentar/status pada issue terpilih.
- 📦 **Releases Manager (`releases`)**: Membuat release tag baru, melampirkan release notes, dan mempublikasikan release draft ke GitHub.
- 📂 **Repo Explorer (`repos`)**: Navigasi daftar repositori lokal/remote, menampilkan detail informasi repo (`repoInfo`), serta pintasan cepat untuk membuka repository di browser (`openRepo`).
- 🔐 **Auth Assistant (`auth`)**: Mengelola status autentikasi token GitHub CLI (`gh auth status` dan `gh auth login`).

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`gb --help` atau `gb -h`)
Menampilkan ringkasan fungsi utama serta dependency yang diperlukan di sistem.

---

## 📋 Penggunaan & Contoh Perintah

### Menjalankan TUI Utama
```bash
gb
```

### Navigasi Menu
Gunakan tombol **Panah Atas / Bawah** untuk navigasi opsi menu utama, **Space/Enter** untuk memilih sub-menu, dan **Ctrl+C** untuk membatalkan program kapan saja dengan aman.

---

## 📂 Struktur File & Arsitektur

```
src/gb/
├── index.js            # Entry-point utama & Main Loop TUI
├── commands/           # Modul sub-menu command handlers
│   ├── auth.js         # Wrapper setup login/logout GitHub CLI
│   ├── issue.js        # Operasi create/list/close issues
│   ├── pr.js           # Operasi list/create/merge Pull Requests
│   ├── release.js      # Operasi tagging & release management
│   └── repo.js         # Operasi get info/open browser/switch repo
├── utils/              # Helper utilities
│   ├── display.js      # Manipulasi render line terminal
│   └── gh.js           # Wrapper exec API command gh CLI
├── package.json
└── package-lock.json
```

---

## 🧩 Dependencies & Prasyarat

- **Runtime**: Node.js (`v18+` direkomendasikan) atau Bun
- **Required System CLI**: [GitHub CLI (`gh`)](https://cli.github.com) harus sudah terinstall di sistem.
- **TUI Libraries**: `@clack/prompts`, `picocolors`.
