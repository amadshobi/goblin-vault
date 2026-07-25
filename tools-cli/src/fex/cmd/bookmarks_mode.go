package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/tmux"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

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
		// Loop: stay di bookmarks mode
	}
}
