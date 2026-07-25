package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/tmux"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

// ── Mode: Find/Browse ─────────────────────────────────────────
//
// Flow:
//   1. List files in dir (via os.ReadDir atau fd)
//   2. Pipe ke fzf via PickFile
//   3. User selects → open file

func runFindMode(sess *session.Session, dir string, ext string, cfg *config.Config, findMode bool) error {
	// Determine header based on mode
	header := "Enter:open | Ctrl-r:rename | Ctrl-d:delete | Ctrl-g:git | Ctrl-f:search | Ctrl-b:bookmark | Ctrl-x:unbookmark | Ctrl-y:copy | Ctrl-o:cd-here | Ctrl-p:preview | Ctrl-s:fullscreen"

	for {
		// ── Get file list ──
		fileList := getFileList(dir, ext, cfg)
		if fileList == "" {
			return nil
		}

		// ── Fzf opts ──
		opts := fzf.DefaultFzfOpts()
		opts.Header = header
		opts.Expected = "ctrl-r,ctrl-d"
		if findMode {
			opts.BorderLabel = fmt.Sprintf(" 🔍 %s%s ", filepath.Base(dir), extStr(ext))
		} else {
			opts.BorderLabel = fmt.Sprintf(" 📁 %s%s ", filepath.Base(dir), extStr(ext))
		}
		opts.Prompt = " 🔍 ❯ "
		opts.PreviewCmd = ui.DetectPreviewCmd()
		opts.WorkDir = dir

		// ── In-fzf bindings ──
		opts.Bindings = buildFindModeBindings(dir, sess.GetBookmarksFile(), tmux.RightPaneID())

		// ── Also add Tab multi-select info ──
		// (no binding needed, fzf has built-in Tab multi with --multi not set here)

		result, err := fzf.Run(fileList, opts)
		if err != nil {
			return fmt.Errorf("fzf: %w", err)
		}

		// ── Route by pressed key ──
		switch result.ExpectedKey {
		case "ctrl-r":
			// Rename — exit fzf → Go dialog → loop
			if len(result.Selected) == 0 {
				continue
			}
			target := makeAbs(dir, result.Selected[0])
			newName := renameDialog(target)
			if newName == "" {
				continue
			}
			newPath := filepath.Join(filepath.Dir(target), newName)
			if err := os.Rename(target, newPath); err != nil {
				fmt.Fprintf(os.Stderr, "\n⚠ rename error: %v\n", err)
				fmt.Fprintf(os.Stderr, "  source: %s\n", target)
				fmt.Fprintf(os.Stderr, "  target: %s\n", newPath)
				continue
			}

		case "ctrl-d":
			// Delete — exit fzf → Go dialog → loop
			if len(result.Selected) == 0 {
				continue
			}
			target := makeAbs(dir, result.Selected[0])
			if confirmDeleteDialog(target) {
				if err := executeDelete(target); err != nil {
					fmt.Fprintf(os.Stderr, "delete: %v\n", err)
				}
			}

		default:
			// Normal Enter — open file
			if len(result.Selected) == 0 {
				return nil // cancelled (ESC/Ctrl-C)
			}
			selected := makeAbs(dir, result.Selected[0])

			// Open file (tmux-aware)
			if tmux.InTmux() {
				if err := tmux.OpenFileInPane(selected); err != nil {
					fmt.Fprintf(os.Stderr, "open: %v\n", err)
				}
			} else {
				editor := ui.DetectEditor()
				editorCmd := exec.Command(editor, selected)
				editorCmd.Stdin = os.Stdin
				editorCmd.Stdout = os.Stdout
				editorCmd.Stderr = os.Stderr
				if err := editorCmd.Run(); err != nil {
					fmt.Fprintf(os.Stderr, "editor: %v\n", err)
				}
			}
			// Don't set lastOpened — keep search input clean on re-render
		}
	}
}

// extStr — return formatted extension string (e.g. " (.go)" or "").
func extStr(ext string) string {
	if ext != "" {
		return " (" + ext + ")"
	}
	return ""
}

// pickFileWithFd — use fd for faster file listing + fzf.
func pickFileWithFd(dir string, ext string, findMode bool, initialQuery string) (string, error) {
	if _, err := exec.LookPath("fd"); err != nil {
		return "", fmt.Errorf("fd not found")
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

	// Run fd
	fdCmd := exec.Command("fd", args...)
	fdOut, err := fdCmd.Output()
	if err != nil {
		return "", fmt.Errorf("fd exec: %w", err)
	}

	if len(fdOut) == 0 {
		return "", nil
	}

	lines := strings.TrimSpace(string(fdOut))

	opts := fzf.DefaultFzfOpts()
	opts.Query = initialQuery
	opts.Header = "Enter:open  Tab:multi-select  Ctrl-p:preview"
	if findMode {
		opts.BorderLabel = fmt.Sprintf(" 🔍 %s ", filepath.Base(dir))
	} else {
		opts.BorderLabel = fmt.Sprintf(" 📁 %s ", filepath.Base(dir))
	}
	opts.Prompt = " 🔍 ❯ "
	opts.PreviewCmd = ui.DetectPreviewCmd()
	opts.WorkDir = dir

	result, err := fzf.Run(lines, opts)
	if err != nil {
		return "", err
	}

	if len(result.Selected) == 0 {
		return "", nil
	}

	return result.Selected[0], nil
}
