// == CORE MISSION ==============================================
// cmd/root.go — Cobra root command + dispatcher
//
// Mirip parsing arg di bin/fe bash entrypoint.
// Hubungin semua internal package: config → session → tree/fzf/tmux.
// ==============================================================
package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/tmux"
	"civil/goblin-vault/tools-cli/src/fex/internal/tree"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"

	"github.com/spf13/cobra"
)

// Build-time vars — diisi pas build (ldflags)
var (
	Version = "dev"
	Date    = "unknown"
)

// flagVars — holds parsed CLI flags
var (
	flagSearchMode   bool
	flagFindMode     bool
	flagTreeMode     bool
	flagBookmarkMode bool
	flagTargetDir    string
	flagExtFilter    string
)

// rootCmd — representasi dari flow bash: parsing arg, dispatcher, cleanup
var rootCmd = &cobra.Command{
	Use:   "fex [path] [extension]",
	Short: "fex — File Explorer with fzf + tmux split (Hybrid Go + Bash)",
	Long: `fex — File Explorer dengan fzf dan tmux split.
Hybrid architecture: Go manages config, state, routing, error handling.
Bash helpers handle external tool interaction (fzf, fd, rg, tmux, bat).

Usage:
  fex                    Browse files from current directory
  fex <path>             Browse files from <path>
  fex <extension>        Filter by extension (e.g. fex .js)
  fex <path> <extension> Both
  fex --search <query>   Search file content
  fex --tree             Tree navigation (folder explorer)
  fex --bookmarks        Browse bookmarked files
  fex -h, --help         Show help`,
	SilenceUsage:  true,
	SilenceErrors: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		// ── 1. Load config ──
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config load: %w", err)
		}

		// ── 2. Parse positional args ──
		targetDir := "."
		extFilter := ""
		for _, arg := range args {
			if info, statErr := os.Stat(arg); statErr == nil && info.IsDir() {
				targetDir = arg
			} else {
				extFilter = arg
			}
		}
		if flagTargetDir != "" {
			targetDir = flagTargetDir
		}
		if flagExtFilter != "" {
			extFilter = flagExtFilter
		}

		// ── 3. Resolve absolute path ──
		absDir, err := filepath.Abs(targetDir)
		if err != nil {
			return fmt.Errorf("resolve path %s: %w", targetDir, err)
		}

		// ── 4. Init session ──
		sess := session.New(cfg, absDir)
		if err := sess.SetCwd(absDir); err != nil {
			return fmt.Errorf("session init: %w", err)
		}

		// ── 5. Setup tmux split (if in tmux) ──
		if tmux.InTmux() {
			if err := tmux.SplitOnStartup(cfg); err != nil {
				// Non-fatal: user might not have tmux permissions
				fmt.Fprintf(os.Stderr, "tmux setup warning: %v\n", err)
			}
		}

		// ── 6. Dispatcher ──
		switch {
		case flagTreeMode:
			return runTreeMode(sess, absDir)

		case flagBookmarkMode:
			return runBookmarksMode(sess)

		case flagSearchMode:
			return runSearchMode(sess, "")

		case flagFindMode:
			return runFindMode(sess, absDir, extFilter, cfg, true)

		default:
			return runFindMode(sess, absDir, extFilter, cfg, false)
		}
	},
}

// ── Mode: Tree Navigation ─────────────────────────────────────
//
// Flow:
//   1. Generate tree dari current directory
//   2. Pipe ke fzf via SelectFromTree
//   3. File → open
//   4. Folder → recurse dengan folder sebagai root baru
//   5. ".." entry → go up

func runTreeMode(sess *session.Session, currentDir string) error {
	showHidden := true // tampilin dotfiles biar berguna

	for {
		// ── Navigasi ke folder file terakhir dibuka ──
		if lastPath := sess.GetLastOpened(); lastPath != "" && currentDir == sess.GetCwd() {
			parentDir := filepath.Dir(lastPath)
			if info, err := os.Stat(parentDir); err == nil && info.IsDir() {
				currentDir = parentDir
				sess.SetTreeCwd(currentDir)
			}
		}

		lastQuery := ""
		if lastPath := sess.GetLastOpened(); lastPath != "" {
			lastQuery = filepath.Base(lastPath)
		}

		// ── Baca isi directory ──
		entries, err := tree.ListDirContents(currentDir, showHidden)
		if err != nil {
			return fmt.Errorf("list dir: %w", err)
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
			return nil
		}

		// ── State: temp file buat currentDir (preview shell bisa baca) ──
		tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("fe-tree-%d", os.Getpid()))
		if err := os.WriteFile(tmpFile, []byte(currentDir), 0644); err != nil {
			return fmt.Errorf("write state: %w", err)
		}

		// ── Fzf opts ──
		opts := fzf.DefaultFzfOpts()
		opts.Query = lastQuery
		opts.Header = "Enter:open/masuk | Ctrl-h:naik | Ctrl-n:file-baru | Ctrl-k:folder-baru | Ctrl-r:rename | Ctrl-d:del | Ctrl-g:git | Ctrl-p:preview | Ctrl-s:fullscreen"
		opts.Expected = "ctrl-r,ctrl-d,ctrl-n,ctrl-k,ctrl-h"
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
				filePreviewCmd + `; `+
				`fi`,
			tmpFile,
		)
		opts.PreviewWindow = "right:80%:wrap,border-left,<80(up:65%:wrap)"
		opts.WorkDir = currentDir

		// ── In-fzf bindings ──
		opts.Bindings = buildTreeModeBindings(currentDir, tmux.RightPaneID())

		result, err := fzf.Run(strings.Join(displayLines, "\n"), opts)
		os.Remove(tmpFile) // cleanup state file
		if err != nil {
			return fmt.Errorf("fzf tree: %w", err)
		}

		if result.ExpectedKey == "" && len(result.Selected) == 0 {
			return nil // cancelled
		}

		// ── Helper: match selected line ke entry ──
		findEntry := func(line string) *dispEntry {
			for i := range entryLookup {
				if entryLookup[i].line == line {
					return &entryLookup[i]
				}
			}
			// Fallback: match by name (handle emoji encoding mismatch)
			for i := range entryLookup {
				if entryLookup[i].name != "" && strings.Contains(line, entryLookup[i].name) {
					return &entryLookup[i]
				}
			}
			return nil
		}

		// ── Route by pressed key ──
		switch result.ExpectedKey {
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
				fmt.Fprintf(os.Stderr, "rename: %v\n", err)
				continue
			}
			sess.SetLastOpened(newPath)

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
					fmt.Fprintf(os.Stderr, "delete: %v\n", err)
				}
			}

		case "ctrl-n":
			// New file
			name := newFileDialog(currentDir)
			if name == "" {
				continue
			}
			newPath := filepath.Join(currentDir, name)
			if err := os.WriteFile(newPath, []byte{}, 0644); err != nil {
				fmt.Fprintf(os.Stderr, "create file: %v\n", err)
				continue
			}
			sess.SetLastOpened(newPath)

		case "ctrl-k":
			// New folder
			name := newFolderDialog(currentDir)
			if name == "" {
				continue
			}
			newPath := filepath.Join(currentDir, name)
			if err := os.MkdirAll(newPath, 0755); err != nil {
				fmt.Fprintf(os.Stderr, "create folder: %v\n", err)
				continue
			}
			sess.SetLastOpened(newPath)

		case "ctrl-h":
			// Go up one directory (mirip bash: ctrl-h reload parent)
			parent := filepath.Dir(currentDir)
			if parent != currentDir {
				currentDir = parent
				sess.SetTreeCwd(currentDir)
			}
			continue

		default:
			// Normal Enter (or other key) — open or navigate
			if len(result.Selected) == 0 {
				return nil
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

			// Open file
			if tmux.InTmux() {
				if err := tmux.OpenFileInPane(entry.path); err != nil {
					fmt.Fprintf(os.Stderr, "open: %v\n", err)
				}
			} else {
				editor := ui.DetectEditor()
				editorCmd := exec.Command(editor, entry.path)
				editorCmd.Stdin = os.Stdin
				editorCmd.Stdout = os.Stdout
				editorCmd.Stderr = os.Stderr
				if err := editorCmd.Run(); err != nil {
					fmt.Fprintf(os.Stderr, "editor: %v\n", err)
				}
			}
			sess.SetLastOpened(entry.path)
		}
	}
}

// ── Mode: Bookmarks ───────────────────────────────────────────
//
// Flow:
//   1. Load bookmarks from file
//   2. Pipe to fzf
//   3. User selects → open file

func runBookmarksMode(sess *session.Session) error {
	for {
		bookmarks, err := sess.LoadBookmarks()
		if err != nil {
			return fmt.Errorf("load bookmarks: %w", err)
		}

		if len(bookmarks) == 0 {
			fmt.Fprintln(os.Stderr, "📭 No bookmarks yet. Use Ctrl-b in fex to bookmark files.")
			return nil
		}

		opts := fzf.DefaultFzfOpts()
		opts.Header = "Enter:open | Ctrl-x:unbookmark | Ctrl-y:copy | Ctrl-d:delete-file | Ctrl-g:git | Ctrl-p:preview | Ctrl-s:fullscreen"
		opts.BorderLabel = " Bookmarks "
		opts.Prompt = " 🔍 ❯ "
		opts.PreviewCmd = ui.DetectPreviewCmd()
		if lastPath := sess.GetLastOpened(); lastPath != "" {
			opts.Query = filepath.Base(lastPath)
		}

		// ── In-fzf bindings ──
		dir := sess.GetCwd()
		opts.Bindings = buildFindModeBindings(dir, sess.GetBookmarksFile(), tmux.RightPaneID())

		result, err := fzf.Run(strings.Join(bookmarks, "\n"), opts)
		if err != nil {
			return fmt.Errorf("fzf bookmarks: %w", err)
		}

		if len(result.Selected) == 0 {
			return nil // cancelled
		}

		selected := result.Selected[0]

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
		sess.SetLastOpened(selected)
		// Loop: stay di bookmarks mode
	}
}

// ── Mode: Search ──────────────────────────────────────────────
//
// Flow:
//   1. Run `rg --line-number <query> <dir>`
//   2. Pipe hasil ke fzf
//   3. User selects → open file at line

func runSearchMode(sess *session.Session, initialQuery string) error {
	dir := sess.GetCwd()
	query := initialQuery

	for {
		// Interactive prompt kalo query kosong
		if query == "" {
			fmt.Fprint(os.Stderr, "🔍 Search: ")
			reader := bufio.NewReader(os.Stdin)
			q, _ := reader.ReadString('\n')
			query = strings.TrimSpace(q)
			if query == "" {
				return nil // user cancelled
			}
		}

		// Check if ripgrep is available
		if _, err := exec.LookPath("rg"); err != nil {
			return fmt.Errorf("ripgrep (rg) not found in PATH. Install it to use search mode.\n  brew install rg  |  apt install ripgrep  |  cargo install ripgrep")
		}

		// Run rg
		rgCmd := exec.Command("rg", "--line-number", "--no-heading", "--color", "never",
			"--smart-case", "--sort", "path", query, dir)
		rgOut, err := rgCmd.Output()
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				if exitErr.ExitCode() == 1 {
					fmt.Fprintf(os.Stderr, "🔍 No matches found for: %s\n", query)
					query = ""
					continue
				}
			}
			return fmt.Errorf("rg exec: %w", err)
		}

		if len(rgOut) == 0 {
			fmt.Fprintf(os.Stderr, "🔍 No matches found for: %s\n", query)
			query = ""
			continue
		}

		rgLines := strings.TrimSpace(string(rgOut))

		opts := fzf.DefaultFzfOpts()
		opts.Header = "Enter:open | Ctrl-y:copy | Ctrl-b:bookmark | Ctrl-x:unbookmark | Ctrl-d:delete-file | Ctrl-g:git | Ctrl-p:preview | Ctrl-s:fullscreen"
		opts.BorderLabel = fmt.Sprintf(" Search: %s ", query)
		opts.Prompt = " 🔍 ❯ "
		opts.Delimiter = ":"
		opts.PreviewCmd = `bat --style=numbers --color=always -H {2} {1} 2>/dev/null || cat -n {1} 2>/dev/null || echo '{1}:{2}'`
		if lastPath := sess.GetLastOpened(); lastPath != "" {
			opts.Query = filepath.Base(lastPath)
		}
		// ── In-fzf bindings ──
		opts.Bindings = buildFindModeBindings(dir, sess.GetBookmarksFile(), tmux.RightPaneID())

		result, err := fzf.Run(rgLines, opts)
		if err != nil {
			return fmt.Errorf("fzf search: %w", err)
		}

		if len(result.Selected) == 0 {
			query = ""
			continue // cancelled → prompt baru
		}

		selected := result.Selected[0]
		parts := strings.SplitN(selected, ":", 3)
		if len(parts) < 2 {
			fmt.Println(selected)
			query = ""
			continue
		}

		filePath := parts[0]
		lineNum := parts[1]

		if !filepath.IsAbs(filePath) {
			filePath = filepath.Join(dir, filePath)
		}

		// Open file at line
		if tmux.InTmux() {
			editor := ui.DetectEditor()
			openCmd := fmt.Sprintf("%s '+%s' '%s'", editor, lineNum, filePath)
			if err := tmux.SplitWindow("h", openCmd); err != nil {
				fmt.Printf("%s:%s\n", filePath, lineNum)
			}
		} else {
			editor := ui.DetectEditor()
			editorCmd := exec.Command(editor, "+"+lineNum, filePath)
			editorCmd.Stdin = os.Stdin
			editorCmd.Stdout = os.Stdout
			editorCmd.Stderr = os.Stderr
			if err := editorCmd.Run(); err != nil {
				fmt.Fprintf(os.Stderr, "editor: %v\n", err)
			}
		}
		sess.SetLastOpened(filePath)

		query = "" // reset → prompt baru di loop berikutnya
	}
}

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
		lastQuery := ""
		if lastPath := sess.GetLastOpened(); lastPath != "" {
			lastQuery = filepath.Base(lastPath)
		}

		// ── Get file list ──
		fileList := getFileList(dir, ext, cfg)
		if fileList == "" {
			return nil
		}

		// ── Fzf opts ──
		opts := fzf.DefaultFzfOpts()
		opts.Query = lastQuery
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
				fmt.Fprintf(os.Stderr, "rename: %v\n", err)
				continue
			}
			sess.SetLastOpened(newPath)

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
			sess.SetLastOpened(selected)
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

// ── Helpers: FZF Bindings Builder ──────────────────────────────

// buildFindModeBindings — return fzf --bind entries untuk find mode.
// Mirip bindings di ui.sh lines 37-54.
func buildFindModeBindings(dir string, bookmarksFile string, rightPaneID string) []string {
	bookmarksQuoted := "'" + strings.ReplaceAll(bookmarksFile, "'", "'\\''") + "'"
	dirQuoted := "'" + strings.ReplaceAll(dir, "'", "'\\''") + "'"

	bindings := []string{
		// Preview
		"ctrl-p:toggle-preview",
		"ctrl-s:change-preview-window(right:99%|right:60%:wrap,border-left,<80(up:50%:wrap))",

		// Git status/log
		fmt.Sprintf("ctrl-g:execute(git -C %s status -s 2>/dev/null; echo '---'; git -C %s log --oneline -10 2>/dev/null || true)", dirQuoted, dirQuoted),

		// Copy to clipboard (try multiple tools)
		"ctrl-y:execute-silent(echo -n {1} | termux-clipboard-set 2>/dev/null || echo -n {1} | xclip -sel clip 2>/dev/null || pbcopy 2>/dev/null || true)",

		// Bookmark / Unbookmark
		fmt.Sprintf("ctrl-b:execute(echo '{1}' >> %s && echo '✅ Bookmarked: {1}')", bookmarksQuoted),
		fmt.Sprintf("ctrl-x:execute(sed -i '|{1}|d' %s 2>/dev/null && echo '🗑️ Unbookmarked: {1}')", bookmarksQuoted),

		// Open location in tmux right pane (cd + ls)
		"ctrl-o:execute-silent(tmux send-keys -t '" + rightPaneID + "' 'cd \"$(dirname {1})\" && clear && ls -la' C-m 2>/dev/null || true)",

		// Refine search with rg (reload file list)
		fmt.Sprintf("ctrl-f:reload(rg --files-with-matches -i '{q}' %s 2>/dev/null)", dirQuoted),
	}

	// Filter out empty/invalid bindings (e.g., ctrl-o kalo rightPaneID kosong)
	if rightPaneID == "" {
		// Remove ctrl-o binding — no tmux pane
		for i, b := range bindings {
			if strings.HasPrefix(b, "ctrl-o:") {
				bindings = append(bindings[:i], bindings[i+1:]...)
				break
			}
		}
	}

	return bindings
}

// buildTreeModeBindings — return fzf --bind entries untuk tree mode.
func buildTreeModeBindings(currentDir string, rightPaneID string) []string {
	bindings := []string{
		// Preview
		"ctrl-p:toggle-preview",
		"ctrl-s:change-preview-window(right:99%|right:60%:wrap,border-left,<80(up:50%:wrap))",

		// Git status (from current dir)
		"ctrl-g:execute(git -C '" + currentDir + "' status -s 2>/dev/null; echo '---'; git -C '" + currentDir + "' log --oneline -10 2>/dev/null || true)",
	}

	return bindings
}

// shEscape — wrap string in single quotes, escape internal single quotes.
func shEscape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}

// ── Helpers: File Operations ───────────────────────────────────

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

// renameDialog — fzf input: edit nama di query, tekan Ctrl-r buat confirm.
func renameDialog(path string) string {
	oldName := filepath.Base(path)

	opts := fzf.DefaultFzfOpts()
	opts.Header = fmt.Sprintf("✏ Rename '%s' — Edit name in query, press Ctrl-r to confirm", oldName)
	opts.Query = oldName
	opts.Expected = "ctrl-r"
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " ✏ Rename "
	opts.Prompt = " ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	result, err := fzf.Run(oldName+"\n", opts)
	if err != nil {
		return ""
	}
	// Enter (ExpectedKey kosong) atau Ctrl-r = confirm
	if result.ExpectedKey != "ctrl-r" && result.ExpectedKey != "" {
		return "" // cancelled via other key
	}
	newName := strings.TrimSpace(result.Query)
	if newName == "" || newName == oldName {
		return "" // no change
	}
	return newName
}

// newFileDialog — fzf input: ketik nama file di query, tekan Ctrl-n buat confirm.
func newFileDialog(dir string) string {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "📄 New file — Type filename in query, press Enter/Ctrl-n to create"
	opts.Query = ""
	opts.Expected = "ctrl-n"
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " 📄 New File "
	opts.Prompt = " 📄 ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	// Dummy item biar Enter bisa work + user liat ada placeholder
	result, err := fzf.Run("new-file-name", opts)
	if err != nil {
		return ""
	}
	// Enter (ExpectedKey kosong) atau Ctrl-n = confirm
	if result.ExpectedKey != "ctrl-n" && result.ExpectedKey != "" {
		return ""
	}
	name := strings.TrimSpace(result.Query)
	if name == "" || name == "new-file-name" {
		return ""
	}
	return name
}

// newFolderDialog — fzf input: ketik nama folder di query, tekan Ctrl-k buat confirm.
func newFolderDialog(dir string) string {
	opts := fzf.DefaultFzfOpts()
	opts.Header = "📁 New folder — Type folder name in query, press Enter/Ctrl-k to create"
	opts.Query = ""
	opts.Expected = "ctrl-k"
	opts.PrintQuery = true
	opts.NoSort = true
	opts.BorderLabel = " 📁 New Folder "
	opts.Prompt = " 📁 ❯ "
	opts.PreviewCmd = ""
	opts.PreviewWindow = ""

	result, err := fzf.Run("new-folder-name", opts)
	if err != nil {
		return ""
	}
	// Enter (ExpectedKey kosong) atau Ctrl-k = confirm
	if result.ExpectedKey != "ctrl-k" && result.ExpectedKey != "" {
		return ""
	}
	name := strings.TrimSpace(result.Query)
	if name == "" || name == "new-folder-name" {
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

// ── Execute ───────────────────────────────────────────────────

// Execute — entry point dipanggil dari cmd/fe/main.go
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// ── Init flags ────────────────────────────────────────────────

func init() {
	rootCmd.PersistentFlags().BoolVarP(&flagSearchMode, "search", "s", false, "Search file content (interactive or with query arg)")
	rootCmd.PersistentFlags().BoolVarP(&flagFindMode, "find", "f", false, "Browse files (explicit find mode)")
	rootCmd.PersistentFlags().BoolVarP(&flagTreeMode, "tree", "t", false, "Tree navigation (folder explorer)")
	rootCmd.PersistentFlags().BoolVarP(&flagBookmarkMode, "bookmarks", "b", false, "Browse bookmarked files")
	rootCmd.Flags().StringVar(&flagTargetDir, "dir", "", "Target directory (positional fallback)")
	rootCmd.Flags().StringVar(&flagExtFilter, "ext", "", "Extension filter (positional fallback)")
	rootCmd.Version = Version
}
