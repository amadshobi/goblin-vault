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
  <strong>Goblin Nexus CLI v2.1.0 (Control Center Core)</strong>
  <br/><br/>
  <img src="https://img.shields.io/badge/Role-Control%20Plane-FF007F?style=for-the-badge&labelColor=1F2937" alt="Control Plane" />
  <img src="https://img.shields.io/badge/Version-v2.1.0-blue.svg?style=for-the-badge&labelColor=1F2937" alt="Version" />
  <img src="https://img.shields.io/badge/Stack-TypeScript%20%7C%20Bun-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=1F2937" alt="Stack" />
  <img src="https://img.shields.io/badge/Runtime-Bun-FFFDF5?style=for-the-badge&logo=bun&logoColor=black&labelColor=1F2937" alt="Bun" />
  <img src="https://img.shields.io/badge/Telemetry-OMP%20%26%20OpenCode-A855F7?style=for-the-badge&labelColor=1F2937" alt="Telemetry" />
  <br/><br/>
  <img src="../../../docs/assets/gif/gn-demo.gif" alt="gn demo" width="800" />
  <br/>
</p>

# gn — Goblin Nexus CLI `v2.1.0`

> **Control Center Core & Telemetry Plane** — Pusat komando terintegrasi untuk kuota token, diagnostik kesehatan sistem, speed benchmark leaderboard, konektivitas model AI, smart gateway proxy interceptor, dan manajemen konfigurasi OpenCode.

---

## 🧠 Deskripsi Singkat

**gn** (Goblin Nexus) berfungsi sebagai Control-Plane CLI di bawah arsitektur Goblin Vault. Dibangun 100% menggunakan TypeScript murni berbasis Bun runtime yang super cepat, `gn` mempermudah developer memantau performa model AI (latensi, throughput token/s, sisa kuota multi-akun), melakukan benchmark kecepatan, mencari histori sesi, dan memvalidasi kesehatan seluruh stack pengembangan lokal.

---

## 🚀 Fitur Utama & Subsystems

### 1. 󰓅 Telemetry & Quota Engine (`usage`, `u`)

<p align="center">
  <img src="../../../docs/assets/gif/gn-usage.gif" alt="gn usage demo" width="800" />
</p>

- **Native `omp usage` Forwarding**: Menampilkan visual progress bar block (`████░░░░`), rincian akun multi-email, kalkulasi kapasitas total (`1.45x quota left`), dan filter provider instan.
- **Daily Tokens & Subagent Tree (`-t`)**: Breakdown token harian per-sesi lengkap dengan subagent hirarki (`Root -> Subagent`), reasoning tokens, cache tokens, dan cost USD.
- **Multi-Day Window & All-Time Filter**: Dukungan `--day <N>`, `-d <N>`, dan `--all` untuk menarik histori token OpenCode DB dari rentang waktu kustom.
- **File Modification Audit (`-f`)**: Riwayat audit file yang di-edit/ditulis dengan git diff metrics (`+lines -lines`).
- **Compact Minimal Table (`-m`)**: Tampilan tabel ringkas 1-baris per session.

---

### 2. 󱎫 Speed Benchmark & Connectivity Probe (`bench`, `ping`)

<p align="center">
  <img src="../../../docs/assets/gif/gn-bench.gif" alt="gn bench demo" width="800" />
</p>

- **Speed Leaderboard Ranking**: Model otomatis diurutkan dari throughput (`tok/s`) tertinggi (`#1`, `#2`, dst).
- **Visual Throughput Gauge Bar**: Meteran visual kecepatan (`████████░░░░`) dengan color-coding adaptif.
- **Smart Ping Cache Synergy**: Otomatis memanfaatkan cache `gn ping` dan hanya menguji model `200 OK` agar hemat waktu & token (gunakan `-a` / `--all` untuk paksa uji semua model gateway).
- **Champion Summary Card**: Menampilkan model jawara tercepat beserta latensi dan throughputnya.
- **Filter Top Models (`--top <N>`)**: Membatasi tampilan N model teratas.
- **Connectivity Probe (`ping`, `p`)**: Uji latensi respon ke OMP Gateway (`http://127.0.0.1:4000`) dengan snapshot cache instan (~5ms) atau live probe (`-f`).

---

### 3. 󰋼 Health Diagnostic Tree & Config Manager (`doctor`, `config`)

<p align="center">
  <img src="../../../docs/assets/gif/gn-doctor.gif" alt="gn doctor demo" width="800" />
</p>

- **Clean Tree Structure (`├──`, `└──`)**: Layout berjenjang yang rapi dan bebas dari masalah line-wrap terminal.
- **4 Kategori Pemeriksaan**: `󰘚 DAEMONS & RUNTIMES`, `󰆼 DATABASES & TELEMETRY`, `󰌆 AUTH & PROVIDER MATRIX`, dan `󰉋 STORAGE & CONFIGURATION`.
- **Zero-Secret Auth Matrix**: Audit akun aktif dari SQLite `agent.db` tanpa mengekspos API key atau secret token.
- **Configuration Manager (`config`, `c`)**: Pembacaan dan modifikasi cepat konfigurasi OpenCode (`opencode.jsonc`) dan alias provider.

---

### 4. 󰒓 Smart Gateway Interceptor (`gateway`, `gw`)

- **Takeover Transparent Port 4000**: Meneruskan request OpenCode/client ke Upstream Native OMP Gateway (Port 4002) tanpa mengubah konfigurasi client.
- **SSE Zero-Copy Pass-Through**: Menyalurkan event-stream tanpa de-framing dengan latensi sangat rendah (<2ms).
- **Deterministic SHA-256 Prompt Caching**: Menghitung hash payload prompt & stream response secara deterministik ke disk (`0600`) dengan regenerasi ID token unik dan TTL auto-pruning.
- **Cascading Fallback & Circuit Breaker**: Intersepsi otomatis 429 rate limit & 5xx server error sebelum headers terkirim, beralih ke model alternatif cadangan dengan jeda cooldown 60s setelah 3 kegagalan beruntun.
- **Fixture Record & Mock Replay Engine**: Perekaman sesi chat ke format JSONL (`gn gw record <name>`) dan replay streaming offline tanpa internet/upstream (`gn gw mock <name>`).
- **Privacy Shield Header Sanitize**: Redaksi token/rahasia internal dan pembersihan header `X-GN-*` sebelum request diteruskan ke upstream.

---

## 🛠️ Dual-Level Help System Standard

- **Level 1 Help (`gn --help` atau `gn -h`)**:
  Menyajikan gambaran makro daftar seluruh command, meta info, dan quick hint.
- **Level 2 Help (`gn <command> --help` atau `gn <command> -h`)**:
  Menyajikan manual teknis mendalam per-subcommand (contoh: `gn u -h`, `gn b -h`, `gn p -h`).

---

## 📋 Contoh Penggunaan Praktis

```bash
# 1. Cek kuota live OMP multi-account
gn u

# 2. Audit aktivitas token sesi 7 hari terakhir dalam bentuk pohon hirarki
gn u -t 7

# 3. Audit file yang dimodifikasi oleh agent (all-time)
gn u -f --all

# 4. Cek status koneksi model (instant cache)
gn p agy

# 5. Live probe model provider ke gateway
gn p agy -f

# 6. Jalankan speed benchmark model sehat (200 OK only)
gn b agy -f

# 7. Tampilkan top 5 model tercepat
gn b agy --top 5

# 8. Full system health diagnostic & auth matrix
gn doctor

# 9. Jalankan Gateway Interceptor (Port 4000 -> 4002)
gn gw start

# 10. Periksa status & metrik performa gateway aktif
gn gw status
gn gw stats --json
```

---

## 📂 Struktur File & Arsitektur

```
tools-cli/src/gn/
├── src/
│   ├── index.ts            # CLI Master Router & Level-1 Help
│   ├── commands/           # Modul Subcommand Handlers
│   │   ├── usage.ts        # Quota, token tree, file diff audit
│   │   ├── ping.ts         # Gateway & model probe engine
│   │   ├── bench.ts        # Speed leaderboard & benchmark engine
│   │   ├── doctor.ts       # Tree-layout health diagnostic & auth matrix
│   │   ├── gateway.ts      # Smart Gateway Interceptor CLI
│   │   ├── sessions.ts     # OpenCode session search & explorer
│   │   └── config.ts       # OpenCode config manager
│   ├── gateway/            # Smart Gateway Interceptor Core Engine
│   │   ├── server.ts       # Bun HTTP/SSE proxy server & upstream forwarder
│   │   ├── cache.ts        # SHA-256 prompt cache manager & replay
│   │   ├── circuit-breaker.ts # Cascading fallback & circuit breaker
│   │   ├── sanitizer.ts    # Privacy shield sanitization
│   │   ├── rules.ts        # Rules & fallback config loader (configs/gn/)
│   │   ├── replay.ts       # Fixture recording & mock replay
│   │   └── types.ts        # TypeScript interfaces & types
│   ├── adapters/           # Data & Provider Adapters
│   │   ├── omp-native.ts   # Forwarder resmi omp usage binary
│   │   ├── omp-quota.ts    # SQLite quota adapter fallback
│   │   ├── opencode.ts     # OpenCode session & telemetry adapter
│   │   └── base.ts         # Base adapter interface
│   └── utils/              # Pure Utilities & Helpers
│       ├── formatter.ts    # ANSI colors, Box table, Progress bars
│       ├── paths.ts        # Path resolver (~/.config/gn/cache/)
│       ├── ping-config.ts  # Provider alias & models.yml parser
│       ├── db.ts           # SQLite database connection helper
│       ├── opencode-cli.ts # OpenCode session history reader
│       └── error.ts        # Fuzzy command matcher & roast error
├── gn-gateway.service      # Systemd user daemon unit
├── gn.sh                   # Shell launcher & fallback
├── package.json
└── tsconfig.json
```

---

## 🧩 Dependencies & Prasyarat

- **Runtime**: [Bun Runtime](https://bun.sh) (`>= 1.0`)
- **Database Driver**: `bun:sqlite` (native bawaan Bun)
- **UI & Prompt**: `@clack/prompts`
- **Optional Tools**: `omp` CLI, `systemctl` (user scope)
