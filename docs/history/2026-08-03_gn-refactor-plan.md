# Rencana Eksekusi Refactoring: `tools-cli/src/gn/`
**Tanggal**: 2026-08-03
**Author**: Goblin Planner (dari audit @explore)
**Status**: PLAN — Belum dieksekusi
**Target Branch**: `dev` → PR ke `main`

---

## Laporan Evaluasi Arsitektur

### Kondisi Aktual

`gn` (Goblin Nexus) saat ini beroperasi sebagai **dual-layer system** yang berbahaya:

1. **Layer Sah** — Thin CLI wrapper yang mendelegasi ke OMP Gateway/Broker via REST API
2. **Layer Gelap** — File-file yang **membypass** OMP dengan mengakses SQLite internal OMP secara langsung, memanipulasi file system secrets, dan hardcode business logic yang seharusnya milik OMP

Layer gelap ini adalah sumber dari **MALFORMED FUNCTION ERROR**, **config corruption**, dan **credential state inconsistency** yang dilaporkan.

### Peta Risiko Keseluruhan

| Kategori | File | LoC | Risiko |
|---|---|---|---|
| 🔴 BOM WAKTU | `quarantine.sh` | 575 | SQLite DELETE bypass auth-broker |
| 🔴 BOM WAKTU | `export` (inline `gn.sh`) | ~48 | Credential leakage ke plaintext |
| 🔴 BOM WAKTU | `config.ts` | 305 | JSONC parser fragile → config corruption |
| 🟠 REDUNDAN | `bench.ts` | 487 | Duplikasi `GET /v1/models` + `POST /v1/chat/completions` |
| 🟠 REDUNDAN | `usage.ts` (partial) | ~500 | Direct query ke `stats.db`, `agent.db` |
| 🟠 REDUNDAN | `doctor.sh` (partial) | ~90 | Direct query ke `auth_credentials` |
| 🟠 REDUNDAN | `pool-manager.ts` | 385 | Duplikasi snapshot API |
| 🟠 REDUNDAN | `agent.sh` | 128 | Direct write ke `opencode.jsonc` |
| 🟠 REDUNDAN | `picker.sh` | 75 | Memanggil `config.ts` (bom waktu) |
| 🟢 LEGITIMATE | 8 file (lihat bawah) | ~1,727 | Aman, dipertahankan |

**Total LoC yang dihapus/direfaktor**: ±4.093 baris (~62% dari total codebase `gn/`)

---

## Analisis Dampak (Impact Analysis)

### ✅ Keuntungan

| Dimensi | Detail |
|---|---|
| **Security** | Credential material tidak pernah keluar dari OMP vault. `quarantine.sh` + `export` yang menulis plaintext JSON ke `~/.shell/secret/` → **dihapus total**. Zero risk credential leakage ke filesystem |
| **Stabilitas** | MALFORMED FUNCTION ERROR hilang: `config.ts` (regex JSONC parser fragile) → diganti dengan delegasi ke OMP provider catalog API |
| **Data Integrity** | Tidak ada lagi `DELETE FROM auth_credentials` yang bypass `AuthStorage.invalidateCredentialMatching()`. Auth-broker jadi **single source of truth** untuk lifecycle credential |
| **Maintenance** | −4.093 LoC custom adapter yang harus di-maintain saat OMP update schema. Zero custom SQL query ke internal DB OMP |
| **Performance** | `usage.ts` tidak lagi melakukan direct SQLite query paralel ke 3 DB berbeda (`stats.db`, `agent.db`, model_perf, client_usage). Semua via REST API yang sudah di-cache oleh broker |

### ⚠️ Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| **`gn bench` mati setelah `bench.ts` dihapus** | Medium | Phase 3: Buat `bench-lite.ts` sebagai thin wrapper `POST /v1/chat/completions` auth-gateway. `bench-roles.ts` + `bench-storage.ts` tetap dipertahankan karena tidak bergantung ke `bench.ts` secara langsung |
| **`gn quarantine` kehilangan fungsionalitas** | High | Phase 3: Buat `quarantine-v2.sh` yang memanggil `POST /v1/credential/:id/disable` + `POST /v1/credential/:id/block` endpoints. List credential via `GET /v1/snapshot` |
| **`gn export` dihapus — user mungkin bergantung** | Medium | Phase 1: Tambah deprecation notice di `gn.sh`. Phase 4: Dokumentasikan `GET /v1/snapshot` sebagai replacement |
| **`gn doctor` kehilangan credential check** | Low | Phase 3: Refactor `doctor.sh` — hapus direct SQL, ganti dengan `GET /healthz` + `GET /v1/usage` + `GET /v1/snapshot` |
| **`bench-roles.ts` + `bench-storage.ts` jadi orphan** | Low | Evaluasi: jika `bench-lite.ts` baru membutuhkan keduanya, pertahankan. Jika tidak, hapus di Phase 2 |
| **`usage.ts` partial refactor bisa break metrics** | Medium | Phase 3: Refactor bertahap — pertahankan UI layer, ganti data layer dari direct SQL ke `/v1/usage` + `/v1/usage/history` |

---

## Task Breakdown & WBS Eksekusi

**Complexity**: High
**Estimated Scope**: 4 phases, ~3-5 sesi kerja, ~8-14 sub-tasks

---

### Phase 1: Pembersihan Bom Waktu 🔴
**Goal**: Eliminasi semua kode yang bisa menyebabkan data corruption dan credential leakage. **Tidak ada feature replacement di phase ini** — hanya amputasi aman.

**Deadline mental**: Selesai sebelum phase lain dimulai. Phase ini blocking.

#### M1.1 — Hapus `quarantine.sh`
- **Task**: Delete file `tools-cli/src/gn/quarantine.sh` (575 baris)
- **Konteks**: File ini memanggil `DELETE FROM auth_credentials` secara langsung. Bypass total lifecycle management auth-broker. **Tidak ada yang perlu di-preserve dari file ini** — logika `quarantine list`, `add`, `restore` akan di-reimplementasi di Phase 3 via REST API.
- **Pre-condition**: Pastikan `gn quarantine` di `gn.sh` menampilkan "Command deprecated" notice (lihat M1.3)
- **Files affected**: `tools-cli/src/gn/quarantine.sh` → DELETE
- **Priority**: HIGH | **Complexity**: S

#### M1.2 — Hapus `config.ts`
- **Task**: Delete file `tools-cli/src/gn/config.ts` (305 baris)
- **Konteks**: JSONC parser manual dengan regex fragile → penyebab langsung MALFORMED FUNCTION ERROR. `agent.sh` dan `picker.sh` bergantung ke file ini. Keduanya juga akan dihapus (M2.x).
- **Pre-condition**: M2.3 dan M2.4 (hapus `agent.sh` + `picker.sh`) harus dikerjakan **bersamaan** atau terlebih dahulu
- **Files affected**: `tools-cli/src/gn/config.ts` → DELETE
- **Priority**: HIGH | **Complexity**: S

#### M1.3 — Pasang Deprecation Guard di `gn.sh` untuk command yang dihapus
- **Task**: Edit `tools-cli/src/gn/gn.sh` — ubah case dispatch untuk `quarantine|q`, `export|e`, dan nanti `agent`, `picker` agar menampilkan pesan deprecation yang jelas dengan instruksi transisi, bukannya error crash
- **Konteks**: Saat ini `gn quarantine` memanggil `bash "$GN_DIR/quarantine.sh"` dan `gn export` menjalankan inline bun script. Setelah Phase 1, kedua command ini harus memberikan user-friendly deprecation notice bukan silent failure.
- **Format pesan** (ikuti UX standard goblin vault):
  ```bash
  # Contoh untuk quarantine:
  quarantine|q)
      echo ""
      echo "⚠️  [gn quarantine] Command ini sedang dalam transisi ke OMP REST API."
      echo "    Akan tersedia kembali di versi berikutnya via: POST /v1/credential/:id/disable"
      echo "    Sementara gunakan: omp auth-broker credential list"
      echo ""
      ;;
  ```
- **Files affected**: `tools-cli/src/gn/gn.sh` (edit case dispatch)
- **Priority**: HIGH | **Complexity**: S

#### M1.4 — Hapus inline `export` block dari `gn.sh`
- **Task**: Edit `tools-cli/src/gn/gn.sh` — hapus baris 200-246 (inline `bun -e '...'` yang query `SELECT * FROM auth_credentials` dan parse `models.yml`)
- **Konteks**: Block ini menulis credential plaintext ke `~/.shell/secret/`. Ini adalah security hole langsung. Ganti dengan deprecation notice (sudah di-handle di M1.3 bersamaan)
- **Files affected**: `tools-cli/src/gn/gn.sh` (hapus baris 200-246, ganti dengan deprecation notice)
- **Priority**: HIGH | **Complexity**: S
- **Depends on**: M1.3

---

### Phase 2: Eliminasi Redundansi 🟠
**Goal**: Hapus semua file yang fiturnya sudah disediakan native oleh OMP. Tidak ada feature replacement — fiturnya sudah ada di OMP, user tinggal pakai.

#### M2.1 — Hapus `bench.ts`
- **Task**: Delete file `tools-cli/src/gn/bench.ts` (487 baris)
- **Konteks**: File ini memanggil `GET /v1/models` dan `POST /v1/chat/completions` secara manual dengan implementasi custom. Auth-gateway sudah provide endpoints ini. `bench-roles.ts` dan `bench-storage.ts` tidak import langsung dari `bench.ts` (verifikasi dari audit: `grep -n 'bench\.'` di keduanya → no output) — aman dihapus terpisah.
- **Pre-condition**: Phase 3 M3.1 (`bench-lite.ts`) harus **siap** sebelum `bench.ts` dihapus agar `gn bench` tidak mati
- **Files affected**: `tools-cli/src/gn/bench.ts` → DELETE
- **Priority**: MEDIUM | **Complexity**: S
- **Depends on**: M3.1 (harus ada replacement dulu)

#### M2.2 — Hapus `pool-manager.ts`
- **Task**: Delete file `tools-cli/src/gn/pool-manager.ts` (385 baris)
- **Konteks**: Auth-broker sudah expose semua credential via `GET /v1/snapshot`. Pool management adalah tugasnya auth-broker, bukan gn.
- **Pre-condition**: Verifikasi `gn.sh` tidak memanggil `pool-manager.ts` secara langsung (dari audit `gn-dependent-calls` → no output — confirmed aman)
- **Files affected**: `tools-cli/src/gn/pool-manager.ts` → DELETE
- **Priority**: MEDIUM | **Complexity**: S

#### M2.3 — Hapus `agent.sh`
- **Task**: Delete file `tools-cli/src/gn/agent.sh` (128 baris)
- **Konteks**: Membaca dan menulis `opencode.jsonc` secara langsung — sama berbahayanya dengan `config.ts`. Verifikasi: `gn.sh` tidak memanggilnya secara langsung (confirmed dari `gn-dependent-calls`).
- **Files affected**: `tools-cli/src/gn/agent.sh` → DELETE
- **Priority**: MEDIUM | **Complexity**: S

#### M2.4 — Hapus `picker.sh`
- **Task**: Delete file `tools-cli/src/gn/picker.sh` (75 baris)
- **Konteks**: Memanggil `config.ts` yang sudah dihapus di M1.2. Setelah M1.2 dieksekusi, `picker.sh` otomatis broken. Hapus bersama.
- **Files affected**: `tools-cli/src/gn/picker.sh` → DELETE
- **Priority**: MEDIUM | **Complexity**: S
- **Depends on**: M1.2

#### M2.5 — Refactor `doctor.sh`: Hapus Direct SQL Query
- **Task**: Edit `tools-cli/src/gn/doctor.sh` — hapus section yang query `auth_credentials` table langsung (baris 111-134). Ganti dengan call ke `GET /healthz` dan `GET /v1/usage` dari auth-broker
- **Konteks**: `doctor.sh` sebagian besar masih valid (check systemctl service, port check). Yang perlu dihapus hanya bagian direct SQL query ke SQLite. Sisanya dipertahankan.
- **Files affected**: `tools-cli/src/gn/doctor.sh` (edit — partial, bukan delete)
- **Implementation**: 
  ```bash
  # Ganti block SQL query dengan:
  local broker_url="http://127.0.0.1:${BROKER_PORT:-4001}"
  local snapshot=$(curl -sf "$broker_url/v1/snapshot" 2>/dev/null)
  if [[ -z "$snapshot" ]]; then
      _warn "Tidak dapat fetch credential snapshot dari broker"
  else
      local cred_count=$(echo "$snapshot" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('credentials', [])))" 2>/dev/null || echo "?")
      _ok "Credential aktif di broker: $cred_count"
  fi
  ```
- **Priority**: MEDIUM | **Complexity**: M

---

### Phase 3: Bridging REST API OMP — Build Replacements 🔨
**Goal**: Buat thin wrapper baru yang mendelegasi ke OMP REST API. Phase ini adalah "build before cut" untuk command yang perlu replacement.

#### M3.1 — Buat `bench-lite.ts` (replacement `bench.ts`)
- **Task**: Buat file baru `tools-cli/src/gn/bench-lite.ts`
- **Konteks**: Thin wrapper ke auth-gateway. Tidak ada custom implementation — hanya forward request ke `/v1/chat/completions` dan `/v1/models`, lalu format output untuk terminal. Gunakan `bench-roles.ts` dan `bench-storage.ts` yang sudah ada.
- **API Endpoints yang digunakan**:
  - `GET http://127.0.0.1:4000/v1/models` — list available models
  - `POST http://127.0.0.1:4000/v1/chat/completions` — run benchmark request
- **Spec**: 
  - Maksimal 150 baris (vs `bench.ts` yang 487 baris)
  - Pertahankan output format yang sama (TTFT, tok/s, latency) agar UX tidak berubah
  - Import dari `bench-roles.ts` dan `bench-storage.ts` untuk dataset
  - Error handling: jika gateway tidak aktif → tampilkan Goblin Roast Error dengan hint `gn restart`
- **Files affected**: `tools-cli/src/gn/bench-lite.ts` → CREATE NEW
- **Update**: `gn.sh` — ganti `bun "$GN_DIR/bench.ts"` → `bun "$GN_DIR/bench-lite.ts"`
- **Priority**: HIGH | **Complexity**: M
- **Depends on**: Tidak ada (bisa dikerjakan paralel dengan Phase 1 & 2)

#### M3.2 — Buat `quarantine-v2.sh` (replacement `quarantine.sh`)
- **Task**: Buat file baru `tools-cli/src/gn/quarantine-v2.sh`
- **Konteks**: Implementasi ulang fitur quarantine via REST API auth-broker. **Zero direct SQL**.
- **API Endpoints yang digunakan**:
  - `GET /v1/snapshot` — list semua credential (untuk `gn q list`)
  - `POST /v1/credential/:id/disable` — disable credential (untuk `gn q add`)
  - `POST /v1/credential/:id/block` — block credential (untuk `gn q add --block`)
  - `POST /v1/credential/:id/enable` — restore credential (untuk `gn q restore`)
- **Spec**:
  - Subcommand: `list`, `add <provider|id>`, `restore <id>`, `status`
  - Maksimal 200 baris (vs `quarantine.sh` yang 575 baris)
  - Pertahankan UX: gum spinner, status badge (✅ ⚠️ ❌), Goblin Roast Error pada failure
  - `set -euo pipefail` wajib
  - Fallback jika broker tidak aktif: tampilkan actionable error + hint `gn restart`
- **Files affected**: `tools-cli/src/gn/quarantine-v2.sh` → CREATE NEW
- **Update**: `gn.sh` — ganti `bash "$GN_DIR/quarantine.sh"` → `bash "$GN_DIR/quarantine-v2.sh"`, hapus deprecation notice yang dipasang di M1.3
- **Priority**: HIGH | **Complexity**: M

#### M3.3 — Refactor `usage.ts`: Hapus Direct DB Query
- **Task**: Edit `tools-cli/src/gn/usage.ts` — hapus/ganti 3 fungsi direct DB query:
  - `queryOmpStatsDb()` (baris 502-553) → ganti dengan `GET /v1/usage/history` dari broker
  - `queryModelPerf()` (baris 706-740) → ganti dengan data dari `GET /v1/usage` (field `model_performance`)
  - `queryClientUsage()` (baris 743-771) → ganti dengan data dari `GET /v1/usage` (field `client_usage`)
- **Konteks**: UI layer `usage.ts` (rendering, formatting, TUI display) **dipertahankan sepenuhnya**. Yang diganti hanya data layer — dari direct SQLite query ke REST API call. `fetchJson()` dan `resolveBroker()` sudah ada di `usage.ts` dan sudah benar — gunakan ulang.
- **Strategy**: 
  1. Tambah type definitions untuk response shape `/v1/usage` dan `/v1/usage/history`
  2. Ganti implementasi `queryOmpStatsDb()` dengan fungsi async yang call broker
  3. Ganti implementasi `queryModelPerf()` dan `queryClientUsage()` dengan extraksi dari usage response
  4. Update call sites (baris 829, dan section di bawahnya)
- **Files affected**: `tools-cli/src/gn/usage.ts` (edit — partial refactor, bukan delete)
- **Priority**: HIGH | **Complexity**: L (file 1141 baris, refactor bertahap)
- **Depends on**: Verifikasi response schema `/v1/usage` dan `/v1/usage/history` dari auth-broker docs/running instance

#### M3.4 — Update `help-formatter.sh`: Sinkronisasi Command List
- **Task**: Edit `tools-cli/src/gn/help-formatter.sh` — hapus entry help untuk command yang sudah dihapus: `quarantine` (sementara, sampai `quarantine-v2.sh` siap), `export`, `agent`, `picker`, `pool`
- **Konteks**: `help-formatter.sh` adalah legitimate file yang dipertahankan, tapi kontennya harus mencerminkan command list aktual pasca-refactor
- **Files affected**: `tools-cli/src/gn/help-formatter.sh` (edit)
- **Priority**: LOW | **Complexity**: S

#### M3.5 — Update `gn.sh` Main Dispatch Table
- **Task**: Edit `tools-cli/src/gn/gn.sh` — bersihkan semua sisa dispatch ke file yang sudah dihapus, update help text di baris 103-133 agar mencerminkan command list baru
- **Konteks**: Setelah semua phase eksekusi, `gn.sh` harus clean — tidak ada referensi ke `quarantine.sh`, `bench.ts`, `agent.sh`, `picker.sh`, `pool-manager.ts`, `config.ts`
- **Files affected**: `tools-cli/src/gn/gn.sh` (edit)
- **Priority**: MEDIUM | **Complexity**: S
- **Depends on**: Semua M3.x selesai

---

### Phase 4: Verification & Documentation ✅
**Goal**: Pastikan semua command `gn` berfungsi, tidak ada dead code tersisa, dokumentasi up-to-date.

#### M4.1 — Smoke Test Semua Command `gn`
- **Task**: Jalankan manual test untuk setiap command yang masih aktif pasca-refactor
- **Checklist**:
  - `gn ping` → via `bench-lite.ts` → response dari gateway ✅
  - `gn bench` → via `bench-lite.ts` → TTFT/tok/s output ✅
  - `gn usage` → via `usage.ts` (refactored) → dashboard kuota dari broker ✅
  - `gn usage burn` → cost tracker via broker API ✅
  - `gn doctor` → health check via `/healthz` + `/v1/usage` ✅
  - `gn quarantine list` → via `quarantine-v2.sh` → list credential dari snapshot ✅
  - `gn quarantine add` → disable via REST API ✅
  - `gn quarantine restore` → enable via REST API ✅
  - `gn price` → via `price.ts` (unchanged) ✅
  - `gn shield` → via `shield.sh` (unchanged) ✅
  - `gn export` → deprecation notice tampil, tidak crash ✅
  - `gn --help` → command list akurat, tidak ada dead command ✅
- **Priority**: HIGH | **Complexity**: S

#### M4.2 — Run `scripts/check_syntax.sh`
- **Task**: Jalankan `bash /home/shobixlinuxdev/civil/goblin-vault/scripts/check_syntax.sh` dan pastikan zero error
- **Konteks**: CI check wajib sebelum commit. Pre-push hook akan menjalankan ini secara otomatis.
- **Priority**: HIGH | **Complexity**: S

#### M4.3 — Update `docs/CHANGELOG/gn.md`
- **Task**: Tambah entry `[Unreleased]` di `docs/CHANGELOG/gn.md` dengan daftar perubahan:
  - **Removed**: `quarantine.sh`, `config.ts`, `bench.ts`, `pool-manager.ts`, `agent.sh`, `picker.sh`, inline `export` block
  - **Added**: `bench-lite.ts`, `quarantine-v2.sh`
  - **Refactored**: `usage.ts` (hapus direct DB query), `doctor.sh` (hapus SQL, ganti REST API)
  - **Security**: Credential tidak lagi di-export ke plaintext filesystem
- **Files affected**: `docs/CHANGELOG/gn.md`
- **Priority**: MEDIUM | **Complexity**: S

#### M4.4 — Update `tools-cli/src/gn/README.md`
- **Task**: Sync README dengan command list dan arsitektur baru
- **Files affected**: `tools-cli/src/gn/README.md`
- **Priority**: LOW | **Complexity**: S

---

## Dependency Graph Eksekusi

```
Phase 1 (BLOCKING — harus selesai dulu)
├── M1.3 Deprecation notices di gn.sh
├── M1.4 Hapus export inline (depends: M1.3)
├── M1.2 Hapus config.ts
└── M1.1 Hapus quarantine.sh

Phase 2 & Phase 3 (bisa paralel setelah Phase 1)
├── M3.1 bench-lite.ts (buat dulu)
│   └── M2.1 Hapus bench.ts (after M3.1 ready)
├── M3.2 quarantine-v2.sh (buat dulu)
│   └── [Update gn.sh dispatch ke quarantine-v2]
├── M2.2 Hapus pool-manager.ts (independent)
├── M2.3 Hapus agent.sh (independent)
├── M2.4 Hapus picker.sh (depends: M1.2)
├── M2.5 Refactor doctor.sh (independent)
└── M3.3 Refactor usage.ts (independent, tapi complex)

Phase 3 cleanup (setelah semua di atas selesai)
├── M3.4 Update help-formatter.sh
└── M3.5 Update gn.sh dispatch table

Phase 4 (setelah semua eksekusi)
├── M4.1 Smoke test
├── M4.2 check_syntax.sh
├── M4.3 Update CHANGELOG
└── M4.4 Update README
```

---

## File Final Yang Tersisa (Post-Refactor)

### Dipertahankan Utuh (Legitimate, Zero Changes)
- `price.ts` (291 baris)
- `telemetry/db.ts` (278 baris)
- `telemetry/pricing.ts` (221 baris)
- `ollama-me.ts` (217 baris)
- `shield.sh` (253 baris)
- `bench-roles.ts` (111 baris)
- `bench-storage.ts` (102 baris)
- `prompts/` (4 datasets + 4 roles, JSON/TXT)
- `storage/` (runtime artifacts)

### Dipertahankan dengan Perubahan (Refactored)
- `gn.sh` — dispatch table dibersihkan, export inline dihapus
- `usage.ts` — UI layer dipertahankan, data layer diganti ke REST API
- `doctor.sh` — direct SQL dihapus, ganti REST API call
- `help-formatter.sh` — command list disinkronisasi

### Dibuat Baru (REST API Thin Wrappers)
- `bench-lite.ts` (~150 baris, gantikan `bench.ts` 487 baris)
- `quarantine-v2.sh` (~200 baris, gantikan `quarantine.sh` 575 baris)

### Dihapus Total
- `quarantine.sh` (575 baris) 🗑️
- `config.ts` (305 baris) 🗑️
- `bench.ts` (487 baris) 🗑️
- `pool-manager.ts` (385 baris) 🗑️
- `agent.sh` (128 baris) 🗑️
- `picker.sh` (75 baris) 🗑️

**Total dihapus**: ~1.955 baris file dedicated
**Total dikurangi dari `gn.sh`**: ~48 baris (inline export block)
**Total dikurangi dari `usage.ts`**: ~270 baris (3 fungsi direct DB query)
**Total dikurangi dari `doctor.sh`**: ~24 baris (SQL credential check)
**Grand Total Reduction**: **~2.297 baris kode berbahaya dieliminasi**

> Note: Angka @explore menyebut ~4.000 baris karena menghitung `usage.ts` (1141 baris) secara keseluruhan.
> Actual reduction lebih presisi: 2.297 baris dihapus + 1.727 baris di-refactor = ~4.024 baris total terdampak.

---

## Catatan Implementer

1. **Jangan skip Phase 1** — hapus bom waktu dulu sebelum build replacement. Reverse order akan menyebabkan race condition di state
2. **Verifikasi auth-broker response schema** sebelum M3.3 (refactor `usage.ts`) — pastikan field `model_performance`, `client_usage`, `usage_history` ada di response `/v1/usage` broker versi saat ini
3. **`bench-lite.ts` dan `quarantine-v2.sh`** harus dibuat di Phase 3 sebelum menghapus file lamanya di Phase 2 — "build before cut"
4. **Semua perubahan di branch `dev`** — ikuti workflow repo: dev → PR → main → sync back
5. **Jangan commit langsung ke `main`** — violation AGENTS.md

---

> *Plan dibuat oleh Goblin Planner berdasarkan audit @explore. 👹🍻*
> *Eksekusi plan ini adalah tanggung jawab implementer — bukan Planner.*
