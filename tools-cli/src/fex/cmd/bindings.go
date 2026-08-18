package cmd

import (
	"fmt"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/util"
)

// buildFindModeBindings — return fzf --bind entries untuk find mode berbasis config aktif.
func buildFindModeBindings(dir string, bookmarksFile string, rightPaneID string, kb config.KeybindingsConfig) []string {
	bookmarksQuoted := util.ShEscape(bookmarksFile)

	togglePrevKey := kb.TogglePreview
	if togglePrevKey == "" {
		togglePrevKey = "ctrl-p"
	}
	toggleLayoutKey := kb.ToggleLayout
	if toggleLayoutKey == "" {
		toggleLayoutKey = "ctrl-s"
	}
	bmKey := kb.Bookmark
	if bmKey == "" {
		bmKey = "ctrl-b"
	}
	unbmKey := kb.Unbookmark
	if unbmKey == "" {
		unbmKey = "ctrl-x"
	}
	tmuxKey := kb.TmuxPane
	if tmuxKey == "" {
		tmuxKey = "ctrl-o"
	}

	bindings := []string{
		// Preview
		fmt.Sprintf("%s:toggle-preview", togglePrevKey),
		fmt.Sprintf("%s:change-preview-window(right:99%%|right:60%%:wrap,border-left,<80(up:50%%:wrap))", toggleLayoutKey),

		// Bookmark / Unbookmark
		fmt.Sprintf("%s:execute(echo '{1}' >> %s && echo '✅ Bookmarked: {1}')", bmKey, bookmarksQuoted),
		fmt.Sprintf("%s:execute(sed -i '|{1}|d' %s 2>/dev/null && echo '🗑️ Unbookmarked: {1}')", unbmKey, bookmarksQuoted),

		// Open location in tmux right pane (cd + ls)
		fmt.Sprintf("%s:execute-silent(tmux send-keys -t '%s' 'cd \"$(dirname {1})\" && clear && ls -la' C-m 2>/dev/null || true)", tmuxKey, rightPaneID),
	}

	// Filter out empty/invalid bindings (e.g., tmux key kalo rightPaneID kosong)
	if rightPaneID == "" {
		prefix := tmuxKey + ":"
		for i, b := range bindings {
			if strings.HasPrefix(b, prefix) {
				bindings = append(bindings[:i], bindings[i+1:]...)
				break
			}
		}
	}

	// Append custom fzf bindings dari config bila ada
	for k, v := range kb.Custom {
		if k != "" && v != "" {
			bindings = append(bindings, fmt.Sprintf("%s:%s", k, v))
		}
	}

	return bindings
}

// buildTreeModeBindings — return fzf --bind entries untuk tree mode berbasis config aktif.
func buildTreeModeBindings(currentDir string, rightPaneID string, kb config.KeybindingsConfig) []string {
	togglePrevKey := kb.TogglePreview
	if togglePrevKey == "" {
		togglePrevKey = "ctrl-p"
	}
	toggleLayoutKey := kb.ToggleLayout
	if toggleLayoutKey == "" {
		toggleLayoutKey = "ctrl-s"
	}

	bindings := []string{
		// Preview
		fmt.Sprintf("%s:toggle-preview", togglePrevKey),
		fmt.Sprintf("%s:change-preview-window(right:99%%|right:60%%:wrap,border-left,<80(up:50%%:wrap))", toggleLayoutKey),
	}

	// Append custom fzf bindings dari config bila ada
	for k, v := range kb.Custom {
		if k != "" && v != "" {
			bindings = append(bindings, fmt.Sprintf("%s:%s", k, v))
		}
	}

	return bindings
}
