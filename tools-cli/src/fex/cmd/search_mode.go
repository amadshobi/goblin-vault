package cmd

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/tmux"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

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

		// Open file at line (spawn editor di pane yang sama)
		editor := ui.DetectEditor()
		editorCmd := exec.Command(editor, "+"+lineNum, filePath)
		editorCmd.Stdin = os.Stdin
		editorCmd.Stdout = os.Stdout
		editorCmd.Stderr = os.Stderr
		if err := editorCmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "editor: %v\n", err)
		}
		sess.SetLastOpened(filePath)

		query = "" // reset → prompt baru di loop berikutnya
	}
}
