package cmd

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
)

// getFileList — ambil daftar file (fd fallback ke Go walk), return newline-separated.
func getFileList(dir string, ext string, cfg *config.Config) string {
	if cfg.UseFd {
		fileList, err := getFdFileList(dir, ext)
		if err == nil && fileList != "" {
			return fileList
		}
		// fallback ke Go walk
	}
	files, err := fzf.WalkFiles(dir, ext)
	if err != nil || len(files) == 0 {
		return ""
	}
	return strings.Join(files, "\n")
}

// getFdFileList — pake fd buat file listing, return newline-separated.
func getFdFileList(dir string, ext string) (string, error) {
	if _, err := exec.LookPath("fd"); err != nil {
		return "", err
	}

	args := []string{"--type", "f", "--hidden", "--no-ignore-vcs",
		"--max-depth", "8",
		"--exclude", "node_modules",
		"--exclude", ".git",
		"--exclude", "__pycache__",
		"--exclude", "vendor",
		"--exclude", "dist",
	}

	if ext != "" {
		if strings.HasPrefix(ext, ".") {
			args = append(args, "--extension", ext[1:])
		} else {
			args = append(args, "--glob", fmt.Sprintf("*%s*", ext))
		}
	}

	args = append(args, ".", dir)

	fdCmd := exec.Command("fd", args...)
	fdOut, err := fdCmd.Output()
	if err != nil {
		return "", fmt.Errorf("fd exec: %w", err)
	}

	if len(fdOut) == 0 {
		return "", nil
	}

	return strings.TrimSpace(string(fdOut)), nil
}

// makeAbs — bikin path absolute dari relative path.
func makeAbs(dir, path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(dir, path)
}
