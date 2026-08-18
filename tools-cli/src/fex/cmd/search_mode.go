package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
	"civil/goblin-vault/tools-cli/src/fex/internal/util"
)

// ── Mode: Live Interactive Ripgrep Search ───────────────────────
//
// Flow:
//   1. Start fzf dengan --disabled dan initial query
//   2. Keystroke reload live via change:reload:rg
//   3. User selects ➔ open file at specific line
//   4. Tab ➔ switch balik ke Flat Find mode

func runSearchMode(sess *session.Session, initialQuery string, prevMode string) (string, error) {
	dir := sess.GetCwd()
	toast := ""

	if prevMode == "" {
		prevMode = "find"
	}

	// Check if ripgrep is available
	if _, err := exec.LookPath("rg"); err != nil {
		return "", fmt.Errorf("ripgrep (rg) not found in PATH. Install it to use search mode.\n  brew install rg  |  apt install ripgrep  |  cargo install ripgrep")
	}

	dirQuoted := util.ShEscape(dir)

	for {
		opts := fzf.DefaultFzfOpts()
		headerPrefix := toast
		if headerPrefix != "" {
			headerPrefix += " | "
		}
		opts.Header = headerPrefix + GetClipboardBadge() + fmt.Sprintf("Enter:open@line | Esc:back (%s) | Tab:find | Alt-c:copy | Alt-m:move | Ctrl-v:paste | Ctrl-h:help | Ctrl-y:clip | Ctrl-g:git", prevMode)
		toast = "" // reset toast setelah dipakai
		opts.Expected = "alt-c,alt-m,ctrl-v,alt-v,ctrl-h,?,tab,ctrl-g,ctrl-y,esc"
		opts.BorderLabel = fmt.Sprintf(" 🔍 Live Ripgrep: %s ", filepath.Base(dir))
		opts.Prompt = " 🔍 ❯ "
		opts.Delimiter = ":"
		opts.Query = initialQuery
		opts.Disabled = true
		opts.NoSort = true
		opts.Cycle = true
		opts.PreviewCmd = `bat --style=numbers --color=always -H {2} {1} 2>/dev/null || cat -n {1} 2>/dev/null || echo '{1}:{2}'`

		// Bindings for live ripgrep streaming as user types
		rgReloadCmd := fmt.Sprintf("rg --line-number --no-heading --color=never --smart-case --max-count=1000 -- {q} %s 2>/dev/null || true", dirQuoted)
		opts.Bindings = []string{
			fmt.Sprintf("change:reload:%s", rgReloadCmd),
			fmt.Sprintf("start:reload:%s", rgReloadCmd),
		}

		result, err := fzf.Run("", opts)
		if err != nil {
			return "", fmt.Errorf("fzf live search: %w", err)
		}

		// ── Route expected keys ──
		switch result.ExpectedKey {
		case "esc":
			// Escape: cancel search and return to previous mode (tree/find)
			return "back", nil

		case "tab":
			return "find", nil

		case "ctrl-g":
			gitStatusDialog(dir)
			continue

		case "ctrl-y":
			if len(result.Selected) == 0 {
				continue
			}
			parts := strings.SplitN(result.Selected[0], ":", 3)
			target := parts[0]
			if !filepath.IsAbs(target) {
				target = filepath.Join(dir, target)
			}
			if err := CopyToSystemClipboard(target); err != nil {
				toast = "⚠ [Copy path failed]"
			} else {
				toast = fmt.Sprintf("📋 [Path copied: %s]", filepath.Base(target))
			}
			continue

		case "ctrl-h", "?":
			helpDialog()
			continue

		case "alt-c":
			if len(result.Selected) == 0 {
				continue
			}
			parts := strings.SplitN(result.Selected[0], ":", 3)
			target := parts[0]
			if !filepath.IsAbs(target) {
				target = filepath.Join(dir, target)
			}
			if err := MarkClipboard(target, ClipActionCopy); err != nil {
				toast = "⚠ [Copy failed]"
			} else {
				toast = fmt.Sprintf("📋 [Marked Copy: %s]", filepath.Base(target))
			}
			continue

		case "alt-m":
			if len(result.Selected) == 0 {
				continue
			}
			parts := strings.SplitN(result.Selected[0], ":", 3)
			target := parts[0]
			if !filepath.IsAbs(target) {
				target = filepath.Join(dir, target)
			}
			if err := MarkClipboard(target, ClipActionMove); err != nil {
				toast = "⚠ [Move failed]"
			} else {
				toast = fmt.Sprintf("📦 [Marked Move: %s]", filepath.Base(target))
			}
			continue

		case "ctrl-v", "alt-v":
			msg, err := ExecutePaste(dir)
			if err != nil {
				toast = fmt.Sprintf("⚠ [%s]", err.Error())
			} else {
				toast = fmt.Sprintf("✅ [%s]", msg)
			}
			continue
		}

		if len(result.Selected) == 0 {
			return "", nil // cancelled
		}

		selected := result.Selected[0]
		parts := strings.SplitN(selected, ":", 3)
		if len(parts) < 2 {
			return "", nil
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

		initialQuery = "" // reset initialQuery on next loop
	}
}
