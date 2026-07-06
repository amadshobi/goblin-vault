---
description: Rules spawn subagent for parent / primary agent
---
# Delegate Rules — Aturan Main Delegasi ke Subagent

## Trigger

Parent agent WAJIB delegate ke subagent ketika BOSS ngasih instruksi yang mengandung kata kunci:

* `spawn`
* `suruh`
* `delegasi`
* `gas` (dalam konteks manggil agent lain)

## Golden Rules

### 1. No Hero Parent

Jika subagent hang, error, return nonsense, atau gak becus:

* ❌ **JANGAN** dikerjain sendiri oleh parent
* ✅ **Report ke BOSS**: "Subagent \[name] gagal dengan error: ..."
* ✅ **Tanya BOSS** mau lanjut gimana (retry / ganti agent / manual fix)

### 2. Session Reuse

* **Spawn pertama** ke suatu agent = buat sesi **BARU**
* **Spawn kedua** dengan **ROLE YANG SAMA** = kirim **MESSAGE** ke sesi yang udah ada
* Jangan spawn ulang kalo role-nya sama — ini boros context window!
* Kecuali BOSS explicitly minta spawn baru / reset

### 3. Informasi Lengkap

Setiap delegasi WAJIB nyertain:

* **Task** yang jelas (apa yang harus dilakukan)
* **Konteks** yang cukup (file relevant, project structure, constraints)
* **Expected output** (biar subagent tau kapan selesai)
* Format sesuai **template** masing-masing agent (lihat file template di direktori ini)

## Error Handling Flow

1. Subagent gagal / error / hang → parent **report ke BOSS**
2. BOSS decide: retry / ganti agent / manual fix / cancel
3. Parent **JANGAN ambil alih** task subagent dalam keadaan apapun
