// == CORE MISSION ==============================================
// internal/fzf/fzf.go — FZF Wrapper (Go → Bash Bridge)
//
// Spawn fzf external command via os/exec.
// fzf reads candidates from stdin, writes selection to stdout,
// and opens /dev/tty directly for interactive UI.
//
// Filosofi:
//   - Go: setup input, parse flags, handle output
//   - Bash: actual fzf invocation (spawned via os/exec)
// ==============================================================
package fzf

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"civil/goblin-vault/tools-cli/src/fex/internal/ui"
)

// FzfOpts — options untuk fzf invocation.
type FzfOpts struct {
	// Core
	Prompt      string // --prompt
	Query       string // --query (initial query)
	Header      string // --header
	BorderLabel string // --border-label

	// Selection
	Multi      bool   // --multi
	Expected   string // --expect=<key> (single key name for --expect support)
	SelectOne  bool   // --select-1 (auto-select if only 1 match)
	ExitZero   bool   // --exit-0 (exit if no match)

	// Layout
	Layout     string // "reverse", "reverse-list", default
	Style      string // "full", "minimal"

	// Preview
	PreviewCmd    string // --preview
	PreviewWindow string // --preview-window

	// Behavior
	Bindings    []string // --bind entries
	NoSort      bool
	PrintQuery  bool // --print-query
	Cycle       bool // --cycle (wrap cursor from top→bottom and vice versa)

	// Delimiter
	Delimiter string // --delimiter (for field parsing in preview, e.g. ":")

	// Path
	WorkDir string // working directory untuk fzf process
}

// DefaultFzfOpts — default options mirip ui.sh.
func DefaultFzfOpts() FzfOpts {
	return FzfOpts{
		Prompt:        " ❯ ",
		Layout:        "reverse",
		Style:         "full",
		PreviewWindow: "right:60%:wrap,border-left,<80(up:50%:wrap)",
	}
}

// Result — hasil selection dari fzf.
type Result struct {
	Selected    []string // selected items (satu per line)
	Query       string   // query text (pas print-query mode)
	ExitCode    int      // original fzf exit code
	ExpectedKey string   // key pressed via --expect (empty kalo normal Enter)
}

// Run — spawn fzf dengan input string, return hasil selection.
//
// Args:
//   - input: candidate items, dipisah newline. Kalo kosong, stdin
//     ga di-pipe (fzf akan jalan dengan empty list).
//   - opts: konfigurasi FzfOpts
//
// Returns:
//   - Result dengan Selected items (bisa kosong kalo user cancel)
//   - error cuma kalo ada system error (bukan user cancel)
//
// Exit codes fzf:
//   0   = item selected
//   1   = no match / no selection
//   130 = user cancelled (Ctrl-C / Esc)
func Run(input string, opts FzfOpts) (*Result, error) {
	args := buildFzfArgs(opts)

	cmd := exec.Command("fzf", args...)

	// ── Pipe candidates via stdin ──
	if input != "" {
		cmd.Stdin = strings.NewReader(input)
	} else {
		// If no input candidates, fzf will start with empty list
		cmd.Stdin = strings.NewReader("")
	}

	// ── Capture stdout (selected result) ──
	// fzf writes the selected item(s) to stdout, one per line.
	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	// ── Connect stderr to terminal ──
	// fzf writes errors and debug info to stderr.
	// Leave as default (os.Stderr) so user sees fzf errors.
	cmd.Stderr = os.Stderr

	// ── Set working directory ──
	if opts.WorkDir != "" {
		cmd.Dir = opts.WorkDir
	}

	// ── Run ──
	err := cmd.Run()

	result := &Result{ExitCode: 0}

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.ExitCode = exitErr.ExitCode()
			// Exit code 130 = user cancelled (Ctrl-C / Esc) — not an error
			// Exit code 1 = no match / no selection — not an error
			if result.ExitCode == 130 || result.ExitCode == 1 {
				return result, nil
			}
		}
		// Real system error
		return result, fmt.Errorf("fzf exec: %w", err)
	}

	// ── Parse line protocol ──
	// fzf output ordering (ketika flags diset):
	//   1. --expect key (baris pertama, kalo diset)
	//   2. --print-query (baris kedua, kalo diset)
	//   3. Selected items (baris sisanya)
	raw := stdout.String()
	lines := strings.Split(strings.TrimRight(raw, "\n"), "\n")

	for i, line := range lines {
		lines[i] = strings.TrimRight(line, "\r")
	}

	// Track position in output array
	idx := 0

	// ── Parse --expect key ──
	// Hanya consume kalo line beneran match salah satu expected key.
	// Waktu user tekan Enter (normal select), --expect gak nulis key,
	// jadi line pertama adalah selected item, BUKAN key.
	if opts.Expected != "" && len(lines) > idx && lines[idx] != "" {
		expectedKeys := strings.Split(opts.Expected, ",")
		isKey := false
		for _, ek := range expectedKeys {
			if lines[idx] == ek {
				isKey = true
				break
			}
		}
		if isKey {
			result.ExpectedKey = lines[idx]
			idx++
		}
	}

	// ── Parse --print-query ──
	if opts.PrintQuery && len(lines) > idx {
		result.Query = lines[idx]
		idx++
	}

	// ── Parse remaining lines as selections ──
	for ; idx < len(lines); idx++ {
		if lines[idx] != "" {
			result.Selected = append(result.Selected, lines[idx])
		}
	}

	return result, nil
}

// buildFzfArgs — compile FzfOpts ke []string CLI args.
// Mirip build_fzf_args() di ui.sh.
func buildFzfArgs(opts FzfOpts) []string {
	var args []string

	if opts.Prompt != "" {
		args = append(args, "--prompt", opts.Prompt)
	}
	if opts.Query != "" {
		args = append(args, "--query", opts.Query)
	}
	if opts.Header != "" {
		args = append(args, "--header", opts.Header)
	}
	if opts.BorderLabel != "" {
		args = append(args, "--border-label", opts.BorderLabel)
	}
	if opts.Layout != "" {
		args = append(args, "--layout", opts.Layout)
	}
	if opts.Style != "" {
		args = append(args, "--style", opts.Style)
	}
	if opts.Multi {
		args = append(args, "--multi")
	}
	if opts.SelectOne {
		args = append(args, "--select-1")
	}
	if opts.ExitZero {
		args = append(args, "--exit-0")
	}
	if opts.NoSort {
		args = append(args, "--no-sort")
	}
	if opts.PrintQuery {
		args = append(args, "--print-query")
	}
	if opts.Cycle {
		args = append(args, "--cycle")
	}
	if opts.PreviewCmd != "" {
		args = append(args, "--preview", opts.PreviewCmd)
	}
	if opts.PreviewWindow != "" {
		args = append(args, "--preview-window", opts.PreviewWindow)
	}
	if opts.Delimiter != "" {
		args = append(args, "--delimiter", opts.Delimiter)
	}

	args = append(args, "--header-first")

	for _, b := range opts.Bindings {
		args = append(args, "--bind", b)
	}

	// --expect support
	if opts.Expected != "" {
		args = append(args, "--expect", opts.Expected)
	}

	return args
}

// ── High-level helpers ────────────────────────────────────────

// RunFzf — generic wrapper. Items → string via formatter → fzf → parser.
//
// Type parameters:
//   T — tipe item
//
// Args:
//   items — slice of items to display
//   opts — FzfOpts
//   formatter — func(T) string for display in fzf
//   parser — func(string) T to convert selected line back to T
//
// Returns selected T, or zero value if cancelled.
func RunFzf[T any](items []T, opts FzfOpts, formatter func(T) string, parser func(string) T) (T, error) {
	var zero T

	if len(items) == 0 {
		return zero, nil
	}

	// Format items
	var sb strings.Builder
	for i, item := range items {
		if i > 0 {
			sb.WriteByte('\n')
		}
		sb.WriteString(formatter(item))
	}

	// Run fzf
	result, err := Run(sb.String(), opts)
	if err != nil {
		return zero, err
	}

	if len(result.Selected) == 0 {
		return zero, nil // user cancelled
	}

	return parser(result.Selected[0]), nil
}

// WalkFiles — recursive file listing mirip fd, fallback kalo fd ga available.
//
// Args:
//   - dir: root directory
//   - extFilter: extension filter (e.g. ".go"), empty = all
//
// Returns:
//   - relative paths (dari dir), sorted
//   - error
//
// Behavior:
//   - Includes hidden files (dotfiles) — biar .gitignore, .env, etc muncul
//   - Skip excluded dirs: node_modules, .git, __pycache__, vendor, dist, target, dll
//   - Max depth: 8
//   - Sort alphabetical
func WalkFiles(dir string, extFilter string) ([]string, error) {
	var files []string
	rootDir := dir
	maxDepth := 8

	excludeDirs := map[string]bool{
		".git": true, "node_modules": true, "__pycache__": true,
		"vendor": true, "dist": true, "target": true,
		".npm": true, ".cache": true, ".next": true, ".svelte-kit": true,
	}

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // skip inaccessible
		}

		rel, err := filepath.Rel(rootDir, path)
		if err != nil {
			return nil
		}
		if rel == "." {
			return nil
		}

		// Check depth
		depth := strings.Count(rel, string(filepath.Separator))
		if depth > maxDepth {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		name := d.Name()

		// Skip excluded directories (tetap skip yg noise)
		if d.IsDir() {
			if excludeDirs[name] {
				return filepath.SkipDir
			}
			return nil // skip dirs in file listing but enter them
		}

		// Filter by extension
		if extFilter != "" {
			if !strings.HasSuffix(name, extFilter) {
				return nil
			}
		}

		files = append(files, rel)
		return nil
	})

	if err != nil {
		return nil, err
	}

	sort.Strings(files)
	return files, nil
}

// PickFile — file picker: list files recursively via WalkFiles, pipe to fzf.
//
// Args:
//   - dir: absolute path directory
//   - extFilter: extension filter (e.g. ".go", ".js", "" for all)
//   - findMode: true = tampilkan label 🔍, false = label 📁
//
// Returns:
//   - full path of selected file, or "" if cancelled
//   - error
func PickFile(dir string, extFilter string, findMode bool, initialQuery string) (string, error) {
	// Recursive walk (fallback kalo fd ga ada)
	files, err := WalkFiles(dir, extFilter)
	if err != nil {
		return "", fmt.Errorf("walk files %s: %w", dir, err)
	}
	if len(files) == 0 {
		return "", nil
	}

	opts := DefaultFzfOpts()
	opts.Query = initialQuery
	opts.Header = "Enter:open  Tab:multi-select  Ctrl-p:preview"
	if findMode {
		opts.BorderLabel = fmt.Sprintf(" 🔍 %s ", filepath.Base(dir))
	} else {
		opts.BorderLabel = fmt.Sprintf(" 📁 %s ", filepath.Base(dir))
	}
	opts.WorkDir = dir
	opts.PreviewCmd = ui.DetectPreviewCmd()

	result, err := Run(strings.Join(files, "\n"), opts)
	if err != nil {
		return "", err
	}
	if len(result.Selected) == 0 {
		return "", nil
	}

	return filepath.Join(dir, result.Selected[0]), nil
}
