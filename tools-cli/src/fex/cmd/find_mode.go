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

func runFindMode(sess *session.Session, dir string, ext string, cfg *config.Config, findMode bool) (string, error) {
	toast := ""
	lastFocusItem := ""

	// ── Large Directory Warning Guard ──
	// Jika user memindai direktori besar (seperti $HOME atau /) tanpa ekstensi khusus
	homeDir, _ := os.UserHomeDir()
	cleanDir := filepath.Clean(dir)
	if ext == "" && (cleanDir == homeDir || cleanDir == "/" || cleanDir == filepath.Dir(homeDir)) {
		if !largeDirWarningDialog(cleanDir) {
			// User batal scan ➔ switch balik ke tree mode dengan aman
			return "tree", nil
		}
	}

	for {
		// ── Get file list ──
		fileList := getFileList(dir, ext, cfg)
		if fileList == "" {
			return "", nil
		}

		// ── Dynamic Keybindings & Expected Keys ──
		kb := config.DefaultKeybindings()
		if sess.Config != nil {
			kb = sess.Config.Keybindings
		}

		// ── Fzf opts ──
		opts := fzf.DefaultFzfOpts()
		headerPrefix := toast
		if headerPrefix != "" {
			headerPrefix += " | "
		}
		opts.Header = fmt.Sprintf("%s%sEnter:open | %s:tree | %s:git-diff | %s:copy | %s:move | %s:paste | %s:help | %s:ren | %s:del | %s:search | %s:bm | %s:unbm | %s:clip",
			headerPrefix, GetClipboardBadge(), kb.SwitchMode, kb.Git, kb.MarkCopy, kb.MarkMove, kb.Paste, kb.Help, kb.Rename, kb.Delete, kb.Search, kb.Bookmark, kb.Unbookmark, kb.CopyPath)
		toast = "" // reset toast setelah dipasang ke header

		// Compile expected keys
		expectedKeys := []string{
			"?",
			kb.SwitchMode, kb.Search, kb.Git, kb.Help, kb.CopyPath,
			kb.MarkCopy, kb.MarkMove, kb.Paste, kb.Rename, kb.Delete,
		}
		if kb.Paste == "ctrl-v" {
			expectedKeys = append(expectedKeys, "alt-v")
		}
		// Dedup expected keys
		seenKeys := make(map[string]bool)
		var uniqueExpected []string
		for _, k := range expectedKeys {
			k = strings.TrimSpace(strings.ToLower(k))
			if k != "" && !seenKeys[k] {
				seenKeys[k] = true
				uniqueExpected = append(uniqueExpected, k)
			}
		}
		opts.Expected = strings.Join(uniqueExpected, ",")
		if findMode {
			opts.BorderLabel = fmt.Sprintf(" 🔍 %s%s ", filepath.Base(dir), extStr(ext))
		} else {
			opts.BorderLabel = fmt.Sprintf(" 📁 %s%s ", filepath.Base(dir), extStr(ext))
		}
		opts.Prompt = " 🔍 ❯ "
		opts.PreviewCmd = ui.DetectPreviewCmd()
		opts.WorkDir = dir
		opts.Cycle = true

		// ── In-fzf bindings ──
		opts.Bindings = buildFindModeBindings(dir, sess.GetBookmarksFile(), tmux.RightPaneID(), kb)

		// ── Maintain cursor focus on the active / pasted item ──
		if lastFocusItem != "" {
			opts.Sync = true
			lines := strings.Split(fileList, "\n")
			for i, line := range lines {
				lineClean := strings.TrimSpace(line)
				if lineClean == lastFocusItem ||
					strings.HasSuffix(lineClean, "/"+lastFocusItem) ||
					lineClean == filepath.Base(lastFocusItem) ||
					strings.TrimPrefix(lineClean, "./") == strings.TrimPrefix(lastFocusItem, "./") {
					pos := i + 1
					opts.Bindings = append(opts.Bindings, fmt.Sprintf("load:pos(%d),start:pos(%d)", pos, pos))
					break
				}
			}
			lastFocusItem = ""
		}

		result, err := fzf.Run(fileList, opts)
		if err != nil {
			return "", fmt.Errorf("fzf: %w", err)
		}

		// ── Route by pressed key ──
		pressed := strings.ToLower(result.ExpectedKey)
		switch {
		case pressed == strings.ToLower(kb.SwitchMode):
			// Switch mode: Flat Find ➔ Tree Mode
			return "tree", nil

		case pressed == strings.ToLower(kb.Search):
			// Switch mode: Flat Find ➔ Interactive Search Mode
			return "search", nil

		case pressed == strings.ToLower(kb.Git):
			// Open interactive per-file Git History & Diff Viewer Split
			if len(result.Selected) == 0 {
				continue
			}
			lastFocusItem = result.Selected[0]
			target := makeAbs(dir, result.Selected[0])
			if errToast := fileGitHistoryDialog(dir, target); errToast != "" {
				toast = errToast
			}
			continue

		case pressed == strings.ToLower(kb.CopyPath):
			// Copy relative/abs path to system clipboard (OSC 52 + tools)
			if len(result.Selected) == 0 {
				continue
			}
			lastFocusItem = result.Selected[0]
			target := makeAbs(dir, result.Selected[0])
			if err := CopyToSystemClipboard(target); err != nil {
				toast = "⚠ [Copy path failed]"
			} else {
				toast = fmt.Sprintf("📋 [Path copied: %s]", filepath.Base(target))
			}
			continue

		case pressed == strings.ToLower(kb.Help) || pressed == "?":
			// Open interactive keybindings help popup
			if len(result.Selected) > 0 {
				lastFocusItem = result.Selected[0]
			}
			helpDialog(sess.Config)
			continue

		case pressed == strings.ToLower(kb.MarkCopy):
			// Mark selected file/dir for copy
			if len(result.Selected) == 0 {
				continue
			}
			lastFocusItem = result.Selected[0]
			target := makeAbs(dir, result.Selected[0])
			if err := MarkClipboard(target, ClipActionCopy); err != nil {
				toast = "⚠ [Copy failed]"
			} else {
				toast = fmt.Sprintf("📋 [Marked Copy: %s]", filepath.Base(target))
			}
			continue

		case pressed == strings.ToLower(kb.MarkMove):
			// Mark selected file/dir for move
			if len(result.Selected) == 0 {
				continue
			}
			lastFocusItem = result.Selected[0]
			target := makeAbs(dir, result.Selected[0])
			if err := MarkClipboard(target, ClipActionMove); err != nil {
				toast = "⚠ [Move failed]"
			} else {
				toast = fmt.Sprintf("📦 [Marked Move: %s]", filepath.Base(target))
			}
			continue

		case pressed == strings.ToLower(kb.Paste) || pressed == "alt-v":
			// Execute paste to current directory
			clipItem, _ := ReadClipboard()
			if clipItem != nil {
				lastFocusItem = clipItem.Filename
			}
			msg, err := ExecutePaste(dir)
			if err != nil {
				toast = fmt.Sprintf("⚠ [%s]", err.Error())
			} else {
				toast = fmt.Sprintf("✅ [%s]", msg)
			}
			continue

		case pressed == strings.ToLower(kb.Rename):
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
				toast = fmt.Sprintf("⚠ [Rename: %v]", err)
				continue
			}
			lastFocusItem = newName
			continue

		case pressed == strings.ToLower(kb.Delete):
			// Delete — exit fzf → Go dialog → loop
			if len(result.Selected) == 0 {
				continue
			}
			target := makeAbs(dir, result.Selected[0])
			if confirmDeleteDialog(target) {
				if err := executeDelete(target); err != nil {
					toast = fmt.Sprintf("⚠ [Delete: %v]", err)
				} else {
					toast = fmt.Sprintf("🗑️ [Deleted: %s]", filepath.Base(target))
				}
			}
			continue

		default:
			// Normal Enter — open file
			if len(result.Selected) == 0 {
				return "", nil // cancelled (ESC/Ctrl-C)
			}
			selected := makeAbs(dir, result.Selected[0])

			// Open file (spawn editor di pane yang sama)
			editor := ui.DetectEditor()
			editorCmd := exec.Command(editor, selected)
			editorCmd.Stdin = os.Stdin
			editorCmd.Stdout = os.Stdout
			editorCmd.Stderr = os.Stderr
			if err := editorCmd.Run(); err != nil {
				fmt.Fprintf(os.Stderr, "editor: %v\n", err)
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
