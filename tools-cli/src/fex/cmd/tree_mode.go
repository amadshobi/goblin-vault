package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/tmux"
	"civil/goblin-vault/tools-cli/src/fex/internal/tree"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

// ── Mode: Tree Navigation ─────────────────────────────────────
//
// Flow:
//   1. Generate tree dari current directory
//   2. Pipe ke fzf via SelectFromTree
//   3. File → open
//   4. Folder → recurse dengan folder sebagai root baru
//   5. ".." entry → go up
//   6. Tab → switch ke Flat Find mode

func runTreeMode(sess *session.Session, currentDir string) (string, error) {
	showHidden := true // tampilin dotfiles biar berguna
	homeDir, _ := os.UserHomeDir()
	if homeDir == "" {
		homeDir = "/home/shobixlinuxdev"
	}
	toast := ""
	lastFocusName := ""

	for {
		// ── Navigasi ke folder file terakhir dibuka ──
		if lastPath := sess.GetLastOpened(); lastPath != "" && currentDir == sess.GetCwd() {
			parentDir := filepath.Dir(lastPath)
			if info, err := os.Stat(parentDir); err == nil && info.IsDir() {
				currentDir = parentDir
				sess.SetTreeCwd(currentDir)
			}
		}

		// ── Baca isi directory ──
		entries, err := tree.ListDirContents(currentDir, showHidden)
		if err != nil {
			return "", fmt.Errorf("list dir: %w", err)
		}

		// ── Build display lines ──
		type dispEntry struct {
			line  string
			path  string
			isDir bool
			name  string
		}
		var displayLines []string
		var entryLookup []dispEntry

		// "📁 .." entry kalo bukan root
		if currentDir != "/" {
			displayLines = append(displayLines, "📁 ..")
			entryLookup = append(entryLookup, dispEntry{
				line: "📁 ..", path: filepath.Dir(currentDir),
				isDir: true, name: "..",
			})
		}

		for _, e := range entries {
			line := tree.FormatTreeLine(e)
			displayLines = append(displayLines, line)
			entryLookup = append(entryLookup, dispEntry{
				line: line, path: e.Path,
				isDir: e.IsDir, name: e.Name,
			})
		}

		if len(displayLines) == 0 {
			fmt.Fprintf(os.Stderr, "🌳 Directory is empty: %s\n", currentDir)
			return "", nil
		}

		// ── State: temp file buat currentDir (preview shell bisa baca) ──
		tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("fe-tree-%d", os.Getpid()))
		if err := os.WriteFile(tmpFile, []byte(currentDir), 0644); err != nil {
			return "", fmt.Errorf("write state: %w", err)
		}

		// ── Fzf opts ──
		opts := fzf.DefaultFzfOpts()
		headerPrefix := toast
		if headerPrefix != "" {
			headerPrefix += " | "
		}
		opts.Header = headerPrefix + GetClipboardBadge() + "Enter:open/in | Tab:find | Alt-c:copy | Alt-m:move | Ctrl-v:paste | Ctrl-h:help | Ctrl-n:file | Ctrl-k:folder | Ctrl-r:ren | Ctrl-d:del | Ctrl-g:git | Ctrl-f:search | Ctrl-y:clip"
		toast = "" // reset toast setelah dipakai
		opts.Expected = "ctrl-r,ctrl-d,ctrl-n,ctrl-k,esc,alt-c,alt-m,ctrl-v,alt-v,ctrl-h,?,tab,ctrl-g,ctrl-y,ctrl-f"
		opts.BorderLabel = fmt.Sprintf(" 🌳 %s ", filepath.Base(currentDir))
		opts.Prompt = " 🌳 ❯ "

		// Dynamic preview command (sama kayak di SelectFromTree)
		filePreviewCmd := strings.ReplaceAll(
			ui.DetectPreviewCmd(), "{}", `"$dir/$item"`)
		opts.PreviewCmd = fmt.Sprintf(
			`item="$(echo {+} | sed 's/^[^ ]* //')"; dir="$(cat %s)"; `+
				`if [ "$item" = ".." ]; then `+
				`eza --tree --level=2 --icons=always --color=always "$(dirname "$dir")" 2>/dev/null || `+
				`tree -L 2 "$(dirname "$dir")" 2>/dev/null || `+
				`ls -1p "$(dirname "$dir")" 2>/dev/null; `+
				`elif [ -d "$dir/$item" ]; then `+
				`eza --tree --level=2 --icons=always --color=always "$dir/$item" 2>/dev/null || `+
				`tree -L 2 "$dir/$item" 2>/dev/null || `+
				`ls -1p "$dir/$item" 2>/dev/null; `+
				`elif [ -f "$dir/$item" ]; then `+
				filePreviewCmd+`; `+
				`fi`,
			tmpFile,
		)
		opts.PreviewWindow = "right:80%:wrap,border-left,<80(up:65%:wrap)"
		opts.WorkDir = currentDir
		opts.Cycle = true

		// ── In-fzf bindings ──
		opts.Bindings = buildTreeModeBindings(currentDir, tmux.RightPaneID())

		// ── Maintain cursor focus on the active / pasted item ──
		if lastFocusName != "" {
			opts.Sync = true
			for i, entry := range entryLookup {
				if entry.name == lastFocusName ||
					entry.path == lastFocusName ||
					strings.HasSuffix(entry.line, " "+lastFocusName) ||
					strings.HasSuffix(entry.line, "/"+lastFocusName) {
					pos := i + 1
					opts.Bindings = append(opts.Bindings, fmt.Sprintf("load:pos(%d),start:pos(%d)", pos, pos))
					break
				}
			}
			lastFocusName = ""
		}

		result, err := fzf.Run(strings.Join(displayLines, "\n"), opts)
		os.Remove(tmpFile) // cleanup state file
		if err != nil {
			return "", fmt.Errorf("fzf tree: %w", err)
		}

		if result.ExpectedKey == "" && len(result.Selected) == 0 {
			return "", nil // cancelled
		}

		// ── Helper: match selected line ke entry ──
		findEntry := func(line string) *dispEntry {
			for i := range entryLookup {
				if entryLookup[i].line == line {
					return &entryLookup[i]
				}
			}
			// Fallback: match by name (handle emoji encoding mismatch) — exact match di akhir line
			for i := range entryLookup {
				if entryLookup[i].name != "" && (line == entryLookup[i].line || strings.HasSuffix(line, " "+entryLookup[i].name) || strings.HasSuffix(line, "/"+entryLookup[i].name)) {
					return &entryLookup[i]
				}
			}
			return nil
		}

		// ── Route by pressed key ──
		switch result.ExpectedKey {
		case "tab":
			// Switch mode: Tree ➔ Flat Find Mode
			sess.SetCwd(currentDir)
			return "find", nil

		case "ctrl-f":
			// Switch mode: Tree ➔ Interactive Search Mode
			sess.SetCwd(currentDir)
			return "search", nil

		case "ctrl-g":
			// Open in-TUI Git Status & Commit Viewer Popup
			if len(result.Selected) > 0 {
				if entry := findEntry(result.Selected[0]); entry != nil {
					lastFocusName = entry.name
				}
			}
			gitStatusDialog(currentDir)
			continue

		case "ctrl-y":
			// Copy relative/abs path to system clipboard (OSC 52 + tools)
			if len(result.Selected) == 0 {
				continue
			}
			entry := findEntry(result.Selected[0])
			if entry == nil || entry.path == "" {
				continue
			}
			lastFocusName = entry.name
			if err := CopyToSystemClipboard(entry.path); err != nil {
				toast = "⚠ [Copy path failed]"
			} else {
				toast = fmt.Sprintf("📋 [Path copied: %s]", entry.name)
			}
			continue

		case "ctrl-h", "?":
			// Open interactive keybindings help popup
			if len(result.Selected) > 0 {
				if entry := findEntry(result.Selected[0]); entry != nil {
					lastFocusName = entry.name
				}
			}
			helpDialog()
			continue

		case "alt-c":
			// Mark entry for copy
			if len(result.Selected) == 0 {
				continue
			}
			entry := findEntry(result.Selected[0])
			if entry == nil || entry.path == "" {
				continue
			}
			lastFocusName = entry.name
			if err := MarkClipboard(entry.path, ClipActionCopy); err != nil {
				toast = "⚠ [Copy failed]"
			} else {
				toast = fmt.Sprintf("📋 [Marked Copy: %s]", entry.name)
			}
			continue

		case "alt-m":
			// Mark entry for move
			if len(result.Selected) == 0 {
				continue
			}
			entry := findEntry(result.Selected[0])
			if entry == nil || entry.path == "" {
				continue
			}
			lastFocusName = entry.name
			if err := MarkClipboard(entry.path, ClipActionMove); err != nil {
				toast = "⚠ [Move failed]"
			} else {
				toast = fmt.Sprintf("📦 [Marked Move: %s]", entry.name)
			}
			continue

		case "ctrl-v", "alt-v":
			// Execute paste to currentDir
			clipItem, _ := ReadClipboard()
			if clipItem != nil {
				lastFocusName = clipItem.Filename
			}
			msg, err := ExecutePaste(currentDir)
			if err != nil {
				toast = fmt.Sprintf("⚠ [%s]", err.Error())
			} else {
				toast = fmt.Sprintf("✅ [%s]", msg)
			}
			continue

		case "ctrl-r":
			// Rename
			if len(result.Selected) == 0 {
				continue
			}
			entry := findEntry(result.Selected[0])
			if entry == nil {
				continue
			}
			newName := renameDialog(entry.path)
			if newName == "" {
				continue
			}
			newPath := filepath.Join(filepath.Dir(entry.path), newName)
			if err := os.Rename(entry.path, newPath); err != nil {
				toast = fmt.Sprintf("⚠ [Rename: %v]", err)
				continue
			}
			lastFocusName = newName

		case "ctrl-d":
			// Delete
			if len(result.Selected) == 0 {
				continue
			}
			entry := findEntry(result.Selected[0])
			if entry == nil {
				continue
			}
			if confirmDeleteDialog(entry.path) {
				if err := executeDelete(entry.path); err != nil {
					toast = fmt.Sprintf("⚠ [Delete: %v]", err)
				} else {
					toast = fmt.Sprintf("🗑️ [Deleted: %s]", entry.name)
				}
			}

		case "ctrl-n":
			// New file
			name := newFileDialog(currentDir)
			if name == "" {
				continue
			}
			newPath := filepath.Join(currentDir, name)
			if err := os.WriteFile(newPath, []byte(""), 0644); err != nil {
				toast = fmt.Sprintf("⚠ [Create file: %v]", err)
				continue
			}
			lastFocusName = name
			editor := ui.DetectEditor()
			editorCmd := exec.Command(editor, newPath)
			editorCmd.Stdin = os.Stdin
			editorCmd.Stdout = os.Stdout
			editorCmd.Stderr = os.Stderr
			if err := editorCmd.Run(); err != nil {
				fmt.Fprintf(os.Stderr, "editor: %v\n", err)
			}
			// Don't set lastOpened — keep search input clean on re-render

		case "ctrl-k":
			// New folder
			name := newFolderDialog(currentDir)
			if name == "" {
				continue
			}
			newPath := filepath.Join(currentDir, name)
			if err := os.MkdirAll(newPath, 0755); err != nil {
				toast = fmt.Sprintf("⚠ [Create folder: %v]", err)
				continue
			}
			lastFocusName = name
			// Don't set lastOpened — keep search input clean on re-render

		case "esc":
			// Esc: naik satu folder
			parent := filepath.Dir(currentDir)
			// Boundary: don't go above home dir — exit instead
			if currentDir == homeDir || !strings.HasPrefix(parent+"/", homeDir+"/") {
				return "", nil
			}
			currentDir = parent
			sess.SetTreeCwd(currentDir)
			continue

		default:
			// Normal Enter (or other key) — open or navigate
			if len(result.Selected) == 0 {
				return "", nil
			}
			entry := findEntry(result.Selected[0])
			if entry == nil {
				continue
			}

			if entry.isDir {
				// Navigasi ke folder
				currentDir = entry.path
				sess.SetTreeCwd(currentDir)
				continue
			}

			// Open file (spawn editor di pane yang sama)
			editor := ui.DetectEditor()
			editorCmd := exec.Command(editor, entry.path)
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
