package icons

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// Nerd Font icons definitions
const (
	DirClosed    = ""
	DirOpen      = ""
	DirHome      = "󰉋"
	GitBranch    = ""
	GitCommit    = "󰜘"
	GitAuthor    = ""
	GitTime      = "󰊢"
	GitDirty     = "󰝤"
	GitStaged    = "󰄬"
	FileDefault  = "󰈚"
	FileCode     = "󰈔"
	FileConfig   = ""
	FileLock     = ""
	FileMarkdown = "󰈚"
	FileGo       = ""
	FileRust     = ""
	FileTS       = ""
	FileJS       = ""
	FilePython   = ""
	FileShell    = "󰈔"
	FileAudio    = "󰎆"
	FileVideo    = "󰕧"
	FileImage    = "󰋩"
	FileArchive  = "󰛫"
	FileDocker   = "󰡨"
)

// All mengembalikan semua glyph ikon yang dipakai tool ini (untuk kalibrasi terminal)
func All() []rune {
	seen := map[rune]bool{}
	var out []rune
	add := func(s string) {
		for _, r := range s {
			if !seen[r] && r > 0x7F {
				seen[r] = true
				out = append(out, r)
			}
		}
	}
	for _, s := range []string{
		DirClosed, DirOpen, DirHome, GitBranch, GitCommit, GitAuthor, GitTime,
		GitDirty, GitStaged, FileDefault, FileCode, FileConfig, FileLock,
		FileMarkdown, FileGo, FileRust, FileTS, FileJS, FilePython, FileShell,
		FileAudio, FileVideo, FileImage, FileArchive, FileDocker,
		"", "󰏖", "󰆍", "󰍁",
	} {
		add(s)
	}
	return out
}

// ForFile returns the raw Nerd Font icon
func ForFile(name string, isDir bool) string {
	if isDir {
		switch name {
		case ".git":
			return ""
		case "node_modules", "vendor", "target", "dist", "build":
			return "󰏖"
		case "tools-cli", "bin", "scripts":
			return "󰆍"
		default:
			return DirClosed
		}
	}

	lower := strings.ToLower(name)
	switch lower {
	case "go.mod", "go.sum":
		return FileGo
	case "cargo.toml", "cargo.lock":
		return FileRust
	case "package.json", "bun.lockb", "pnpm-lock.yaml", "yarn.lock":
		return FileJS
	case "dockerfile", "docker-compose.yml", "docker-compose.yaml":
		return FileDocker
	case "readme.md", "license", "license.md", "agents.md", "changelog.md":
		return FileMarkdown
	case ".gitignore", ".env", ".env.local", ".editorconfig":
		return FileConfig
	}

	ext := strings.TrimPrefix(filepath.Ext(lower), ".")
	switch ext {
	case "go":
		return FileGo
	case "rs":
		return FileRust
	case "ts", "tsx":
		return FileTS
	case "js", "jsx", "mjs", "cjs":
		return FileJS
	case "py":
		return FilePython
	case "sh", "bash", "zsh":
		return FileShell
	case "md", "markdown", "txt":
		return FileMarkdown
	case "json", "yaml", "yml", "toml", "ini", "conf", "config":
		return FileConfig
	case "lock":
		return FileLock
	case "png", "jpg", "jpeg", "gif", "svg", "webp", "ico":
		return FileImage
	case "mp4", "mkv", "avi", "mov", "webm":
		return FileVideo
	case "mp3", "wav", "flac", "ogg":
		return FileAudio
	case "zip", "tar", "gz", "7z", "rar", "bz2", "xz":
		return FileArchive
	default:
		return FileDefault
	}
}

// StyledForFile returns the colored Nerd Font icon based on current theme
func StyledForFile(name string, isDir bool, theme ui.Theme) string {
	icon := ForFile(name, isDir)
	if isDir {
		return lipgloss.NewStyle().Foreground(theme.Color(theme.Border)).Render(icon)
	}
	return lipgloss.NewStyle().Foreground(theme.Color(theme.FileSelected)).Render(icon)
}
