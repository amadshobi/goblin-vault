package cmd

import (
	"fmt"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/util"
)

// buildFindModeBindings — return fzf --bind entries untuk find mode.
func buildFindModeBindings(dir string, bookmarksFile string, rightPaneID string) []string {
	bookmarksQuoted := util.ShEscape(bookmarksFile)

	bindings := []string{
		// Preview
		"ctrl-p:toggle-preview",
		"ctrl-s:change-preview-window(right:99%|right:60%:wrap,border-left,<80(up:50%:wrap))",

		// Bookmark / Unbookmark
		fmt.Sprintf("ctrl-b:execute(echo '{1}' >> %s && echo '✅ Bookmarked: {1}')", bookmarksQuoted),
		fmt.Sprintf("ctrl-x:execute(sed -i '|{1}|d' %s 2>/dev/null && echo '🗑️ Unbookmarked: {1}')", bookmarksQuoted),

		// Open location in tmux right pane (cd + ls)
		"ctrl-o:execute-silent(tmux send-keys -t '" + rightPaneID + "' 'cd \"$(dirname {1})\" && clear && ls -la' C-m 2>/dev/null || true)",
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
	}

	return bindings
}
