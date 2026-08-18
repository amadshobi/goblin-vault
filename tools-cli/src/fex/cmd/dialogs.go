package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
)

// confirmDeleteDialog — fzf confirm: user tekan Ctrl-d lagi buat confirm.
func confirmDeleteDialog(path string) bool {
	opts := fzf.DefaultFzfOpts()
	opts.Header = fmt.Sprintf("⚠ DELETE %s? Press Ctrl-d again to confirm, ESC to cancel", filepath.Base(path))
	opts.Query = filepath.Base(path)
	opts.Expected = "ctrl-d"
	opts.NoSort = true
	opts.BorderLabel = " ⚠ Confirm Delete "
	opts.Prompt = " ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	result, err := fzf.Run(filepath.Base(path)+"\n", opts)
	if err != nil {
		return false
	}
	return result.ExpectedKey == "ctrl-d"
}

// renameDialog — fzf popup: pre-filled dengan nama lama, user edit & Enter.
// Konsisten dengan newFileDialog / newFolderDialog — gak ada stdin prompt
// yang bikin terminal kotor, popup di-render di atas fzf.
func renameDialog(path string) string {
	oldName := filepath.Base(path)
	opts := fzf.DefaultFzfOpts()
	opts.Header = "✏️ Edit filename, press Enter to confirm"
	opts.Query = oldName // Pre-filled — user tinggal edit
	opts.Expected = ""
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " ✏️ Rename "
	opts.Prompt = " ✏️ ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""
	opts.Bindings = []string{"enter:print-query"}

	// Empty input (no candidates) — user ketik/edit di query box
	result, err := fzf.Run("", opts)
	if err != nil {
		return ""
	}
	newName := strings.TrimSpace(result.Query)
	if newName == "" || newName == oldName {
		return ""
	}
	return newName
}

// newFileDialog — fzf input: ketik nama file di query, tekan Enter untuk create.
func newFileDialog(dir string) string {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "📄 New file — Type filename in query, press Enter to create"
	opts.Query = ""
	opts.Expected = ""
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " 📄 New File "
	opts.Prompt = " 📄 ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""
	opts.Bindings = []string{"enter:print-query"}

	// No dummy item — kosongkan list, user ketik di query
	result, err := fzf.Run("", opts)
	if err != nil {
		return ""
	}
	name := strings.TrimSpace(result.Query)
	if name == "" {
		return ""
	}
	return name
}

// newFolderDialog — fzf input: ketik nama folder di query, tekan Enter untuk create.
func newFolderDialog(dir string) string {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "📁 New folder — Type folder name in query, press Enter to create"
	opts.Query = ""
	opts.Expected = ""
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " 📁 New Folder "
	opts.Prompt = " 📁 ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""
	opts.Bindings = []string{"enter:print-query"}

	result, err := fzf.Run("", opts)
	if err != nil {
		return ""
	}
	name := strings.TrimSpace(result.Query)
	if name == "" {
		return ""
	}
	return name
}

// executeDelete — hapus file atau folder (rekursif kalo folder).
func executeDelete(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return os.RemoveAll(path)
	}
	return os.Remove(path)
}

// helpDialog — fzf popup: menampilkan panduan keybindings interaktif fex.
func helpDialog() {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "⌨️ FEX Keybindings — Press Enter or ESC to return"
	opts.BorderLabel = " ⌨️ Keybindings Help "
	opts.Prompt = " ❯ "
	opts.NoSort = true
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	helpText := []string{
		"NAVIGATION:",
		"  Enter         Buka file di Editor / Masuk folder",
		"  Esc           Batal / Naik 1 direktori (Tree mode)",
		"  Tab           Pilih banyak file (Multi-select)",
		"",
		"CLIPBOARD & FILE OPS:",
		"  Alt-c         📋 Tandai untuk Salin (Copy)",
		"  Alt-m         📦 Tandai untuk Pindah (Move / Cut)",
		"  Ctrl-v        📥 Tempel (Paste) di direktori aktif",
		"  Ctrl-r        ✏️ Ganti nama (Rename) file/folder",
		"  Ctrl-d        🗑️ Hapus (Delete) file/folder",
		"  Ctrl-n        📄 Buat file baru (Tree mode)",
		"  Ctrl-k        📁 Buat folder baru (Tree mode)",
		"",
		"SEARCH & UTILITIES:",
		"  Ctrl-f        🔍 Live search konten file (ripgrep)",
		"  Ctrl-g        🐙 Tampilkan status & git log",
		"  Ctrl-y        📋 Salin path ke OS clipboard",
		"  Ctrl-b        ⭐ Tambahkan ke Bookmarks",
		"  Ctrl-x        ❌ Hapus dari Bookmarks",
		"  Ctrl-o        🖥️ Buka direktori di Tmux pane sebelah",
		"",
		"PREVIEW & HELP:",
		"  Ctrl-p        👁️ Toggle preview pane",
		"  Ctrl-s        🖥️ Toggle fullscreen layout preview",
		"  Tab           🔄 Ganti mode (Tree ⇄ Flat)",
		"  Ctrl-h / ?    ❓ Buka dialog panduan bantuan ini",
	}

	_, _ = fzf.Run(strings.Join(helpText, "\n"), opts)
}

// gitStatusDialog — fzf popup: menampilkan git status dan 15 commit terakhir tanpa bocor ke terminal luar.
func gitStatusDialog(dir string) {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "🐙 Git Status & Commits — Press Enter or ESC to return"
	opts.BorderLabel = " 🐙 Git Overview "
	opts.Prompt = " ❯ "
	opts.NoSort = true
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	var lines []string
	lines = append(lines, "─── GIT STATUS ──────────────────────────────────────────")
	statusCmd := exec.Command("git", "-C", dir, "status", "-s")
	if out, err := statusCmd.Output(); err == nil {
		statusStr := strings.TrimSpace(string(out))
		if statusStr != "" {
			lines = append(lines, strings.Split(statusStr, "\n")...)
		} else {
			lines = append(lines, "  (Working tree clean, no modified files)")
		}
	} else {
		lines = append(lines, "  (Not a git repository)")
	}

	lines = append(lines, "")
	lines = append(lines, "─── RECENT COMMITS ──────────────────────────────────────")
	logCmd := exec.Command("git", "-C", dir, "log", "--oneline", "-15")
	if out, err := logCmd.Output(); err == nil {
		logStr := strings.TrimSpace(string(out))
		if logStr != "" {
			lines = append(lines, strings.Split(logStr, "\n")...)
		}
	}

	_, _ = fzf.Run(strings.Join(lines, "\n"), opts)
}
