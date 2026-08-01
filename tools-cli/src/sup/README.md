<p align="center">
  <br/>
  <pre align="center">
 ███████╗██╗   ██╗██████╗ 
 ██╔════╝██║   ██║██╔══██╗
 ███████╗██║   ██║██████╔╝
 ╚════██║██║   ██║██╔═══╝ 
 ███████║╚██████╔╝██║     
 ╚══════╝ ╚═════╝ ╚═╝     
  </pre>
  <br/><br/>
  <strong>Smart Universal Package Updater v1.1.0</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Version-1.1.0-A855F7?style=for-the-badge&labelColor=1F2937" alt="Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=1F2937" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Bun-FFFDF5?style=for-the-badge&logo=bun&logoColor=black&labelColor=1F2937" alt="Bun" />
  <img src="https://img.shields.io/badge/TUI-Clack-FF5722?style=for-the-badge&labelColor=1F2937" alt="Clack TUI" />
  <img src="https://img.shields.io/badge/Support-NPM%20%7C%20PIP3%20%7C%20Rust%20%7C%20Bun%20%7C%20System-00E5FF?style=for-the-badge&labelColor=1F2937&color=00E5FF" alt="Package Managers" />
  <br/><br/>
  <img src="../../../docs/assets/gif/sup-demo.gif" alt="sup demo" width="800" />
  <br/>
</p>

# sup — Smart Universal Package Updater `v1.1.0`

> Multi-PM (Package Manager) updater paralel yang cerdas dengan antarmuka terminal interaktif Clack TUI.

---

## 🧠 Deskripsi Singkat

**sup** adalah utilitas terminal modern yang menyatukan dan mempercepat proses update paket di berbagai Package Manager. Dengan mendeteksi status pembaruan secara otomatis, `sup` menyajikan daftar opsi interaktif yang ramah terminal, memungkinkan pembaruan satu per satu atau sekaligus secara paralel dengan handling input yang aman.

## 🚀 Fitur Utama

- ⚡ **Multi-PM Auto-Detection**: Mendukung APT, SNAP, Bun, Oh My Pi (`omp`), Rustup, Homebrew, PIP3, dan NPM global.
- 🎨 **Interactive Clack TUI**: Antarmuka interaktif yang indah dengan status picker granular (default semua tercentang / *all selected*).
- 🤫 **Sudo Prompt Handling Proaktif**: Menanyakan kata sandi sudo satu kali di awal sesi interaktif secara aman (terintegrasi dengan UI Clack) lalu menyalurkannya via `stdin` (`sudo -S`) agar tidak memblokir antarmuka.
- 📡 **Verbose Streaming Mode (`-v, --verbose`)**: Menampilkan log instalasi asli secara live-streaming dari package manager alih-alih menampilkan dynamic spinner statis.
- ⚙️ **Dual-Level Help System**: Panduan bantuan yang terbagi atas gambaran umum makro (Level 1) dan detail teknis per sub-command (Level 2).

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`sup --help` atau `sup -h`)
Menampilkan overview global target package manager, global flags, dan daftar sub-command yang didukung.

### Level 2 Help (`sup <target> --help` atau `sup help <target>`)
Menyediakan detail instruksi operasi internal, command CLI yang dijalankan di belakang layar, dan catatan khusus per-target (misalnya detail parameter pip `--break-system-packages`).

---

## 📋 Penggunaan & Contoh Perintah

### Mode Interaktif (Scan & Pick)
```bash
sup
```
*Akan melakukan scan outdated paket lalu memunculkan multi-select picker.*

### Update Semua Langsung (Non-interactive)
```bash
sup all
# atau
sup -y
```

### Update Target Spesifik
```bash
sup apt
sup npm
sup pip
```

### Opsi Verbose (Melihat Raw Output Instalasi)
```bash
sup brew -v
```

---

## 📂 Struktur File & Arsitektur

```
src/sup/
├── src/
│   ├── index.ts        # Entry point utama, parser argument CLI, dan dispatcher mode
│   ├── banner.ts       # Visual ASCII banner dan metadata versi
│   ├── help.ts         # Formatter Dual-Level Help System
│   ├── scanner.ts      # Logika scanning status outdated untuk tiap PM
│   ├── targets.ts      # Definisi schema, command eksekusi, dan rules per package manager
│   ├── runner.ts       # Execution runner untuk menjalankan target updates (paralel/sekuensial)
│   ├── exec.ts         # Wrapper child_process untuk live stream stdout/stderr
│   ├── sudo.ts         # Sudo credential cache, prompt, dan validation helper
│   ├── interactive.ts  # Handler visual interaktif (Clack multi-select, spinners)
│   └── auto.ts         # Handler mode otomatis non-interaktif (`sup all`)
├── package.json
└── tsconfig.json
```

---

## 🧩 Prasyarat & Dependencies

- **Runtime**: [Bun](https://bun.sh) (diperlukan untuk mengeksekusi TypeScript script langsung)
- **TUI & CLI Libs**: `@clack/prompts`, `picocolors`
- **System Tools (Opsional/Sesuai Penggunaan)**: `apt`, `snap`, `brew`, `pip3`, `npm`, `rustup`, `omp`.
