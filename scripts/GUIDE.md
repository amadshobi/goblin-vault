# Panduan Modifikasi & Kustomisasi OCM (OpenCode Configurator)

Dokumen ini berisi panduan untuk mengedit, mengubah, dan menambah fitur di dalam script TUI `ocm`.

## Struktur Direktori
Semua logika utama `ocm` berada di folder `~/.opencode/scripts/tui_src/`:
- **`index.js`**: File masuk utama (Entry point).
- **`utils.js`**: Helper global (membaca database, scanning project, manipulasi file JSONC, dan fungsi pembangun workspace baru).
- **`ui/`**
  - **`menu.js`**: Menu navigasi utama (Main Menu Loop) dan alur Switch Workspace.
  - **`spinner.js`**: Utilitas spinner kustom ala goblin/monyet (`🙈`, `🙉`, `🙊`).
- **`commands/`**: Logika bisnis untuk setiap aksi di menu utama:
  - `run.js`: Menjalankan agent (TUI/Non-TUI) & penyeleksi project workspace.
  - `session.js`: Manajemen database session (Export & Delete dengan Multi-Select).
  - `agent.js`: Konfigurasi detail field agent.
  - `settings.js`, `mcp.js`, `models.js`, `providers.js`, `doctor.js`: Konfigurasi sistem lainnya.

---

## 1. Cara Mengubah Menu & Deskripsi Utama
Jika ingin menambah menu baru, mengubah nama menu, atau mengedit penjelasan (hint) di menu utama:
1. Buka file [menu.js](file:///root/goblin/.opencode/scripts/tui_src/ui/menu.js).
2. Cari bagian `// 2. Select Action` pada fungsi `runInteractiveLoop()`.
3. Edit array `options` pada `p.autocomplete`. 
   - Gunakan format: `{ value: 'key', label: 'Nama Menu', hint: 'Keterangan yang muncul saat disorot' }`.
4. Tambahkan percabangan logika penanganan menu di bagian `// 4. Command Execution Dispatcher` (baris ~100 ke bawah).

---

## 2. Cara Kustomisasi Pembuat Workspace ("Add Workspace")
Logika pembuatan workspace baru (bootstrapper) berada di satu tempat saja agar mudah dirawat:
1. Buka file [utils.js](file:///root/goblin/.opencode/scripts/tui_src/utils.js).
2. Cari fungsi `async function createNewWorkspace()`.

### Menambah Folder Baru Default (Misal: `rules/` atau `plugins/`)
- Di bagian `options` pada `p.multiselect`, tambahkan opsi baru:
  ```javascript
  { value: 'rules', label: 'rules/ (Folder)' }
  ```
- Di bagian logika pembuatan folder di bawahnya, tambahkan penanganannya:
  ```javascript
  if (toCreate.includes('rules')) {
    fs.mkdirSync(path.join(opencodeDir, 'rules'), { recursive: true });
  }
  ```

---

## 3. Cara Menggunakan Custom Monkey Spinner
Spinner monyet (`🙈 🙉 🙊`) dengan delay 300ms otomatis (untuk menghindari flicker pada tugas instan) di-export dari [spinner.js](file:///root/goblin/.opencode/scripts/tui_src/ui/spinner.js).

### Cara Pakai:
1. Import helper di file target Anda:
   ```javascript
   const { runWithSpinner } = require('../ui/spinner');
   ```
2. Jalankan fungsi asynchronous Anda di dalam wrapper `runWithSpinner`:
   ```javascript
   const hasil = await runWithSpinner(async () => {
     // Lakukan proses asinkronus (query, read, atau request API)
     return await somePromiseTask();
   }, "Pesan loading kustom Anda (opsional)");
   ```
   *Catatan: Jangan gunakan fungsi Synchronous (seperti `execSync`) di dalam wrapper agar animasi spinner tidak membeku.*

---

## 4. Cara Mengubah Kata-kata Acak Goblin (Loading Message)
1. Buka file [spinner.js](file:///root/goblin/.opencode/scripts/tui_src/ui/spinner.js).
2. Edit atau tambahkan kalimat baru ke dalam array `goblinMessages`:
   ```javascript
   const goblinMessages = [
     "Goblin lagi nyari data...",
     "Bentar blin, lagi ngitung token...",
     // Tambahkan pesan lucu lainnya di sini
   ];
   ```

---
*Selamat ngoprek, BOSS! 🚀*
