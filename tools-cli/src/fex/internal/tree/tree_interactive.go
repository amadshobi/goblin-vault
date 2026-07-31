// tree_interactive.go — fzf-based interactive tree selector.
// Depends on tree_core.go types; imports internal/fzf & internal/ui.
package tree

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/fzf"
	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

// SelectFromTree — interactive tree explorer via fzf (flat list + dynamic preview).
//
// Flow:
//  1. List files + folders di currentDir (non-recursive, os.ReadDir)
//  2. Format entry: "📁 .." (parent), "📁 folder/", "📄 file.ext"
//  3. Pipe ke fzf dengan dynamic preview:
//     - Folder → eza --tree --level=2 (fallback: tree -L 2, ls -1p)
//     - File   → bat --style=numbers (fallback: cat -n)
//  4. User select folder → return (path, true, nil) — caller recurse
//  5. User select file → return (path, false, nil)
//  6. User select ".." → return (parent, true, nil)
//  7. User cancel → return ("", false, nil)
//
// State: current dir disimpan di temp file biar preview shell bisa baca.
func SelectFromTree(currentDir string, showHidden bool, initialQuery string) (selectedPath string, isDir bool, err error) {
	// ── 1. Baca entries dari currentDir ──
	entries, err := os.ReadDir(currentDir)
	if err != nil {
		return "", false, fmt.Errorf("read dir %s: %w", currentDir, err)
	}

	// ── 2. Filter + build TreeEntry slice ──
	var displayEntries []TreeEntry
	for _, e := range entries {
		name := e.Name()
		if !showHidden && strings.HasPrefix(name, ".") {
			continue
		}
		if e.IsDir() && isExcludedDir(name, DefaultExcludes) {
			continue
		}
		displayEntries = append(displayEntries, TreeEntry{
			Path:  filepath.Join(currentDir, name),
			Name:  name,
			IsDir: e.IsDir(),
		})
	}

	// ── 3. Sort: dirs first, then alphabetical ──
	sort.Slice(displayEntries, func(i, j int) bool {
		if displayEntries[i].IsDir != displayEntries[j].IsDir {
			return displayEntries[i].IsDir // dirs first
		}
		return strings.ToLower(displayEntries[i].Name) < strings.ToLower(displayEntries[j].Name)
	})

	// ── 4. Build display lines untuk fzf ──
	var listLines []string

	// "📁 .." entry kalo bukan di root
	if currentDir != "/" {
		listLines = append(listLines, "📁 ..")
	}

	for _, e := range displayEntries {
		listLines = append(listLines, FormatTreeLine(e))
	}

	if len(listLines) == 0 {
		fmt.Fprintf(os.Stderr, "🌳 Directory is empty: %s\n", currentDir)
		return "", false, nil
	}

	// ── 5. State: temp file buat currentDir ──
	tmpFile := filepath.Join(os.TempDir(), fmt.Sprintf("fe-tree-%d", os.Getpid()))
	if err := os.WriteFile(tmpFile, []byte(currentDir), 0644); err != nil {
		return "", false, fmt.Errorf("write state: %w", err)
	}
	defer os.Remove(tmpFile)

	// ── 6. Fzf options ──
	opts := fzf.DefaultFzfOpts()
	opts.Query = initialQuery
	opts.Header = fmt.Sprintf("📁 %s  |  Enter:buka  Esc:naik", filepath.Base(currentDir))
	opts.BorderLabel = fmt.Sprintf(" 🌳 %s ", filepath.Base(currentDir))
	opts.Prompt = " 🌳 ❯ "

	// Dynamic preview command:
	//   - Strip icon prefix dengan sed (hapus first word = icon)
	//   - Baca currentDir dari temp file
	//   - Folder ("..", dir) → eza --tree (fallback: tree, ls)
	//   - File → detectPreviewCmd (batcat/bat, fallback: cat -n)
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

	// Preview window: kanan 80%, collapse ke atas kalo layar <80 kolom
	opts.PreviewWindow = "right:80%:wrap,border-left,<80(up:65%:wrap)"

	// ── 7. Run fzf ──
	result, err := fzf.Run(strings.Join(listLines, "\n"), opts)
	if err != nil {
		return "", false, fmt.Errorf("tree fzf: %w", err)
	}

	if len(result.Selected) == 0 {
		return "", false, nil // cancelled
	}

	selected := result.Selected[0]

	// ── 8. Parse selection ──
	// "📁 .." → parent directory
	if selected == "📁 .." {
		parent := ParentDir(currentDir)
		return parent, true, nil
	}

	// Match against display entries
	for _, e := range displayEntries {
		if FormatTreeLine(e) == selected {
			return e.Path, e.IsDir, nil
		}
	}

	// Fallback: match by name (handle emoji encoding mismatch)
	for _, e := range displayEntries {
		entryName := e.Name
		if e.IsDir {
			entryName += "/"
		}
		if strings.Contains(selected, entryName) {
			return e.Path, e.IsDir, nil
		}
	}

	return "", false, fmt.Errorf("could not match selection: %s", selected)
}
