package app

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/icons"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func (m Model) renderOverlay(background string) string {
	theme := ui.CurrentTheme
	var modalContent string
	var title string
	modalWidth := 58
	modalHeight := 16

	switch m.Overlay {
	case OverlayHelp:
		title = "󰘍 Command Palette"
		modalWidth = 56
		modalHeight = 15
		if modalWidth > m.Width-4 {
			modalWidth = max(28, m.Width-4)
		}
		modalContent = m.renderHelpPalette(modalWidth)

	case OverlayDelete:
		title = "󰉋 Konfirmasi Hapus Workspace"
		modalWidth = 56
		modalHeight = 10
		if modalWidth > m.Width-4 {
			modalWidth = max(28, m.Width-4)
		}
		modalContent = m.renderDeleteModal(modalWidth)

	case OverlayTmux:
		title = " Tmux Session Manager"
		modalWidth = 60
		modalHeight = 14
		if modalWidth > m.Width-4 {
			modalWidth = max(28, m.Width-4)
		}
		modalContent = m.renderTmuxModal(modalWidth)

	case OverlayTheme:
		title = "🎨 Theme Palette"
		modalWidth = 50
		modalHeight = 13
		if modalWidth > m.Width-4 {
			modalWidth = max(28, m.Width-4)
		}
		modalContent = m.renderThemePalette(modalWidth)
	}

	if modalWidth > m.Width-4 {
		modalWidth = max(28, m.Width-4)
	}
	if modalHeight > m.Height-2 {
		modalHeight = max(6, m.Height-2)
	}

	box := lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(theme.Color(theme.Border)).
		Width(modalWidth).
		Height(modalHeight).
		Render(modalContent)

	box = ui.InjectHeaderTitle(box, title, modalWidth+2, true)

	// Tempatkan modal di tengah layar
	return placeCenter(m.Width, m.Height, box, background)
}

func (m Model) renderHelpPalette(width int) string {
	theme := ui.CurrentTheme
	dimStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim))

	var lines []string
	lines = append(lines, "")

	for i, act := range HelpActions {
		isSelected := (i == m.HelpSelIdx)
		title := act.Title
		shortcut := act.Shortcut

		gap := width - lipgloss.Width(title) - lipgloss.Width(shortcut) - 6
		if gap < 0 {
			gap = 0
		}

		if isSelected {
			// Inverted OpenCode Style
			fullLine := fmt.Sprintf("  %s%s%s  ", title, strings.Repeat(" ", gap), shortcut)
			styled := lipgloss.NewStyle().
				Background(theme.Color(theme.PathSelected)).
				Foreground(lipgloss.Color("#11111B")).
				Bold(true).
				Width(width - 2).
				Render(fullLine)
			lines = append(lines, styled)
		} else {
			// Clean unselected style (ikut warna terminal asli)
			styledTitle := lipgloss.NewStyle().Foreground(theme.Color(theme.PathUnselected)).Render(title)
			styledShortcut := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render(shortcut)
			row := fmt.Sprintf("  %s%s%s", styledTitle, strings.Repeat(" ", gap), styledShortcut)
			lines = append(lines, row)
		}
	}

	lines = append(lines, "")
	foot := "  " + dimStyle.Render("󰌑 Eksekusi   j/k Scroll   Esc Tutup")
	lines = append(lines, foot)

	return strings.Join(lines, "\n")
}

func (m Model) renderThemePalette(width int) string {
	theme := ui.CurrentTheme
	dimStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim))

	var lines []string
	lines = append(lines, "")

	for i, t := range ui.AllThemes {
		isSelected := (i == m.ThemeSelIdx)
		isCurrent := strings.EqualFold(t.Name, theme.Name)

		status := ""
		if isCurrent {
			status = "● Active"
		}

		gap := width - lipgloss.Width(t.Name) - lipgloss.Width(status) - 6
		if gap < 0 {
			gap = 0
		}

		if isSelected {
			// Inverted OpenCode Style
			fullLine := fmt.Sprintf("  %s%s%s  ", t.Name, strings.Repeat(" ", gap), status)
			styled := lipgloss.NewStyle().
				Background(theme.Color(theme.PathSelected)).
				Foreground(lipgloss.Color("#11111B")).
				Bold(true).
				Width(width - 2).
				Render(fullLine)
			lines = append(lines, styled)
		} else {
			// Clean unselected style (ikut warna terminal asli)
			nameStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.PathUnselected))
			statusStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.Git))
			if !isCurrent {
				statusStyle = dimStyle
			}

			row := fmt.Sprintf("  %s%s%s", nameStyle.Render(t.Name), strings.Repeat(" ", gap), statusStyle.Render(status))
			lines = append(lines, row)
		}
	}

	lines = append(lines, "")
	foot := "  " + dimStyle.Render("󰌑 Terapkan   j/k Scroll   Esc Tutup")
	lines = append(lines, foot)

	return strings.Join(lines, "\n")
}

func (m Model) renderDeleteModal(width int) string {
	theme := ui.CurrentTheme
	path := m.GetCurrentPath()
	keyStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.Border)).Bold(true)
	descStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim))
	warnStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.PathSelected)).Bold(true)

	var lines []string
	lines = append(lines, "  Hapus path berikut dari indeks Zoxide?")
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("  %s %s", icons.DirClosed, warnStyle.Render(path)))
	lines = append(lines, "")
	lines = append(lines, fmt.Sprintf("  %s %s", keyStyle.Render("y / Enter"), descStyle.Render("Konfirmasi Hapus")))
	lines = append(lines, fmt.Sprintf("  %s %s", keyStyle.Render("n / Esc"), descStyle.Render("Batal")))

	return strings.Join(lines, "\n")
}

func (m Model) renderTmuxModal(width int) string {
	theme := ui.CurrentTheme
	keyStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.Border)).Bold(true)
	descStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim))

	var lines []string
	lines = append(lines, "  Pilih atau buat sesi tmux baru:")
	lines = append(lines, "")

	if len(m.TmuxSessions) == 0 {
		lines = append(lines, "  "+descStyle.Render("Tidak ada sesi tmux aktif."))
	} else {
		for i, s := range m.TmuxSessions {
			isSelected := (i == m.TmuxSelIdx)
			r := fmt.Sprintf("  %s %-16s (%d windows)", icons.DirClosed, s.Name, s.Windows)
			if isSelected {
				fullLine := r
				gap := width - lipgloss.Width(fullLine) - 4
				if gap > 0 {
					fullLine += strings.Repeat(" ", gap)
				}
				styled := lipgloss.NewStyle().
					Background(theme.Color(theme.PathSelected)).
					Foreground(lipgloss.Color("#11111B")).
					Bold(true).
					Width(width - 2).
					Render(fullLine)
				lines = append(lines, styled)
			} else {
				lines = append(lines, descStyle.Render(r))
			}
		}
	}

	lines = append(lines, "")
	lines = append(lines, "  "+keyStyle.Render("Enter Attach/Switch")+"   "+keyStyle.Render("x Kill")+"   "+descStyle.Render("Esc Batal"))

	return strings.Join(lines, "\n")
}

func placeCenter(totalWidth, totalHeight int, modal, bg string) string {
	return lipgloss.Place(totalWidth, totalHeight, lipgloss.Center, lipgloss.Center, modal)
}
