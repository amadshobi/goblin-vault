package cmd

import (
	"fmt"
	"os"
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
