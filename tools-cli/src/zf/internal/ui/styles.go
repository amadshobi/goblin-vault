package ui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	xansi "github.com/charmbracelet/x/ansi"
)

// PaneLayout menyimpan kalkulasi dimensi outer dan content yang presisi seperti lazyskills
type PaneLayout struct {
	OuterWidth    int
	OuterHeight   int
	StyleWidth    int
	StyleHeight   int
	ContentWidth  int
	ContentHeight int
}

func NewPaneLayout(outerWidth, outerHeight int) PaneLayout {
	contentWidth := max(1, outerWidth-2)
	contentHeight := max(1, outerHeight-2)
	return PaneLayout{
		OuterWidth:    outerWidth,
		OuterHeight:   outerHeight,
		StyleWidth:    contentWidth,
		StyleHeight:   contentHeight,
		ContentWidth:  contentWidth,
		ContentHeight: contentHeight,
	}
}

// ClampLineWidth memotong baris teks agar tidak melebihi lebar layar dengan ANSI-aware truncation
func ClampLineWidth(s string, width int) string {
	if width <= 0 || s == "" {
		return ""
	}
	if xansi.StringWidth(s) <= width {
		return s
	}
	return xansi.Truncate(s, width, "")
}

// DisplayWidth menghitung lebar visual string berdasarkan tabel hasil
// kalibrasi terminal (glyphWidths); rune tanpa data kalibrasi memakai tabel
// Unicode standar. Kode ANSI diabaikan agar baris ber-styling tetap akurat.
func DisplayWidth(s string) int {
	w := 0
	for _, r := range xansi.Strip(s) {
		w += runeDisplayWidth(r)
	}
	return w
}

// Truncate memotong string dengan elipsis jika melebihi lebar
func Truncate(s string, width int) string {
	if width <= 1 || xansi.StringWidth(s) <= width {
		return s
	}
	return xansi.Truncate(s, width, "…")
}

// FitLines memotong teks agar jumlah barisnya tidak melebihi height
func FitLines(s string, height int) string {
	if height <= 0 {
		return ""
	}
	lines := strings.Split(s, "\n")
	if len(lines) <= height {
		return s
	}
	return strings.Join(lines[:height], "\n")
}

// FitToScreen menjamin hasil render TUI pas 100% di layar terminal (anti line-wrap & anti duplikat)
func FitToScreen(s string, width, height int) string {
	if width <= 0 || height <= 0 {
		return ""
	}
	lines := strings.Split(s, "\n")
	if len(lines) > height {
		lines = lines[:height]
	}
	for i, line := range lines {
		lines[i] = ClampLineWidth(line, width)
	}
	return strings.Join(lines, "\n")
}

// NerdClamp memotong baris berdasarkan DisplayWidth (ANSI-safe via binary search
// terhadap xansi.Truncate). Dipakai untuk menjamin baris ber-icon tidak overflow.
func NerdClamp(s string, width int) string {
	if width <= 0 {
		return ""
	}
	if DisplayWidth(s) <= width {
		return s
	}
	lo, hi := 0, xansi.StringWidth(s)
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if DisplayWidth(xansi.Truncate(s, mid, "")) <= width {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return xansi.Truncate(s, lo, "")
}

// topBorder membangun garis atas pane dengan badge title (nerd-aware)
func topBorder(title string, totalWidth int, focused bool) string {
	theme := CurrentTheme
	borderColor := theme.Color(theme.BorderDim)
	if focused {
		borderColor = theme.Color(theme.Border)
	}
	borderStyle := lipgloss.NewStyle().Foreground(borderColor)

	corner := borderStyle.Render("╭─")
	end := borderStyle.Render("╮")
	if title == "" {
		return corner + borderStyle.Render(strings.Repeat("─", max(0, totalWidth-3))) + end
	}

	formattedTitle := " " + title + " "
	titleWidth := DisplayWidth(formattedTitle)

	rightLinesLen := totalWidth - 3 - titleWidth
	if rightLinesLen < 0 {
		maxTitleWidth := totalWidth - 5
		if maxTitleWidth > 0 {
			formattedTitle = " " + Truncate(title, maxTitleWidth) + " "
			titleWidth = DisplayWidth(formattedTitle)
			rightLinesLen = totalWidth - 3 - titleWidth
		} else {
			formattedTitle = ""
			titleWidth = 0
			rightLinesLen = totalWidth - 2
		}
	}
	if rightLinesLen < 0 {
		rightLinesLen = 0
	}

	var styledTitle string
	if focused {
		styledTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#11111B")).
			Background(theme.Color(theme.Border)).
			Render(formattedTitle)
	} else {
		styledTitle = lipgloss.NewStyle().
			Foreground(theme.Color(theme.BorderDim)).
			Render(formattedTitle)
	}

	return corner + styledTitle + borderStyle.Render(strings.Repeat("─", rightLinesLen)+end)
}

// DecoratePane menggambar border rounded secara MANUAL per-baris (tanpa auto-pad
// lipgloss). Auto-pad lipgloss dihitung dengan tabel Unicode width yang berbeda
// dari render aktual terminal mobile, sehingga menjadi penyebab border meleyot.
// Setiap baris dinormalisasi: NerdClamp lalu dipad hingga DisplayWidth == ContentWidth.
func DecoratePane(content string, width, height int, focused bool, title string) string {
	p := NewPaneLayout(width, height)
	theme := CurrentTheme
	borderColor := theme.Color(theme.BorderDim)
	if focused {
		borderColor = theme.Color(theme.Border)
	}
	borderStyle := lipgloss.NewStyle().Foreground(borderColor)

	rows := strings.Split(FitLines(content, p.ContentHeight), "\n")
	for i, row := range rows {
		row = NerdClamp(row, p.ContentWidth)
		pad := max(0, p.ContentWidth-DisplayWidth(row))
		rows[i] = borderStyle.Render("│") + row + strings.Repeat(" ", pad) + borderStyle.Render("│")
	}
	// Lengkapi tinggi pane agar border kiri-kanan tersambung sampai bawah
	for len(rows) < p.ContentHeight {
		rows = append(rows, borderStyle.Render("│")+strings.Repeat(" ", p.ContentWidth)+borderStyle.Render("│"))
	}

	top := topBorder(title, p.OuterWidth, focused)
	bottom := borderStyle.Render("╰" + strings.Repeat("─", p.ContentWidth) + "╯")

	return top + "\n" + strings.Join(rows, "\n") + "\n" + bottom
}

// InjectHeaderTitle menggantikan baris paling atas container dengan badge title yang stylish
func InjectHeaderTitle(rendered, title string, totalWidth int, focused bool) string {
	topLine := topBorder(title, totalWidth, focused)

	lines := strings.Split(rendered, "\n")
	if len(lines) > 0 {
		lines[0] = topLine
		return strings.Join(lines, "\n")
	}
	return rendered
}
