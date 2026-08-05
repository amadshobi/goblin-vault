<p align="center">
  <br/>
  <pre align="center">
  ██████╗ ███╗   ██╗
 ██╔════╝ ████╗  ██║
 ██║  ███╗██╔██╗ ██║
 ██║   ██║██║╚██╗██║
 ╚██████╔╝██║ ╚████║
  ╚═════╝ ╚═╝  ╚═══╝
  </pre>
  <br/><br/>
  <strong>Goblin Nexus CLI (Control Center Core)</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Role-Control%20Plane-FF007F?style=for-the-badge&labelColor=1F2937" alt="Control Plane" />
  <img src="https://img.shields.io/badge/Version-v1.0.0-blue.svg?style=for-the-badge&labelColor=1F2937" alt="Version" />
  <img src="https://img.shields.io/badge/Stack-Shell%20%7C%20TypeScript-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=1F2937" alt="Stack" />
  <img src="https://img.shields.io/badge/Runtime-Bun-FFFDF5?style=for-the-badge&logo=bun&logoColor=black&labelColor=1F2937" alt="Bun" />
  <img src="https://img.shields.io/badge/Feature-AI%20Adapter%20Broker-A855F7?style=for-the-badge&labelColor=1F2937" alt="AI Broker" />
  <img src="https://img.shields.io/badge/Security-Privacy%20Shield-10B981?style=for-the-badge&labelColor=1F2937" alt="Privacy Shield" />
  <br/><br/>
  <img src="../../../docs/assets/screenshoot/gn-help.png" alt="gn demo" width="800" />
  <br/>
</p>

# gn — Goblin Nexus CLI

> **Control Center Core & AI Adapter Broker CLI** — Command router pusat untuk diagnostik, benchmarking, manajemen credential, dan kontrol layanan OMP Engine.

---

## 🧠 Deskripsi Singkat

**gn** (Goblin Nexus) berfungsi sebagai Control-Plane CLI di bawah arsitektur Goblin Vault. Mengintegrasikan adapter broker AI, runtime benchmarks, sistem karantina credential, dan status live telemetry daemon, `gn` mempermudah developer memantau performa model AI (seperti latensi, throughput token, dan burn rate) secara dinamis.

---

## 🚀 Fitur Utama & Subsystems

1. **Quota & Telemetry Cost Tracking**:
   - `usage` — Dashboard real-time untuk penggunaan kuota, sisa balance, dan token burn rate.
   - `price` — Pricing engine dinamis untuk mengkalkulasi biaya per 1 juta token (input & output) per model secara granular.
2. **Shield & Service Daemon Control**:
   - `restart`, `logs`, dan `doctor` untuk mengaudit seluruh tumpukan systemd services (`omp-broker`, `omp-gateway`).

> **Catatan:** Subcommand `ping`, `bench`, `quarantine`, dan `export` telah **didepresiasi** dan hanya menampilkan warning saat dipanggil. Gunakan REST API OMP langsung (`/healthz`, `/v1/chat/completions`, `/v1/credential/:id/disable`, `/v1/snapshot`) atau CLI `omp`/`ocm` sebagai gantinya.

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`gn --help` atau `gn -h`)
Menyajikan daftar menu utama beserta routing command yang didukung secara makro.

### Level 2 Help (`gn <command> --help` atau `gn help <command>`)
Mengaktifkan format bantuan mendalam (menggunakan layout parser `help-formatter.sh`) untuk setiap parameter opsional dan flag detail subcommand target.

---

## 📋 Penggunaan & Contoh Perintah

### Dashboard Penggunaan Token & Sisa Kredit
```bash
gn usage
```

### Memeriksa Kesehatan Sistem (System Doctor Audit)
```bash
gn doctor
```

### Management Services Proxy
```bash
# Restart daemon broker
gn restart

# Tail log live gateway stream
gn logs
```

---

## 📂 Struktur File & Arsitektur

```
src/gn/
├── gn.sh               # Bash Router Command entry-point
├── shield.sh           # Shield daemon monitor system
├── doctor.sh           # Script diagnostic system dependency & database
├── help-formatter.sh   # Bash helper untuk rendering Level 2 Help Manual
├── usage.ts            # Engine TypeScript untuk tracking cost & kuota
├── price.ts            # Engine kalkulasi & setting model pricing
├── storage/            # Folder persisten history eksekusi dan database
└── prompts/            # Kumpulan instruksi template/dataset untuk AI benchmark
    ├── roles/          # Role definer (coder, bugfix, planning, dll)
    └── datasets/       # Sampel payload testing model
```

---

## 🧩 Dependencies & Prasyarat

- **Interpreter**: Bash (`set -euo pipefail` compliant) & [Bun Runtime](https://bun.sh)
- **Database**: SQLite3 (melalui driver `bun:sqlite` bawaan Bun)
- **System Utilities**: `systemctl` (systemd user scope), `journalctl`, `gum` (opsional untuk terminal dialog visual).
