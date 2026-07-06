---
description: spawn agent coder
---

# Delegate: coder (code.md)

## Trigger

Gunakan template ini ketika butuh **bikin code, implementasi fitur, refaktor, atau fix bug**.

## Template Hybrid

### Frame (wajib diisi)

```
Task: <apa yang perlu dibuat/diubah>
Target Files: <path file yang bakal dibuat/dimodifikasi>
Spec / Reference: <file atau docs yang jadi acuan>
Bahasa: <misal: TypeScript, Python, Go>
Framework: <misal: React, Express, Next.js>
Constraints:
  - JANGAN ubah file di luar target
  - <constraint lain>
```

## Tips Biar Coder Gak Halu
- **Target Files wajib jelas.** Kalo cuma "Bikin auth" tanpa nyebut file, coder bakal nebak-nebak.
- **Spec/Reference = anchor.** Kasih file yang bisa dibaca sebagai acuan, biar outputnya konsisten sama project.
- **Constraints itu penting.** Kalo ada pattern/style yang gak boleh dipake, bilang dari awal.
- **Freeform = nyawa implementasi.** Disinilah lo kasih logic flow, edge cases, atau preferensi yg gak bisa di-capture di frame.
- **Jangan lupa template spawn kedua = kirim message aja** (session reuse).
