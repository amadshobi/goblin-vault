# History: `sup` — Sudo Fix via Clack `p.password()` + `sudo -S` (2026-07-30)

## TL;DR
Memperbaiki `sudo` flow pada target `apt` & `snap` yang sebelumnya gagal dengan
error `sudo: A terminal is required to authenticate` karena stdin terminal
direbut oleh UI Clack. Solusinya: minta password via komponen interaktif
Clack (`p.password()`) lalu kirim ke `sudo -S` lewat stdin stream, sehingga
tidak ada lagi tabrakan TTY dengan spinner/prompt Clack.

## Root Cause
`execLive()` lama memakai `stdin: "inherit"` agar `sudo` bisa prompt password
di terminal — bersamaan dengan `spawnSync("sudo", ["-v"], { stdio: "inherit" })`
yang dijalankan paralel dengan banner/spinner Clack. Hasilnya: stdin dan TTY
direbut dua-duanya, dan `sudo` gagal otentikasi.

## Fix Applied
1. **Modul baru `src/sudo.ts`** — private holder password + helper:
   - `requestSudoPassword()` — panggil `p.password()` dengan mask `*`, validate,
     tangani `p.isCancel()` agar Ctrl+C tidak error.
   - `setSudoPassword/getSudoPassword/hasSudoPassword/clearSudoPassword` —
     API kecil untuk caching di memori (tidak dipersist).
   - `targetNeedsSudo(id)` + `SUDO_REQUIRED_TARGETS` — declarative list
     target yang butuh root (`apt`, `snap`).
   - Password **tidak pernah** dicetak atau dipersist ke file.

2. **`src/exec.ts` `execLive()`** — deteksi `cmdParts[0] === "sudo"`:
   - Kalau ada password tersimpan → inject `sudo -S` di posisi ke-2,
     `stdin: "pipe"`, lalu kirim `password\n` lewat `proc.stdin.write()`.
   - Kalau tidak ada → fallback `stdin: "inherit"` (perilaku lawas).

3. **`src/index.ts`** — hapus seluruh `spawnSync("sudo", ["-v"], ...)` lama
   dan `keepSudoAlive()` background-loop. Ganti dengan:
   - Single-target `sup <target>`: kalau `targetNeedsSudo(lower)` →
     `await ensureSudoAuth(...)` → `process.exit(1)` kalau gagal.
   - Mode interaktif: kalau ada target kandidat yang butuh sudo → minta
     sekali via `p.password()` di awal. Kalau user cancel → warn &
     lanjut tanpa skip total (target lain tetap jalan).

4. **`src/help.ts`** — perbarui catatan Level 2 untuk `apt` & `snap`
   dari "sudo -v akan diminta otomatis" menjadi "Password sudo dikirim
   via stdin (sudo -S) — tidak konflik dengan UI Clack".

5. **`src/targets.ts` `withSudo()`** — signature tetap, tapi dokumentasi
   menjelaskan interaksi dengan `execLive()` (satu sumber kebenaran untuk
   flag `-S`).

## Verifikasi
- `bun run typecheck` → ✅ tsc --noEmit lulus tanpa error.
- `bun run build` → ✅ Bundled 15 modules, 82.26 KB.
- `bash scripts/check_syntax.sh --full` → ✅ Repo-wide syntax check lulus.
- **Functional smoke test** (Bun + fake-`sudo` di PATH prepend)：
  - `[with PW] ARGS=-S id` + `STDIN_PW=my-SECRET-password` → injection & stdin write works.
  - `[no  PW]  ARGS=id`   + `STDIN_PW=`                   → fallback path active.
- `sup --help` & `sup snap --help` → output masih konsisten, banner
  ASCII + daftar target tidak rusak.

## Side Effects
- Perilaku `execLive()` ketika head command adalah `sudo` **selalu** aman
  terhadap password (otomatis inject `-S` ketika bisa). Tidak mengganggu
  command sudo non-elevasi karena flag `-S` no-op untuk `sudo --version` dll.
- Variable `KNOWN_SUBCMDS` di `index.ts` masih ada (unused, warisan) — sengaja
  tidak dirapikan untuk menjaga diff tetap kecil & reversible.
- Non-TTY mode: prompt dilewati. Host sysadmin diharapkan menjalankan
  `sup` lewat `sudo -E sup <target>` atau langsung sebagai `root` di pipeline.
