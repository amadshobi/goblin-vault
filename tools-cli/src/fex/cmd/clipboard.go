package cmd

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type ClipAction string

const (
	ClipActionCopy ClipAction = "copy"
	ClipActionMove ClipAction = "move"
)

// ClipboardItem menyimpan status file/folder yang di-mark untuk copy atau move.
type ClipboardItem struct {
	Action     ClipAction `json:"action"`
	SourcePath string     `json:"source_path"`
	Filename   string     `json:"filename"`
	IsDir      bool       `json:"is_dir"`
	Timestamp  int64      `json:"timestamp"`
}

func getClipFilePath() string {
	user := os.Getenv("USER")
	if user == "" {
		user = "default"
	}
	return filepath.Join(os.TempDir(), fmt.Sprintf("fex-clip-%s.json", user))
}

// MarkClipboard menandai target file/folder untuk operasi copy atau move.
func MarkClipboard(sourcePath string, action ClipAction) error {
	info, err := os.Stat(sourcePath)
	if err != nil {
		return fmt.Errorf("stat source: %w", err)
	}

	item := ClipboardItem{
		Action:     action,
		SourcePath: filepath.Clean(sourcePath),
		Filename:   filepath.Base(sourcePath),
		IsDir:      info.IsDir(),
		Timestamp:  time.Now().Unix(),
	}

	data, err := json.MarshalIndent(item, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal clipboard: %w", err)
	}

	return os.WriteFile(getClipFilePath(), data, 0600)
}

// ReadClipboard membaca item clipboard aktif dari disk.
func ReadClipboard() (*ClipboardItem, error) {
	clipPath := getClipFilePath()
	data, err := os.ReadFile(clipPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var item ClipboardItem
	if err := json.Unmarshal(data, &item); err != nil {
		return nil, err
	}

	// Validasi apakah source path masih ada di filesystem
	if _, err := os.Stat(item.SourcePath); err != nil {
		ClearClipboard()
		return nil, nil
	}

	return &item, nil
}

// ClearClipboard menghapus status clipboard.
func ClearClipboard() {
	_ = os.Remove(getClipFilePath())
}

// CopyToSystemClipboard menyalin path/string ke clipboard sistem (OSC 52 + wl-copy + xclip + pbcopy).
func CopyToSystemClipboard(text string) error {
	if text == "" {
		return fmt.Errorf("empty text")
	}

	// 1. Coba native tools jika tersedia
	if _, err := exec.LookPath("wl-copy"); err == nil {
		cmd := exec.Command("wl-copy")
		cmd.Stdin = strings.NewReader(text)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	if _, err := exec.LookPath("xclip"); err == nil {
		cmd := exec.Command("xclip", "-selection", "clipboard")
		cmd.Stdin = strings.NewReader(text)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	if _, err := exec.LookPath("xsel"); err == nil {
		cmd := exec.Command("xsel", "--clipboard", "--input")
		cmd.Stdin = strings.NewReader(text)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	if _, err := exec.LookPath("pbcopy"); err == nil {
		cmd := exec.Command("pbcopy")
		cmd.Stdin = strings.NewReader(text)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	if _, err := exec.LookPath("termux-clipboard-set"); err == nil {
		cmd := exec.Command("termux-clipboard-set")
		cmd.Stdin = strings.NewReader(text)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	// 2. Universal OSC 52 ANSI Sequence (bekerja di Tmux, WezTerm, Alacritty, Kitty, Windows Terminal)
	b64 := base64.StdEncoding.EncodeToString([]byte(text))
	osc52 := fmt.Sprintf("\x1b]52;c;%s\x07", b64)
	if os.Getenv("TMUX") != "" {
		osc52 = fmt.Sprintf("\x1bPtmux;\x1b\x1b]52;c;%s\x07\x1b\\", b64)
	}

	tty, err := os.OpenFile("/dev/tty", os.O_WRONLY, 0)
	if err == nil {
		defer tty.Close()
		_, _ = tty.WriteString(osc52)
		return nil
	}

	_, _ = os.Stdout.WriteString(osc52)
	return nil
}

// GetClipboardBadge menghasilkan visual badge status clipboard untuk header FZF.
func GetClipboardBadge() string {
	item, err := ReadClipboard()
	if err != nil || item == nil {
		return ""
	}

	icon := "📋 Copy"
	if item.Action == ClipActionMove {
		icon = "📦 Move"
	}

	name := item.Filename
	if len(name) > 20 {
		name = name[:18] + "…"
	}

	return fmt.Sprintf("[%s: %s] ", icon, name)
}

// ExecutePaste mengeksekusi penempelan file/folder ke direktori target (destDir).
func ExecutePaste(destDir string) (string, error) {
	item, err := ReadClipboard()
	if err != nil {
		return "", fmt.Errorf("read clipboard: %w", err)
	}
	if item == nil {
		return "", fmt.Errorf("clipboard kosong (tekan Alt-c untuk Copy atau Alt-m untuk Move terlebih dahulu)")
	}

	// Verifikasi keberadaan file sumber
	if _, err := os.Stat(item.SourcePath); err != nil {
		ClearClipboard()
		return "", fmt.Errorf("source '%s' sudah tidak ada", item.SourcePath)
	}

	destPath := filepath.Join(destDir, item.Filename)

	// Jika lokasi asal dan tujuan persis sama
	if filepath.Clean(item.SourcePath) == filepath.Clean(destPath) {
		if item.Action == ClipActionMove {
			return "", fmt.Errorf("source dan destination direktori identik")
		}
		// Untuk copy di direktori yang sama, auto-rename dengan suffix _copy
		ext := filepath.Ext(item.Filename)
		base := strings.TrimSuffix(item.Filename, ext)
		destPath = filepath.Join(destDir, fmt.Sprintf("%s_copy%s", base, ext))
	}

	if item.Action == ClipActionMove {
		if err := os.Rename(item.SourcePath, destPath); err != nil {
			// Fallback jika beda mount point / partition (EXDEV)
			if err := copyRecursive(item.SourcePath, destPath); err != nil {
				return "", fmt.Errorf("move failed: %w", err)
			}
			_ = os.RemoveAll(item.SourcePath)
		}
		ClearClipboard()
		return fmt.Sprintf("Moved: %s ➔ %s", item.Filename, filepath.Base(destDir)), nil
	}

	// Operasi Copy
	if err := copyRecursive(item.SourcePath, destPath); err != nil {
		return "", fmt.Errorf("copy failed: %w", err)
	}

	return fmt.Sprintf("Copied: %s ➔ %s", item.Filename, filepath.Base(destDir)), nil
}

func copyRecursive(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
			return err
		}
		entries, err := os.ReadDir(src)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			srcSub := filepath.Join(src, entry.Name())
			dstSub := filepath.Join(dst, entry.Name())
			if err := copyRecursive(srcSub, dstSub); err != nil {
				return err
			}
		}
		return nil
	}

	// File copy
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, srcInfo.Mode())
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}
