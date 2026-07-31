# FEX Cobra ArbitraryArgs Fix dan Perbaikan Struktur Dokumentasi

> Implementasi Issue #N/A | 2026-07-26 | Execution: goblin-implementer, goblin-documenter

## Deskripsi

Dua implementasi dilakukan hari ini:

1. **Fix FEX Cobra ArbitraryArgs**: Menyelesaikan masalah di mana `fex` tidak menerima positional arguments (path, extension) pada root command karena Cobra v1.8.0 legacyArgs() menolak positional args pada command yang memiliki subcommand.

2. **Perbaikan Struktur Dokumentasi**: Update dokumentasi dan konfigurasi untuk menjaga konsistensi repository, termasuk perubahan pada `.gitignore`, `AGENTS.md`, `README.md`, `coding-style.md`, dan penghapusan skills yang tidak lagi diperlukan.

## Decision

### Implementasi 1: FEX Cobra ArbitraryArgs

**Keputusan**: Mengatur `Args: cobra.ArbitraryArgs` secara eksplisit pada root command di `root.go`.

**Alasan**: Cobra v1.8.0 memiliki behavior di mana `legacyArgs()` menolak positional arguments pada command yang memiliki subcommand (backup, restore). Dengan mengatur `cobra.ArbitraryArgs`, positional arguments (path, extension) diterima tanpa error 'unknown command'.

**Opsi yang ditolak**:
- Menghapus subcommand backup/restore — ditolak karena fitur ini masih diperlukan.
- Downgrade ke Cobra versi sebelumnya — ditolak karena ingin tetap menggunakan versi terbaru.

### Implementasi 2: Perbaikan Struktur Dokumentasi

**Keputusan**: 
- Update `.gitignore` untuk menambahkan exclusion yang lebih baik.
- Revisi `AGENTS.md` dan `README.md` untuk menjaga konsistensi informasi.
- Revisi `coding-style.md` untuk memperjelas aturan.
- Hapus skills yang tidak lagi diperlukan (`golang-pro`, `js-mastery`, `shell-scripting`) dari repository.

**Alasan**: Menjaga kebersihan repository dan memastikan dokumentasi mencerminkan kondisi aktual.

**Opsi yang ditolak**:
- Mempertahankan skills lama — ditolak karena skills sudah tidak relevan atau sudah terintegrasi di tempat lain.

## File yang Dibuat

- `history/2026-07-26_fex-cobra-fix-dan-struktur-dokumentasi.md` (file ini)

## File yang Dimodifikasi

- `tools-cli/src/fex/cmd/root.go` — Ditambahkan `Args: cobra.ArbitraryArgs` pada root command
- `.gitignore` — Ditambahkan exclusion untuk file-file yang tidak perlu di-commit
- `AGENTS.md` — Update struktur dan informasi
- `README.md` — Update struktur repository dan informasi
- `docs/rules/coding-style.md` — Revisi aturan coding untuk kejelasan
- `opencode.jsonc` — Update konfigurasi

## File yang Dihapus

- `docs/skills/golang-pro/SKILL.md`
- `docs/skills/golang-pro/SKILL.md.meta.md`
- `docs/skills/js-mastery/SKILL.md`
- `docs/skills/js-mastery/SKILL.md.meta.md`
- `docs/skills/shell-scripting/SKILL.md`
- `docs/skills/shell-scripting/SKILL.md.meta.md`

## Arsitektur

### FEX Root Command Structure

```
tools-cli/src/fex/cmd/root.go
├── rootCmd (cobra.Command)
│   ├── Use: "fex [path] [extension]"
│   ├── Args: cobra.ArbitraryArgs (FIX)
│   ├── RunE: func(cmd, args)
│   │   ├── config.Load()
│   │   ├── Parse positional args
│   │   ├── session.New()
│   │   └── Dispatcher (tree/bookmarks/search/find)
│   └── PersistentFlags (search, find, tree, bookmarks, dir, ext)
└── Execute()
```

### Repository Documentation Structure

```
goblin-vault/
├── .gitignore (updated)
├── AGENTS.md (updated)
├── README.md (updated)
├── docs/
│   ├── rules/
│   │   └── coding-style.md (updated)
│   └── skills/ (cleaned up)
└── opencode.jsonc (updated)
```

## API / Usage

### FEX Usage (setelah fix)

```bash
# Browse files from current directory
fex

# Browse files from specific path
fex /path/to/directory

# Filter by extension
fex .js

# Both path and extension
fex /path/to/directory .js

# With flags
fex --search "query"
fex --tree
fex --bookmarks
```

### Verifikasi

1. **FEX Fix Verification**:
   - Build fex: `cd tools-cli/src/fex && go build -o ~/.local/bin/fex .`
   - Test positional arguments: `fex .`, `fex /tmp`, `fex .go`
   - Test flags: `fex --search "test"`, `fex --tree`
   - Test subcommands: `fex backup`, `fex restore`

2. **Documentation Verification**:
   - Cek `.gitignore` berfungsi: file-file yang di-exclude tidak muncul di `git status`
   - Cek `README.md` dan `AGENTS.md` konsisten dengan struktur aktual
   - Cek `coding-style.md` tidak memiliki error syntax

### Constraints

- **Backward Compatibility**: FEX tetap backward compatible dengan usage sebelumnya
- **Cobra Version**: Menggunakan Cobra v1.8.0 dengan behavior baru
- **Dependencies**: Tidak ada dependency baru yang ditambahkan
- **Breaking Changes**: Tidak ada breaking changes untuk user

## Notes

1. **FEX ArbitraryArgs**: Fix ini penting karena tanpa `cobra.ArbitraryArgs`, command seperti `fex .` atau `fex .go` akan menghasilkan error 'unknown command' di Cobra v1.8.0.

2. **Skills Removal**: Skills yang dihapus (`golang-pro`, `js-mastery`, `shell-scripting`) sudah tidak diperlukan karena fungsinya sudah terintegrasi di tool lain atau sudah tidak relevan.

3. **Documentation Update**: Pastikan untuk selalu sync dokumentasi dengan kode aktual setiap ada perubahan.

4. **Testing**: Selalu jalankan `scripts/doctor.sh` dan `scripts/check_syntax.sh` setelah perubahan untuk memastikan tidak ada regresi.

5. **Future Considerations**: Pertimbangkan untuk menambahkan test otomatis untuk positional arguments FEX di masa depan.

---

## Implementasi 3: Migrasi Tools dari `~/.shell` ke `goblin-vault`

> Execution: goblin-implementer, goblin-cli | 2026-07-26

### Deskripsi

Migrasi seluruh tools CLI dari direktori `~/.shell/` (flat, tidak terstruktur) ke
dalam repositori `goblin-vault` agar terpusat, versioned, dan mudah di-maintain.
Tools yang dimigrasi: `gn` (Goblin Nexus CLI), `zf` (Zoxide & Tmux Navigation),
`shield` (Privacy Shield Interceptor), `ins` (Universal Package Installer),
dan `sup` (Parallel System Updater).

### Decision

**Keputusan**: Migrasi semua tools ke dalam struktur `goblin-vault` dengan pola:
- Source code → `tools-cli/src/{tool}/`
- Wrapper executable → `tools-cli/bin/{tool}`
- Shell scripts → `scripts/shell/`
- Credential & API keys → tetap di `~/.shell/secret/` (di-gitignore)

**Alasan**:
- `~/.shell/` adalah direktori flat tanpa version control — tidak bisa di-track perubahan.
- Migrasi ke repo memungkinkan code review, rollback, dan dokumentasi terstruktur.
- Credential dipisah karena sifatnya rahasia dan tidak boleh masuk Git.

**Opsi yang ditolak**:
- Symlink `~/.shell` ke repo — ditolak karena tidak menyelesaikan masalah versioning.
- Pindah semua file termasuk secret — ditolak karena melanggar security best practice.
- Buat monorepo terpisah — ditolak karena `goblin-vault` sudah menjadi control center.

### File yang Dibuat

| File | Deskripsi |
|------|-----------|
| `tools-cli/src/gn/gn.sh` | Entry point Goblin Nexus CLI (Bun/TS) |
| `tools-cli/src/gn/config.ts` | Konfigurasi model routing & API keys |
| `tools-cli/src/gn/bench.ts` | Benchmarking AI models |
| `tools-cli/src/gn/agent.sh` | Agent management utilities |
| `tools-cli/src/gn/picker.sh` | Interactive model picker (fzf) |
| `tools-cli/src/gn/shield.sh` | Privacy shield integration |
| `tools-cli/bin/gn` | Wrapper executable untuk `gn` |
| `tools-cli/src/zf/zf.sh` | Entry point Zoxide Navigation Engine |
| `tools-cli/src/zf/tmux.sh` | Tmux integration & auto-launcher |
| `tools-cli/src/zf/preview.sh` | File preview handler |
| `tools-cli/src/zf/zoxide_admin.sh` | Zoxide database administration |
| `tools-cli/bin/zf` | Wrapper executable untuk `zf` |
| `tools-cli/src/shield/shield-interceptor.ts` | Bun.serve privacy proxy interceptor |
| `tools-cli/src/shield/rules.json` | Regex rules untuk data filtering |
| `tools-cli/src/shield/privacy-headers.json` | Header filtering rules |
| `scripts/shell/ins.sh` | Universal Package Installer (multi-registry) |
| `scripts/shell/sup.sh` | Parallel System Updater (multi-select) |

### File yang Dimodifikasi

- `.gitignore` — Ditambahkan `*.pid` untuk mencegah commit PID files
- `README.md` — Update deskripsi tools (`gn`, `zf`, `ins`, `sup`) dan struktur
- `CHANGELOG.md` — Catatan migrasi tools

### File yang Dihapus

Tidak ada file dihapus dari repo (tools lama di `~/.shell/` tidak masuk repo).

### Arsitektur

```
goblin-vault/
├── tools-cli/
│   ├── bin/
│   │   ├── gn              # Wrapper → src/gn/gn.sh
│   │   ├── zf              # Wrapper → src/zf/zf.sh
│   │   ├── gh-blin         # (existing)
│   │   └── ocm             # (existing)
│   └── src/
│       ├── gn/             # Goblin Nexus CLI
│       │   ├── gn.sh       # Entry point (Bun runtime)
│       │   ├── config.ts   # Model routing config
│       │   ├── bench.ts    # Benchmarking engine
│       │   ├── agent.sh    # Agent management
│       │   ├── picker.sh   # fzf model picker
│       │   └── shield.sh   # Shield integration
│       ├── zf/             # Zoxide & Tmux Navigation
│       │   ├── zf.sh       # Entry point (source-able)
│       │   ├── tmux.sh     # Tmux split & session
│       │   ├── preview.sh  # File preview (bat/fzf)
│       │   └── zoxide_admin.sh  # DB admin
│       └── shield/         # Privacy Shield Interceptor
│           ├── shield-interceptor.ts  # Bun.serve proxy
│           ├── rules.json             # Filter rules
│           └── privacy-headers.json   # Header rules
├── scripts/shell/
│   ├── ins.sh              # Universal Package Installer
│   └── sup.sh              # Parallel System Updater
└── ~/.shell/secret/        # Credentials (Git-ignored)
    ├── GUIDE.md
    ├── google.env
    ├── moonshot/
    ├── ollama-cloud/
    └── ... (API keys per provider)
```

### API / Usage

#### `gn` — Goblin Nexus CLI

```bash
# Status akun & model
gn status

# Ping provider
gn ping

# Jalankan shield interceptor
gn shield

# Benchmark models
gn bench

# Interactive picker
gn picker
```

#### `zf` — Zoxide & Tmux Navigation

```bash
# Navigate to directory (zoxide + fzf)
zf

# Help
zf --help

# Auto-launch fex, lazygit, opencode dalam tmux split
zf <directory>
```

#### `ins` — Universal Package Installer

```bash
# Install package (auto-detect registry: apt, npm, pip, bun, etc.)
ins <package-name>

# Interactive search & install
ins
```

#### `sup` — Parallel System Updater

```bash
# Parallel update semua packages
sup

# Interactive multi-select
sup
```

### Keamanan

- **Credential location**: `~/.shell/secret/` — tidak di-commit ke Git
- **`.gitignore`**: `*.pid`, `.env`, `.env.*`, `secrets.json`, `credentials.json`
- **No secrets in code**: API keys di-reference via environment variables atau config files di luar repo
- **Shield interceptor**: Membersihkan data sensitif (API keys, PATs) sebelum request dikirim ke AI provider

### Verifikasi

1. **Syntax check**: `bash scripts/check_syntax.sh` — lulus tanpa error
2. **gn status**: Menampilkan status akun dan model yang tersedia
3. **gn ping**: Berhasil menghubungi provider
4. **gn shield**: Interceptor berjalan sebagai Bun.serve proxy
5. **zf --help**: Menampilkan help text dengan benar
6. **ins**: Script dapat dieksekusi tanpa error
7. **sup**: Script dapat dieksekusi tanpa error

### Constraints

- **Bun runtime**: `gn` dan `shield` membutuhkan Bun runtime (install via `curl -fsSL https://bun.sh/install | bash`)
- **fzf**: `zf` dan `ins` membutuhkan fzf untuk interactive picker
- **tmux**: `zf` membutuhkan tmux untuk split navigation
- **zoxide**: `zf` membutuhkan zoxide untuk smart directory jumping
- **Backward compatibility**: Wrapper `gn` dan `zf` di `tools-cli/bin/` backward compatible dengan PATH yang sudah di-setup

### Notes

1. **Secret management**: Credential tetap di `~/.shell/secret/` dan di-reference via environment. Jangan pernah commit secret ke repo.

2. **Wrapper pattern**: Setiap tool di `tools-cli/bin/` menggunakan pola wrapper yang sama: set `GOBLIN_VAULT_ROOT` lalu exec source script. Ini memungkinkan tool ditemukan dari mana saja selama `tools-cli/bin/` ada di `$PATH`.

3. **Shell vs TypeScript**: `gn` menggunakan Bun/TypeScript untuk logic kompleks (benchmarking, config), sementara `zf`, `ins`, `sup` murni shell script untuk performa dan portabilitas.

4. **Migration status**: File-file ini masih untracked (`git status ??`). Perlu di-commit setelah verifikasi lengkap.

5. **Future consideration**: Pertimbangkan untuk menambahkan auto-setup script yang menginstall dependencies (bun, fzf, tmux, zoxide) sekaligus.