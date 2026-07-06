# Goblin Vault 🙉

<p align="center">
  <img src="https://img.shields.io/badge/Goblin-Certified-magenta?style=for-the-badge&logo=opsgenie" alt="Goblin Certified" />
  <img src="https://img.shields.io/badge/Shell-Zsh%20%26%20Bash-blue?style=for-the-badge&logo=gnu-bash" alt="Shell" />
  <img src="https://img.shields.io/badge/Node-v22+-green?style=for-the-badge&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/Status-Under%20Evolution-orange?style=for-the-badge" alt="Status" />
</p>

---

> *"Ini bukan tentang nyari stars di GitHub. Bukan tentang keliatan keren di depan publik, apalagi sekadar latah ikut-ikutan tren AI yang lagi rame. Ini adalah catatan evolusi seorang **builder-goblin**. Setiap hari kami menemukan friksi di terminal, setiap hari kami terbentur hal-hal tidak efisien, dan setiap hari pula kami mengikis friksi tersebut—sedikit demi sedikit—hingga tumpukan script acak ini berevolusi menjadi sebuah **Control Center** yang sesungguhnya."*

---

## 🏗️ Struktur Vault

Repository ini adalah pusat komando dan memori dari seorang builder-goblin:

* 📂 **`./.opencode/`** — Divisi otak & konfigurasi agent OpenCode (prompts, commands, plugins, & skills).
* 📂 **`./tools-cli/`** — Pusat persenjataan CLI yang mempermudah navigasi dan operasional harian.
  * 📁 `bin/` — Executable binaries/wrappers siap pakai (`fe`, `ocm`, `gh-blin`).
  * 📁 `src/` — Source code mentah dari aplikasi CLI.
  * 📁 `utils/` — Helper script sekali jalan.
  * 📁 `tests/` — Laboratorium uji coba (scratchpad).
  * 📁 `docs/` — Dokumentasi dan manual Book.

---

## 🛠️ Senjata Utama (`tools-cli/bin/`)

### 1. 🔍 `fe` (File Explorer)
Alat navigasi super cepat menggunakan `fzf` + `tmux` split. Dioptimalkan dengan filter `-prune` agar tidak tersangkut di folder sampah (`node_modules`, `.git`, dll.). Dilengkapi state-machine internal untuk mendukung navigasi balik (`Esc` untuk mundur, `Ctrl+H` untuk Home, `Ctrl+R` untuk Root).

### 2. ⚙️ `ocm` (OpenCode Configurator)
Dashboard TUI interaktif berbasis Node.js (`@clack/prompts`) untuk mengelola workspace, agent, session, dan credentials API Key AI tanpa perlu mengedit file JSONC secara manual.

### 3. 🐙 `gh-blin` (GitHub Assistant TUI)
Asisten pribadi bermata satu yang membantu menangani pull-requests, issues, dan monitoring repositori GitHub langsung dari terminal dengan nyaman.

---

## ⚙️ Setup & Integrasi

Agar semua senjata di dalam `tools-cli/` bisa dipanggil langsung dari terminal mana saja, cukup tambahkan folder `bin` ke `$PATH` shell Anda (Zsh/Bash):

```bash
# Tambahkan ke ~/.zshrc atau exports.sh Anda
export PATH="$PATH:$HOME/civil/goblin-vault/tools-cli/bin"
```

Setelah itu, jalankan reload shell dan panggil `fe`, `ocm`, atau `gh-blin` secara bebas!

---
<p align="center">
  <i>Dibuat oleh Goblin, dirawat oleh Goblin, untuk kedamaian terminal Goblin. 🍻👹</i>
</p>
