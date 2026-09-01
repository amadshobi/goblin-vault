# Changelog — `zf`

> Riwayat lengkap perubahan untuk tool **`zf`** (ZF Navigation Engine).
> Master changelog: [CHANGELOG.md](../../CHANGELOG.md)

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [v2.0.1] - 2026-09-01

### Fixed

- **Shell Wrapper Eval Sanitization (`cmd/init.go`)**:
  - Menyempurnakan regex filter pattern pada Fish shell (`[;|&$]`) dengan menghapus escape redundan.
  - Memperbaiki pattern matching sanitasi aksi eval pada POSIX/Zsh wrapper (`*";"*|*"&"*|*"|"*|*"$"*`) untuk memastikan filtering karakter injeksi berbahaya berjalan andal lintas shell (Zsh, Bash, Dash).

---

## [v2.0.0] - 2026-08-25

### Added
- **Full Architecture Evolution to Go + Bubble Tea + Lipgloss (The Next-Gen ZF)**:
  - Transformasi total dari kumpulan shell script FZF lama menjadi compiled single binary Go yang type-safe, ultra-responsif, dan zero-lag.
  - **Pixel-Perfect 3-Pane Layout**: Pembagian matematis presisi tinggi antara Workspaces, Git Status, dan File Tree dengan garis batas bawah rata sempurna (`m.Height - 2`).
  - **OpenCode-Style Inverted Full-Pill Highlight**:
    - Baris aktif diisi blok background aksen tema penuh tanpa celah/garis belang.
    - Teks, ikon, dan skor di baris aktif dibalik menjadi hitam pekat (`#11111B`) bold ber-kontras maksimal.
    - Baris tidak aktif tampil dalam teks putih bersih di atas latar terminal asli.
  - **Pure Nerd Font Iconography**: Menggantikan seluruh emoji dengan glyph Nerd Font presisi (`󰉋`, ``, ``, ``, `󰜘`, ``, ``, ``, ``, ``, `󰈚`, ``).
  - **Declarative JSON Theme Engine (`~/.config/zf/themes/`)**:
    - Schema tema sederhana 8 field (`border`, `border_dim`, `path_selected`, `path_unselected`, `git`, `file_selected`, `file_unselected`, `bg_selected`).
    - Mendukung built-in presets: `Monokai`, `Catppuccin`, `TokyoNight`, `Nord`, dan `Gruvbox`.
    - Drop & play: pengguna dapat menambahkan file `.json` tema kustom baru di `~/.config/zf/themes/` tanpa perlu kompilasi ulang.
  - **Interactive Action Command Palette (`?`)**:
    - Transformasi menu bantuan statis menjadi command palette interaktif bergaya OpenCode/Raycast.
    - Navigasi pilihan aksi cepat dengan `j`/`k` dan eksekusi instan dengan `Enter`.
  - **Interactive Theme Switcher Palette (`T`)**:
    - Memilih tema secara visual dari daftar tema aktif dengan preview status `● Active` dan navigasi `j`/`k`.
  - **In-Place Editor Suspension (`tea.ExecProcess`)**:
    - Menekan `e` atau `Enter` pada file di File Tree akan men-suspend TUI dan membuka `$EDITOR` (Neovim/Micro).
    - Saat keluar dari editor (misal `Ctrl+X` atau `:q`), kontrol langsung kembali ke posisi TUI terakhir seketika dengan auto-refresh live Git snapshot.
    - Folder Guard: Menekan `Enter` atau `e` saat kursor berada pada folder akan diabaikan dengan aman (anti salah edit direktori).
  - **Ergonomic Arrow Navigation (`←` / `→`) & Continuous Cycling**:
    - Berpindah fokus antar panel kiri dan kanan menggunakan tombol panah `←` dan `→`.
    - Navigasi wrap-around (`--cycle`) aktif secara default pada list workspace, status git, dan file tree.
  - **Streamlined Tmux Controller (`zf tm`)**:
    - Alias pendek `zf tm` dengan flag ringkas: `-l` (list), `-n` (new), `-i` (in/attach), `-d` (del).
  - **Robust POSIX Shell Integration (`zf init`)**:
    - Shell wrapper function dengan fast-path bypass untuk perintah bantuan, versi, dan subcommands CLI murni guna mencegah error `file name too long`.

### Removed
- Menghapus flag redundan `--nvim` dan `--fextr`.
- Menghapus nomor urut panel `1`, `2`, `3` pada header agar tampilan lebih bersih dan modern.
- Menghapus pembatasan truncate `...dan X file lainnya` pada Git Status, digantikan dengan scrollable viewport utuh.

### Fixed
- **Startup Latency & DSR 6n Optimization**:
  - Mengurangi timeout probe DSR dari 700ms ke 25ms dengan *fail-fast* pada kegagalan probe pertama, memangkas waktu startup `zf` dari **1.400 ms (1,4 detik)** menjadi **< 40 ms (36x lebih cepat)** dan menghilangkan glitch kedip probe.
- **Tmux Interactive Session Picker & Flag Contracts (Issue #33)**:
  - Mengembalikan interaktivitas penuh pada subcommand `zf tm` (`zf tmux`) untuk flag `-i` (in/attach), `-n` (new), dan `-d` (del) saat dipanggil tanpa argumen baik dari shell langsung maupun Tmux popup (`display-popup`).
  - Menghilangkan crash `flag needs an argument` dengan konfigurasi `NoOptDefVal` pada Cobra parser serta fallback interaktif via prompt/picker.
  - Menambahkan dukungan flag `-t` / `--tmux` pada `zf` root command untuk memilih direktori via 3-Pane TUI dan membuka prompt pembuatan sesi tmux baru di path tersebut.
  - Memperbaiki penanganan tombol `Esc` pada 3-Pane TUI dan interactive prompt agar membatalkan popup secara bersih tanpa error.
  - Memperbaiki infinite recursion pada Cobra subcommand help printer (`zf <subcommand> --help`).
  - Menambahkan test suite `cmd/tmux_test.go` untuk validasi flag contract.
- **Border Kanan Meleyot di Terminal Mobile (Termius)**:
  - Akar masalah: char border `│` menyempil di ujung tiap baris, sehingga setiap selisih antara lebar glyph menurut tabel Unicode vs lebar render aktual terminal membuat border bergeser per baris (meleyot). Termius merender Nerd Font glyph secara campuran (sebagian 1 sel, sebagian 2 sel) sehingga tebakan konstanta apapun pasti gagal.
  - Solusi definitif: **Runtime Glyph Calibration** (`internal/ui/calibrate.go`) — sebelum TUI start, lebar render glyph diukur langsung dari terminal via cursor position report (DSR `ESC[6n`, mekanisme yang sama dipakai vim). Kalibrasi dilakukan per-kelas range (satu probe per range PUA BMP/SMP) agar hemat roundtrip dan ramah latensi SSH mobile.
  - Pembacaan respons CPR memakai non-blocking poll via syscall (`unix.SetNonblock`) sehingga tidak bergantung pada dukungan `SetReadDeadline` os.File yang tidak konsisten antar platform.
  - Perintah diagnosa tersembunyi `zf cal` untuk memverifikasi hasil kalibrasi langsung dari terminal pengguna.
  - **Manual Border Rendering**: `DecoratePane` menggambar border rounded per-baris secara manual tanpa auto-pad `lipgloss.BorderStyle`, mengeliminasi hidden padding berbasis tabel Unicode yang menjadi sumber geseran tambahan.
  - `ui.NerdClamp()` untuk truncation ANSI-safe yang sadar kalibrasi; diterapkan pada gap semua pane, judul header, dan footer keybinding hints.

---

## [v0.3.15] - 2026-07-28

### Added
- **Global Ultra-Clean ASCII Art Banners (bagian dari suite CLI GN, ZF, FEX, OCM)**:
  - Penyesuaian banner visual seragam dengan font ASCII Art tebal presisi tinggi.
  - Penempatan nama tool persis di bawah banner dengan skema warna pure white.

## [v0.3.0] - 2026-07-26

### Added
- `tools-cli/src/zf/` & `tools-cli/bin/zf` — Zoxide & Tmux Navigation Engine port dari `~/.shell/` yang kini bersatu di `tools-cli`.
