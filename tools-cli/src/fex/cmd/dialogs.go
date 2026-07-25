package cmd

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
)

// debugLog — append debug log ke /tmp/fe-rename.log
func debugLog(format string, args ...interface{}) {
	f, err := os.OpenFile("/tmp/fe-rename.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	all := append([]interface{}{time.Now().Format("15:04:05.000")}, args...)
	msg := fmt.Sprintf("[%s] "+format, all...)
	f.WriteString(msg + "\n")
}

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

// renameDialog — stdin prompt: user ketik nama baru dan tekan Enter.
// Lebih reliable dari fzf-based karena menghindari output order ambiguity
// antara --expect dan --print-query di berbagai versi fzf.
func renameDialog(path string) string {
	oldName := filepath.Base(path)
	fmt.Fprintf(os.Stderr, "✏ Rename '%s'\n> ", oldName)

	reader := bufio.NewReader(os.Stdin)
	newName, err := reader.ReadString('\n')
	if err != nil {
		debugLog("renameDialog: read error oldName=%q err=%v", oldName, err)
		return ""
	}

	newName = strings.TrimSpace(newName)
	debugLog("renameDialog: path=%q oldName=%q newName=%q same=%v empty=%v",
		path, oldName, newName, newName == oldName, newName == "")
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
