// == CORE MISSION ==============================================
// internal/ui/ui.go — Output Formatting + Terminal Utilities
//
// Handle:
//   - ANSI color output
//   - Term size detection (padanan get_preview_size di config.sh)
//   - Icon/emoji helpers based on extension
//   - Formatting: truncate, file size, header line
// ==============================================================
package ui

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// ── Terminal Info ─────────────────────────────────────────────

// TermSize — ukuran terminal saat ini.
type TermSize struct {
	Lines int
	Cols  int
}

// GetTermSize — detect terminal size via `stty size < /dev/tty`.
// Fallback ke 40x80 kalo gagal.
func GetTermSize() TermSize {
	// Try stty size first (portable)
	cmd := exec.Command("stty", "size")
	tty, err := os.OpenFile("/dev/tty", os.O_RDONLY, 0)
	if err == nil {
		cmd.Stdin = tty
		defer tty.Close()
	}
	out, err := cmd.Output()
	if err == nil {
		fields := strings.Fields(string(out))
		if len(fields) == 2 {
			rows, _ := strconv.Atoi(fields[0])
			cols, _ := strconv.Atoi(fields[1])
			if rows > 0 && cols > 0 {
				return TermSize{Lines: rows, Cols: cols}
			}
		}
	}
	// Fallback: check TIOCGWINSZ via /dev/tty ioctl (alternate path)
	// If all fails
	return TermSize{Lines: 40, Cols: 80}
}

// GetPreviewSize — responsive preview window height.
// Mirip get_preview_size() di config.sh lines 74-82.
func GetPreviewSize() string {
	lines := GetTermSize().Lines
	switch {
	case lines < 25:
		return "up:55%"
	case lines < 35:
		return "up:65%"
	case lines < 50:
		return "up:70%"
	default:
		return "up:75%"
	}
}

// ── Styling ───────────────────────────────────────────────────

// Style — ANSI style descriptor.
type Style struct {
	Bold bool
	Fg   Color
	Bg   Color
}

// Color — ANSI color code (foreground).
type Color int

const (
	ColorReset   Color = 0
	ColorRed     Color = 31
	ColorGreen   Color = 32
	ColorYellow  Color = 33
	ColorBlue    Color = 34
	ColorMagenta Color = 35
	ColorCyan    Color = 36
	ColorWhite   Color = 37
)

// ApplyStyle — wrap text with ANSI escape codes.
func ApplyStyle(text string, st Style) string {
	var codes []string
	if st.Bold {
		codes = append(codes, "1")
	}
	if st.Fg != ColorReset {
		codes = append(codes, strconv.Itoa(int(st.Fg)))
	}
	if st.Bg != ColorReset {
		codes = append(codes, strconv.Itoa(int(st.Bg)+10))
	}
	if len(codes) == 0 {
		return text
	}
	return fmt.Sprintf("\033[%sm%s\033[0m", strings.Join(codes, ";"), text)
}

// StyleFile — return style untuk file path berdasarkan ekstensi.
func StyleFile(path string) Style {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go", ".rs", ".py", ".js", ".ts", ".jsx", ".tsx", ".rb", ".java":
		return Style{Fg: ColorGreen}
	case ".md", ".txt", ".doc", ".pdf":
		return Style{Fg: ColorBlue}
	case ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg":
		return Style{Fg: ColorYellow}
	case ".jpg", ".png", ".gif", ".svg", ".ico":
		return Style{Fg: ColorMagenta}
	case ".zip", ".tar", ".gz", ".bz2", ".7z":
		return Style{Fg: ColorRed}
	default:
		return Style{}
	}
}

// ── Icons ─────────────────────────────────────────────────────

// IconMap — mapping file/dir ke icon.
type IconMap map[string]string

var defaultIcons = IconMap{
	"dir":     "📁",
	"file":    "📄",
	"link":    "🔗",
	"image":   "🖼️",
	"code":    "💻",
	"config":  "⚙️",
	"markup":  "📝",
	"archive": "📦",
	"audio":   "🎵",
	"video":   "🎬",
	"pdf":     "📕",
	"bookmark": "🔖",
	"search":  "🔍",
	"tree":    "🌳",
}

// IconFor — return icon untuk file path berdasarkan ekstensi.
func IconFor(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".go", ".rs", ".py", ".js", ".ts", ".rb", ".java", ".c", ".cpp", ".h":
		return defaultIcons["code"]
	case ".md", ".rst", ".txt":
		return defaultIcons["markup"]
	case ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg", ".env":
		return defaultIcons["config"]
	case ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico":
		return defaultIcons["image"]
	case ".zip", ".tar", ".gz", ".bz2", ".xz", ".7z", ".rar":
		return defaultIcons["archive"]
	case ".mp3", ".wav", ".flac", ".ogg", ".m4a":
		return defaultIcons["audio"]
	case ".mp4", ".avi", ".mkv", ".mov", ".webm":
		return defaultIcons["video"]
	case ".pdf":
		return defaultIcons["pdf"]
	default:
		return defaultIcons["file"]
	}
}

// IconForEntry — return icon untuk TreeEntry.
func IconForEntry(isDir bool, name string) string {
	if isDir {
		return defaultIcons["dir"]
	}
	return IconFor(name)
}

// ── Formatting Helpers ────────────────────────────────────────

// HeaderLine — format header dengan border.
func HeaderLine(label string, width int) string {
	if width <= 0 {
		width = 60
	}
	padding := width - len(label) - 2
	if padding < 2 {
		padding = 2
	}
	return fmt.Sprintf(" %s %s", label, strings.Repeat("─", padding))
}

// Truncate — potong path ke max length, tambah "..." kalo kepotong.
func Truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// FmtFileSize — format bytes ke human readable (KB, MB, GB).
func FmtFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// ── Stderr Output ─────────────────────────────────────────────

// Fatal — print error + exit 1.
func Fatal(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "Error: "+format+"\n", args...)
	os.Exit(1)
}

// Info — print info message ke stderr.
func Info(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
}

// Debug — print debug message (kalo FE_DEBUG=true).
func Debug(format string, args ...interface{}) {
	if os.Getenv("FE_DEBUG") == "true" {
		fmt.Fprintf(os.Stderr, "[DEBUG] "+format+"\n", args...)
	}
}
