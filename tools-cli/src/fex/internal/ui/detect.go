// == CORE MISSION ==============================================
// internal/ui/detect.go — Tool Detection (Shared)
//
// SINGLE SOURCE OF TRUTH untuk detect external tools.
// Semua package lain WAJIB panggil dari sini, ga boleh
// implementasi detect sendiri-sendiri.
//
// Coverage:
//   - Preview command (bat > batcat > cat)
//   - Editor (micro > nano > vim > vi)
//   - Directory listing (fd > find)
// ==============================================================
package ui

import (
	"os"
	"os/exec"
)

// DetectPreviewCmd — auto-detect preview command untuk fzf.
// Priority: bat > batcat > cat -n
//
// Returns command string yang siap dipakai di --preview fzf.
// Include fallback `cat -n` kalo bat/batcat ga ada.
func DetectPreviewCmd() string {
	for _, cmd := range []string{"bat", "batcat"} {
		if path, err := exec.LookPath(cmd); err == nil {
			return path + ` --style=numbers --color=always {} 2>/dev/null || cat -n {} 2>/dev/null`
		}
	}
	return `cat -n {} 2>/dev/null || echo '(preview not available)'`
}

// DetectEditor — auto-detect text editor.
// Priority: $EDITOR env > micro > nano > nvim > vim > vi
// Returns fallback "cat" kalo ga ada editor satupun.
func DetectEditor() string {
	if e := os.Getenv("EDITOR"); e != "" {
		return e
	}
	for _, cmd := range []string{"micro", "nano", "nvim", "vim", "vi"} {
		if path, err := exec.LookPath(cmd); err == nil {
			return path
		}
	}
	return "cat"
}

// HasFd — check apakah `fd` tersedia di PATH.
func HasFd() bool {
	_, err := exec.LookPath("fd")
	return err == nil
}
