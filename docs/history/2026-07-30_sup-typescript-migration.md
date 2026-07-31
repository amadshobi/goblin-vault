# History: `sup` TypeScript Migration (2026-07-30)

## TL;DR
Migrasi total script updater `scripts/shell/sup.sh` (Bash v3) menjadi tool
TypeScript modern di `tools-cli/src/sup/` dengan UX via `@clack/prompts` + `picocolors`.

## Lokasi Akhir
- **Source TS**: `tools-cli/src/sup/src/{index,scanner,runner,auto,interactive,targets,exec,logger,banner,help}.ts`
- **Wrapper executable**: `tools-cli/bin/sup` (chmod +x; exec `bun run ./src/index.ts "$@"`).
- **Project files**: `tools-cli/src/sup/{package.json,tsconfig.json,bun.lock}`.
- **Arsip lawas**: `docs/history/sup-migration/sup.sh.v3-bash-legacy`.

## Mode yang Didukung

| Mode | Perintah | Catatan |
|------|----------|---------|
| Interaktif | `sup` (no args, TTY) | Banner → spinner scan paralel → `p.multiselect()` → eksekusi satu-satu dengan spinner → rangkuman. |
| Auto-all   | `sup all` | Scan paralel → eksekusi sequential (no UI). Cocok untuk cron / pipeline. |
| Sub-command direct | `sup <target>` | `apt` `snap` `bun` `omp` `rustup` `brew` `pip` `npm`. Skip UI, langsung scan+update. |
| Help L1 | `sup --help` / `sup -h` / `sup help` | Daftar sub-command + flags global. |
| Help L2 | `sup <target> --help` / `sup help <target>` | Detail perintah + catatan per-target. |
| Non-TTY fallback | `sup` (piped) | Otomatis route ke mode auto (auto-install semua outdated). |

## Safety Guard
- `process.stdout.isTTY` check → fallback ke text logger statis kalau false.
- `process.exitCode = 1` (bukan exit langsung) kalau ada target gagal di akhir batch.
- Pesan error pakai `🔥 [sup fatal]` + Goblin Roast Hint lewat `roastError()` di `logger.ts`.

## Build & Verifikasi

```bash
cd tools-cli/src/sup
bun install                  # install deps lokal (@clack/prompts, picocolors, bun-types)
bun run typecheck            # tsc --noEmit, harus exit 0
bun run build                # bundle ke dist/index.js (target=bun)
# langsung test:
../../bin/sup --help
../../bin/sup help apt
../../bin/sup bun            # sub-command langsung
```

## Keputusan Desain

1. **`moduleResolution: "Bundler"`** (bukan `NodeNext`) — supaya import tanpa ekstensi `.js`
   tetap konsisten dengan gaya `ocm` yang sudah ada. Build via Bun tidak butuh ekstensi.
2. **Sequential update, paralel scan** — banyak PM (`apt`/`dpkg`) konflik kunci kalau paralel;
   command read-only (list outdated) aman untuk paralel.
3. **`scanner.ts` dipisah** dari `auto.ts` dan `interactive.ts` — kedua mode butuh scan dengan
   logika yang sama; pemisahan mencegah duplikasi & memudahkan testability.
4. **Auto-install deps di wrapper** — kalau `node_modules/@clack` belum ada, wrapper jalankan
   `bun install --silent` sekali. Meminimalkan friksi fresh-clone.
5. **Arsip `sup.sh` di `docs/history/`, bukan dihapus total** — mengikuti praktik repo
   (lihat entry history `2026-07-26_fex-cobra-fix-dan-struktur-dokumentasi.md`) yang
   menyimpan histori perubahan.

## File yang Berubah / Bertambah
- ➕ `tools-cli/src/sup/` (seluruh folder)
- ➕ `tools-cli/bin/sup`
- ✏️ `tools-cli/src/sup/tsconfig.json` (relaksasi module resolution)
- ✏️ `tools-cli/src/sup/src/help.ts` (fix `}` typo)
- ✏️ `README.md` (tree + section `sup`)
- ✏️ `CHANGELOG.md` ([Unreleased])
- 🔀 `scripts/shell/sup.sh` → `docs/history/sup-migration/sup.sh.v3-bash-legacy`
