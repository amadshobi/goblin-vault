// == CORE MISSION ==============================================
// internal/tmux/tmux.go — Tmux Wrapper (Go → Bash Bridge)
//
// Wrapper yang spawn tmux commands via os/exec.
// Delegasi operasi split/new-window/select ke helpers/tmux-*.sh
// untuk operasi kompleks, atau langsung panggil tmux CLI.
//
// Filosofi:
//   - Go: state management, decision logic, error handling
//   - Bash helpers: actual tmux command execution (via os/exec)
// ==============================================================
package tmux

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
)

// ── Environment ───────────────────────────────────────────────

// InTmux — check apakah kita di dalam tmux session.
// Mirip [[ -n "${TMUX:-}" ]] di bash.
func InTmux() bool {
	return os.Getenv("TMUX") != ""
}

// RightPaneID — return ID dari right pane (disimpan di env pas startup).
// Di-set oleh SplitOnStartup().
func RightPaneID() string {
	return os.Getenv("FE_TMUX_RIGHT_PANE")
}

// ── Pane Operations ───────────────────────────────────────────

// SplitOnStartup — split window horizontal pas startup (kalo baru 1 pane).
// Mirip setup_tmux_split() di tmux.sh.
//
// Flow:
//   1. Check pane count
//   2. If < 2, split-window -h -p <split_pct>
//   3. Set env FE_TMUX_RIGHT_PANE
//   4. Focus back to current pane
func SplitOnStartup(cfg *config.Config) error {
	if !InTmux() {
		return nil
	}

	// Check pane count
	out, err := runTmux("list-panes")
	if err != nil {
		return fmt.Errorf("list-panes: %w", err)
	}
	paneCount := len(strings.Split(strings.TrimSpace(out), "\n"))
	if paneCount >= 2 {
		return nil // already split
	}

	// Get current pane ID
	currentPane, err := runTmux("display", "-p", "#{pane_id}")
	if err != nil {
		return fmt.Errorf("get current pane: %w", err)
	}

	// Determine split percentage
	pct := 30
	if cfg != nil && cfg.TmuxSplitPct > 0 && cfg.TmuxSplitPct <= 50 {
		pct = cfg.TmuxSplitPct
	}

	// Split window
	_, err = runTmux("split-window", "-h", "-p", fmt.Sprintf("%d", pct))
	if err != nil {
		return fmt.Errorf("split-window: %w", err)
	}

	// Get right pane ID (the newly created pane)
	rightPane, err := runTmux("display", "-p", "#{pane_id}")
	if err != nil {
		return fmt.Errorf("get right pane: %w", err)
	}

	// Store right pane ID in env
	os.Setenv("FE_TMUX_RIGHT_PANE", rightPane)

	// Focus back to original pane
	if _, err := runTmux("select-pane", "-t", currentPane); err != nil {
		// Non-fatal: just log
		_ = err
	}

	// Send welcome message to right pane
	_, _ = runTmux("send-keys", "-t", rightPane, "clear && echo '  === fe editor panel ==='", "C-m")

	return nil
}

// IsPaneIdle — check apakah pane lagi idle (shell prompt).
// Mirip case statement di tmux.sh:
//
//	""|bash|zsh|sh|fish|idle|clear|echo
func IsPaneIdle(paneID string) bool {
	if paneID == "" {
		return false
	}
	cmd, err := runTmux("display-message", "-p", "-t", paneID, "#{pane_current_command}")
	if err != nil {
		return false
	}
	cmd = strings.TrimSpace(cmd)
	switch cmd {
	case "", "bash", "zsh", "sh", "fish", "idle", "clear", "echo":
		return true
	}
	return false
}

// ── Window Operations ─────────────────────────────────────────

// SplitWindow — split window (horizontal atau vertical).
// Delegasi ke helpers/tmux-split.sh.
//
// direction: "h" (horizontal) atau "v" (vertical)
// command: optional command buat pane baru ("" for default shell)
func SplitWindow(direction string, command string) error {
	if !InTmux() {
		return fmt.Errorf("not in tmux")
	}

	// Use helper script for consistency
	feDir := findFeDir()
	helperPath := feDir + "/helpers/tmux-split.sh"

	// Check if helper exists
	if _, err := os.Stat(helperPath); err == nil {
		args := []string{direction}
		if command != "" {
			args = append(args, command)
		}
		_, err := runExternal(helperPath, args...)
		return err
	}

	// Fallback: direct tmux command
	var flag string
	switch direction {
	case "h", "horizontal":
		flag = "-h"
	case "v", "vertical":
		flag = "-v"
	default:
		return fmt.Errorf("invalid direction: %s (use h or v)", direction)
	}

	if command != "" {
		_, err := runTmux("split-window", flag, "-p", "30", command)
		return err
	}
	_, err := runTmux("split-window", flag, "-p", "30")
	return err
}

// NewWindow — buat window baru.
// Delegasi ke helpers/tmux-new-window.sh.
func NewWindow(name string) error {
	if !InTmux() {
		return fmt.Errorf("not in tmux")
	}

	feDir := findFeDir()
	helperPath := feDir + "/helpers/tmux-new-window.sh"
	if _, err := os.Stat(helperPath); err == nil {
		_, err := runExternal(helperPath, name)
		return err
	}

	// Fallback: direct tmux command
	_, err := runTmux("new-window", "-n", name)
	return err
}

// SelectWindow — switch ke window index tertentu.
func SelectWindow(index int) error {
	if !InTmux() {
		return fmt.Errorf("not in tmux")
	}
	_, err := runTmux("select-window", "-t", fmt.Sprintf(":%d", index))
	return err
}

// ── File Operations ───────────────────────────────────────────

// OpenFileInPane — open file di right pane atau split baru.
// Mirip open_file() di tmux.sh lines 29-53.
//
// Flow:
//   1. Cek right pane ID (dari env)
//   2. If valid & idle: send-keys "$EDITOR <file>" C-m, focus
//   3. If busy or no right pane: split-window -h $EDITOR <file>
func OpenFileInPane(filePath string) error {
	if !InTmux() {
		return fmt.Errorf("not in tmux")
	}

	// Resolve editor dari config env atau default
	editor := os.Getenv("EDITOR")
	if editor == "" {
		editor = "micro"
		for _, c := range []string{"micro", "nano", "vim", "vi"} {
			if _, err := exec.LookPath(c); err == nil {
				editor = c
				break
			}
		}
	}
	if editor == "" {
		editor = "cat"
	}

	rightPane := RightPaneID()

	if rightPane != "" && IsPaneIdle(rightPane) {
		// Send editor command to right pane
		_, err := runTmux("send-keys", "-t", rightPane,
			editor+" '"+filePath+"'", "C-m")
		if err != nil {
			return fmt.Errorf("send-keys: %w", err)
		}
		// Focus right pane
		_, err = runTmux("select-pane", "-t", rightPane)
		return err
	}

	// Right pane is busy or doesn't exist — open in new split
	_, err := runTmux("split-window", "-h", "-p", "50",
		editor+" '"+filePath+"'")
	if err != nil {
		return fmt.Errorf("split editor: %w", err)
	}

	return nil
}

// ── Helper: Run tmux command ──────────────────────────────────

// runTmux — execute tmux command dan return output (trimmed).
func runTmux(args ...string) (string, error) {
	cmd := exec.Command("tmux", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("tmux %s: %w", strings.Join(args, " "), err)
	}
	return strings.TrimSpace(string(out)), nil
}

// runExternal — execute external script/command dan return output.
func runExternal(path string, args ...string) (string, error) {
	cmd := exec.Command(path, args...)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("%s: %w", path, err)
	}
	return strings.TrimSpace(string(out)), nil
}

// findFeDir — cari directory fe project berdasarkan lokasi binary atau env.
// Fallback ke ~/civil/goblin-vault/tools-cli/src/fex/.
func findFeDir() string {
	// Check env
	if d := os.Getenv("FE_DIR"); d != "" {
		return d
	}

	// Try to find relative to executable
	exe, err := os.Executable()
	if err == nil {
		// Look for helpers/ directory near the binary
		dir := filepathDir(exe)
		// Try: <binary>/../helpers (binary in bin/)
		possible := filepathJoin(dir, "..", "helpers")
		if _, err := os.Stat(possible); err == nil {
			return filepathJoin(dir, "..")
		}
		// Try: <binary>/helpers (helpers next to binary)
		possible = filepathJoin(dir, "helpers")
		if _, err := os.Stat(possible); err == nil {
			return dir
		}
	}

	// Default fallback
	home, _ := os.UserHomeDir()
	return filepathJoin(home, "civil", "goblin-vault", "tools-cli", "src", "fex")
}

// filepathDir — dirname sederhana tanpa import filepath.
func filepathDir(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			if i == 0 {
				return "/"
			}
			return path[:i]
		}
	}
	return "."
}

// filepathJoin — join path segments tanpa import filepath.
func filepathJoin(parts ...string) string {
	result := parts[0]
	for _, p := range parts[1:] {
		if strings.HasSuffix(result, "/") {
			result += p
		} else {
			result += "/" + p
		}
	}
	return result
}
