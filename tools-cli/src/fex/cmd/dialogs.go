package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/util"
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

// largeDirWarningDialog — fzf confirm untuk direktori besar ($HOME / /).
// Return true jika user setuju lanjut scan, false jika cancel (Esc / Enter di opsi batal).
func largeDirWarningDialog(dir string) bool {
	opts := fzf.DefaultFzfOpts()
	opts.Header = fmt.Sprintf("⚠ PERINGATAN: Memindai direktori '%s' via Flat Find mungkin memakan waktu.", dir)
	opts.BorderLabel = " ⚠ Large Directory Warning "
	opts.Prompt = " ❯ "
	opts.NoSort = true
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	choices := []string{
		"▶ Lanjutkan Scan (Enter)",
		"✖ Batal & Tetap di Tree Mode (Esc)",
	}

	result, err := fzf.Run(strings.Join(choices, "\n"), opts)
	if err != nil || len(result.Selected) == 0 {
		return false
	}

	return strings.HasPrefix(result.Selected[0], "▶")
}

// renameDialog — fzf popup: pre-filled dengan nama lama, user edit & Enter.
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

// helpDialog — fzf popup: menampilkan panduan keybindings interaktif fex secara dinamis.
func helpDialog(cfg *config.Config) {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "⌨️ FEX Keybindings — Press Enter or ESC to return"
	opts.BorderLabel = " ⌨️ Keybindings Help "
	opts.Prompt = " ❯ "
	opts.NoSort = true
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	kb := config.DefaultKeybindings()
	if cfg != nil {
		kb = cfg.Keybindings
	}

	helpText := []string{
		"NAVIGATION:",
		fmt.Sprintf("  %-13s Buka file di Editor / Masuk folder", "Enter"),
		fmt.Sprintf("  %-13s Batal / Naik 1 direktori (Tree mode) / Back (Search)", "Esc"),
		fmt.Sprintf("  %-13s 🔄 Ganti mode instan (Tree ⇄ Flat Find)", kb.SwitchMode),
		"",
		"CLIPBOARD & FILE OPS:",
		fmt.Sprintf("  %-13s 📋 Tandai untuk Salin (Copy)", kb.MarkCopy),
		fmt.Sprintf("  %-13s 📦 Tandai untuk Pindah (Move / Cut)", kb.MarkMove),
		fmt.Sprintf("  %-13s 📥 Tempel (Paste) di direktori aktif", kb.Paste),
		fmt.Sprintf("  %-13s ✏️ Ganti nama (Rename) file/folder", kb.Rename),
		fmt.Sprintf("  %-13s 🗑️ Hapus (Delete) file/folder", kb.Delete),
		fmt.Sprintf("  %-13s 📄 Buat file baru (Tree mode)", kb.NewFile),
		fmt.Sprintf("  %-13s 📁 Buat folder baru (Tree mode)", kb.NewFolder),
		"",
		"GIT INTEGRATION (CONTEXT-AWARE):",
		fmt.Sprintf("  %-13s 🐙 lazygit TUI (di Folder) / Git History & Diff (di File)", kb.Git),
		"",
		"SEARCH & UTILITIES:",
		fmt.Sprintf("  %-13s 🔍 Live search konten file (ripgrep)", kb.Search),
		fmt.Sprintf("  %-13s 📋 Salin path ke OS clipboard (Universal OSC 52)", kb.CopyPath),
		fmt.Sprintf("  %-13s ⭐ Tambahkan ke Bookmarks", kb.Bookmark),
		fmt.Sprintf("  %-13s ❌ Hapus dari Bookmarks", kb.Unbookmark),
		fmt.Sprintf("  %-13s 🖥️ Buka direktori di Tmux pane sebelah", kb.TmuxPane),
		"",
		"PREVIEW & HELP:",
		fmt.Sprintf("  %-13s 👁️ Toggle preview pane", kb.TogglePreview),
		fmt.Sprintf("  %-13s 🖥️ Toggle fullscreen layout preview", kb.ToggleLayout),
		fmt.Sprintf("  %-13s ❓ Buka dialog panduan bantuan ini", kb.Help+" / ?"),
	}

	_, _ = fzf.Run(strings.Join(helpText, "\n"), opts)
}

// openLazygit — meluncurkan lazygit TUI penuh jika di dalam Git work tree.
func openLazygit(dir string) string {
	checkCmd := exec.Command("git", "-C", dir, "rev-parse", "--is-inside-work-tree")
	if err := checkCmd.Run(); err != nil {
		return "⚠ [Bukan repositori Git]"
	}

	if lgPath, err := exec.LookPath("lazygit"); err == nil && lgPath != "" {
		cmd := exec.Command(lgPath)
		cmd.Dir = dir
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		_ = cmd.Run()
		return ""
	}

	// Fallback ke gitStatusDialog jika lazygit tidak terpasang
	gitStatusDialog(dir)
	return ""
}

// fileGitHistoryDialog — fzf popup viewer: riwayat commit file di kiri & live diff di kanan.
func fileGitHistoryDialog(dir string, filePath string) string {
	checkCmd := exec.Command("git", "-C", dir, "rev-parse", "--is-inside-work-tree")
	if err := checkCmd.Run(); err != nil {
		return "⚠ [Bukan repositori Git]"
	}

	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		gitStatusDialog(dir)
		return ""
	}

	logCmd := exec.Command("git", "-C", dir, "log", "--oneline", "-n", "100", "--", filePath)
	out, err := logCmd.Output()
	if err != nil || len(out) == 0 {
		return fmt.Sprintf("ℹ [Belum ada riwayat commit Git: %s]", filepath.Base(filePath))
	}

	lines := strings.TrimSpace(string(out))
	if lines == "" {
		return fmt.Sprintf("ℹ [Belum ada riwayat commit Git: %s]", filepath.Base(filePath))
	}

	dirQuoted := util.ShEscape(dir)
	fileQuoted := util.ShEscape(filePath)

	opts := fzf.DefaultFzfOpts()
	opts.Header = fmt.Sprintf("📜 Git History: %s — Press Enter or ESC to return", filepath.Base(filePath))
	opts.BorderLabel = fmt.Sprintf(" 📜 History & Diff: %s ", filepath.Base(filePath))
	opts.Prompt = " 📜 ❯ "
	opts.NoSort = true
	opts.Cycle = true
	opts.PreviewWindow = "right:65%:wrap,border-left"
	opts.PreviewCmd = fmt.Sprintf("git -C %s show --color=always {1} -- %s 2>/dev/null || echo 'No diff available'", dirQuoted, fileQuoted)

	_, _ = fzf.Run(lines, opts)
	return ""
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
