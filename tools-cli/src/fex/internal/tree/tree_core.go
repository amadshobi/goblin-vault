// tree_core.go — Pure data model, filesystem helpers & formatting.
// Tidak memiliki dependency ke internal/fzf atau internal/ui.
package tree

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// TreeEntry — satu item di tree output.
type TreeEntry struct {
	Path    string // full path
	RelPath string // relative ke root
	Name    string // basename
	IsDir   bool
	Depth   int
}

// TreeOptions — opsi generasi tree (disimpan untuk backward compat).
type TreeOptions struct {
	Root        string   // directory root
	MaxDepth    int      // -1 = unlimited, 0 = root only, >0 = max depth
	ShowHidden  bool     // show dotfiles
	DirOnly     bool     // cuma directories
	ExcludeDirs []string // pola exclude (node_modules, .git, dll)
}

// DefaultExcludes — pola direktori yang di-exclude.
var DefaultExcludes = []string{
	".git",
	"node_modules",
	"__pycache__",
	"vendor",
	"target/debug",
	"dist",
	".npm",
	".cache",
	".next",
	".svelte-kit",
}

// isExcludedDir — check apakah nama dir termasuk exclude list.
func isExcludedDir(name string, excludes []string) bool {
	for _, ex := range excludes {
		if name == ex || strings.Contains(name, ex) {
			return true
		}
	}
	return false
}

// iconForExt — emoji icons berdasarkan ekstensi file.
func iconForExt(name string) string {
	ext := strings.ToLower(filepath.Ext(name))

	switch ext {
	// ── Languages ──
	case ".go":
		return "🔷"
	case ".rs":
		return "🦀"
	case ".py", ".pyc":
		return "🐍"
	case ".js":
		return "🟨"
	case ".ts":
		return "🩵"
	case ".jsx", ".tsx":
		return "⚛️"
	case ".java", ".class":
		return "☕"
	case ".rb":
		return "💎"
	case ".c", ".h":
		return "⚙️"
	case ".cpp", ".cc", ".hpp":
		return "⚙️"
	case ".cs":
		return "🟣"
	case ".lua":
		return "🌙"
	case ".php":
		return "🐘"
	case ".swift":
		return "🐦"
	case ".kt":
		return "🟤"
	case ".dart":
		return "🎯"
	case ".pl":
		return "🦙"
	case ".hs":
		return "λ"
	case ".scala":
		return "🔥"

	// ── Web ──
	case ".html", ".htm":
		return "🌐"
	case ".css", ".scss", ".sass", ".less":
		return "🎨"
	case ".vue":
		return "💚"
	case ".svelte":
		return "🧡"

	// ── Config / Data ──
	case ".json", ".jsonc":
		return "📋"
	case ".yaml", ".yml":
		return "📋"
	case ".toml":
		return "📋"
	case ".ini", ".cfg", ".conf":
		return "⚙️"
	case ".env":
		return "🔐"
	case ".xml", ".plist":
		return "📋"
	case ".svg":
		return "🖼️"
	case ".sql", ".db", ".sqlite":
		return "🗄️"
	case ".csv", ".tsv":
		return "📊"

	// ── Docs ──
	case ".md", ".mdx":
		return "📝"
	case ".txt", ".rst":
		return "📄"
	case ".tex":
		return "📜"
	case ".pdf":
		return "📕"
	case ".doc", ".docx":
		return "📘"
	case ".xls", ".xlsx":
		return "📗"

	// ── Media ──
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".ico":
		return "🖼️"
	case ".mp4", ".avi", ".mkv", ".mov", ".webm":
		return "🎬"
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
		return "🎵"

	// ── Archives ──
	case ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar":
		return "📦"

	// ── Tools ──
	case ".sh", ".bash", ".zsh", ".fish":
		return "💻"
	case ".log":
		return "📄"
	case ".patch", ".diff":
		return "🔀"
	case ".lock":
		return "🔒"
	case ".pid":
		return "🔢"

	// ── Name-based ──
	default:
		n := strings.ToLower(name)
		switch n {
		case "dockerfile", ".dockerignore":
			return "🐳"
		case "makefile", "gnumakefile":
			return "🔧"
		case "go.mod", "go.sum", "go.work":
			return "🔷"
		case "package.json", "package-lock.json":
			return "📦"
		case ".gitignore", ".gitattributes", ".gitmodules":
			return "🔀"
		case "gemfile", "gemfile.lock":
			return "💎"
		case "docker-compose.yml", "docker-compose.yaml", "compose.yml":
			return "🐳"
		default:
			return "📄"
		}
	}
}

// ── Helper: List Directory Contents ───────────────────────────

// ListDirContents — list isi directory (padanan ls -1Ap di tree.sh).
// Return slice entry yang udah di-sort: dirs first, then alpha.
func ListDirContents(dirPath string, showHidden bool) ([]TreeEntry, error) {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return nil, err
	}

	var result []TreeEntry
	for _, e := range entries {
		if !showHidden && len(e.Name()) > 0 && e.Name()[0] == '.' {
			continue
		}
		result = append(result, TreeEntry{
			Path:  filepath.Join(dirPath, e.Name()),
			Name:  e.Name(),
			IsDir: e.IsDir(),
		})
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir // dirs first
		}
		return strings.ToLower(result[i].Name) < strings.ToLower(result[j].Name)
	})

	return result, nil
}

// ParentDir — return parent directory path.
// Kalo udah di root "/", return "/" .
func ParentDir(current string) string {
	parent := filepath.Dir(current)
	if parent == current {
		return current
	}
	return parent
}

// FormatTreeLine — format satu TreeEntry jadi string buat display.
func FormatTreeLine(entry TreeEntry) string {
	if entry.IsDir {
		return fmt.Sprintf("📁 %s/", entry.Name)
	}
	return fmt.Sprintf("%s %s", iconForExt(entry.Name), entry.Name)
}
