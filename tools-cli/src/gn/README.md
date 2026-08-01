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
  <img src="https://img.shields.io/badge/Role-Control%20Plane-FF007F?style=for-the-badge&labelColor=0D1117" alt="Control Plane" />
  <img src="https://img.shields.io/badge/Stack-Shell%20%7C%20TypeScript-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0D1117" alt="Stack" />
  <img src="https://img.shields.io/badge/Runtime-Bun-FFFDF5?style=for-the-badge&logo=bun&logoColor=black&labelColor=0D1117" alt="Bun" />
  <img src="https://img.shields.io/badge/Feature-AI%20Adapter%20Broker-A855F7?style=for-the-badge&labelColor=0D1117" alt="AI Broker" />
  <img src="https://img.shields.io/badge/Security-Privacy%20Shield-10B981?style=for-the-badge&labelColor=0D1117" alt="Privacy Shield" />
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

1. **AI Adapter Broker & Benchmarking**:
   - `ping` — Uji kesehatan konektivitas endpoint API penyedia AI.
   - `bench` — Mengukur metrik performa: Time-To-First-Token (TTFT), token/detik, dan total latensi request.
2. **Quota & Telemetry Cost Tracking**:
   - `usage` — Dashboard real-time untuk penggunaan kuota, sisa balance, dan token burn rate.
   - `price` — Pricing engine dinamis untuk mengkalkulasi biaya per 1 juta token (input & output) per model secara granular.
3. **Security & Credential Management**:
   - `quarantine` — Sistem karantina otomatis untuk mengisolasi API key/credential yang terdeteksi exhausted atau zombie.
   - `export` — Sinkronisasi dan ekspor credential aktif dari database SQLite terenkripsi ke file JSON di storage vault lokal.
4. **Shield & Service Daemon Control**:
   - `restart`, `logs`, dan `doctor` untuk mengaudit seluruh tumpukan systemd services (`omp-broker`, `omp-gateway`).

---

## 🛠️ Level 1 & Level 2 Help System

### Level 1 Help (`gn --help` atau `gn -h`)
Menyajikan daftar menu utama beserta routing command yang didukung secara makro.

### Level 2 Help (`gn <command> --help` atau `gn help <command>`)
Mengaktifkan format bantuan mendalam (menggunakan layout parser `help-formatter.sh`) untuk setiap parameter opsional dan flag detail subcommand target.

---

## 📋 Penggunaan & Contoh Perintah

### Menguji Koneksi Model AI (Ping)
```bash
gn ping
# atau target spesifik
gn ping google-antigravity
```

### Melakukan Benchmark Output Token
```bash
gn bench --provider google-antigravity --tokens 200
```

### Dashboard Penggunaan Token & Sisa Kredit
```bash
gn usage
```

### Karantina Credential Zombie
```bash
# Lihat daftar credential yang dikarantina
gn q list

# Karantina API key Google
gn q add google-antigravity
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
├── agent.sh            # OMP Agent control plane wrapper
├── shield.sh           # Shield daemon monitor system
├── doctor.sh           # Script diagnostic system dependency & database
├── quarantine.sh       # Script management isolasi credential API
├── help-formatter.sh   # Bash helper untuk rendering Level 2 Help Manual
├── usage.ts            # Engine TypeScript untuk tracking cost & kuota
├── bench.ts            # Engine benchmark model (TTFT, tok/s)
├── price.ts            # Engine kalkulasi & setting model pricing
├── config.ts           # Loader konfigurasi global goblin nexus
├── pool-manager.ts     # Resource pool manager untuk backend routing
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
