# 🔒 Security Policy & Vulnerability Reporting

> **Goblin Vault Security Statement**  
> Kami mengutamakan keamanan infrastruktur terminal dan script otomasi. Jika Anda menemukan kerentanan keamanan (vulnerability) atau kebocoran kredensial, harap ikuti panduan pelaporan di bawah ini.

---

## 🛡️ Supported Versions

Hanya versi terbaru yang aktif berada di branch `main` atau tag release resmi yang didukung dengan perbaikan keamanan (security patches).

| Version | Supported          |
| ------- | ------------------ |
| `main` (latest release) | ✅ Yes |
| `< 1.0.0` | ❌ No (Deprecated) |

---

## 🚨 Reporting a Vulnerability

**JANGAN MEMBUAT PUBLIC ISSUE** untuk melaporkan kerentanan keamanan yang sensitif.

Jika Anda menemukan potensi celah keamanan di dalam script, tool CLI, atau workflow **Goblin Vault**:

1. **Private Reporting**: Laporkan temuan Anda secara pribadi melalui menu **[Security > Advisory > Report a vulnerability](https://github.com/amadshobi/goblin-vault/security/advisories/new)** di repositori GitHub kami, atau hubungi Maintainer via email/kontak privat.
2. **Detail Laporan**:
   - Deskripsi ringkas kerentanan.
   - Langkah-langkah reproduksi (PoC / proof-of-concept).
   - Dampak potensial (misalnya: privilege escalation, command injection, credential leak).
   - Solusi perbaikan yang disarankan (jika ada).

---

## ⏱️ Response & Handling Process

- **Konfirmasi Awal**: Kami berusaha merespons pelaporan keamanan dalam waktu **24–48 jam**.
- **Evaluasi & Patch**: Jika temuan valid, perbaikan akan dikembangkan secara terisolasi di branch private dan dirilis secepat mungkin.
- **Pengakuan (Credit)**: Kami akan memberikan kredit resmi kepada pelapor yang menemukan kerentanan di dalam catatan release (Release Notes / Security Advisory).

---

> *Keamanan terminal adalah prioritas bersama. Terima kasih telah membantu menjaga Goblin Vault tetap aman! 🍻👹*
