package app

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func (m Model) View() string {
	if m.Quitting && m.ChosenPath == "" {
		return ""
	}

	if m.Width <= 0 || m.Height <= 0 {
		return "Loading ZF Navigation Engine..."
	}

	// Safety outer width: selalu kurangi 1 kolom agar kursor tidak menyentuh ujung paling kanan (anti auto-wrap)
	usableWidth := max(20, m.Width-1)
	usableHeight := max(4, m.Height)

	var mainView string

	// BREAKPOINT ADAPTIF: Layar HP / Sempit (Width < 95) vs Desktop (Width >= 95)
	if usableWidth < 95 {
		// Mobile / Compact Mode: Top Navigation Tabs + 1 Panel Full-Width
		tabBar := m.renderMobileTabBar(usableWidth)
		mainHeight := max(4, usableHeight-2) // 1 baris tab bar + 1 baris footer

		var activeContent string
		switch m.Focus {
		case FocusWorkspaces:
			activeContent = m.renderWorkspacesPane(usableWidth, mainHeight)
		case FocusGit:
			activeContent = m.renderGitPane(usableWidth, mainHeight)
		case FocusTree:
			activeContent = m.renderTreePane(usableWidth, mainHeight)
		default:
			activeContent = m.renderWorkspacesPane(usableWidth, mainHeight)
		}

		mainView = tabBar + "\n" + activeContent
	} else {
		// Desktop Mode: 3-Pane Golden Ratio Side-by-Side
		mainHeight := max(4, usableHeight-1) // 1 baris footer di bawah

		listWidth, rightWidth, gitHeight, treeHeight := m.getLayoutDimensions(usableWidth, mainHeight)

		workspacesContent := m.renderWorkspacesPane(listWidth, mainHeight)
		gitContent := m.renderGitPane(rightWidth, gitHeight)
		treeContent := m.renderTreePane(rightWidth, treeHeight)

		rightSide := lipgloss.JoinVertical(lipgloss.Left, gitContent, treeContent)
		mainView = lipgloss.JoinHorizontal(lipgloss.Top, workspacesContent, rightSide)
	}

	// Footer baris terbawah
	footer := m.renderFooter(usableWidth)
	fullView := mainView + "\n" + footer

	// Jika ada overlay modal aktif
	if m.Overlay != OverlayNone {
		fullView = m.renderOverlay(fullView)
	}

	// SAKTI ALA LAZYSKILLS: Kunci hasil render pas 100% dengan batas layar terminal
	return ui.FitToScreen(fullView, usableWidth, usableHeight)
}

func (m Model) renderMobileTabBar(width int) string {
	theme := ui.CurrentTheme

	renderTab := func(title string, focused bool) string {
		if focused {
			return lipgloss.NewStyle().
				Bold(true).
				Background(theme.Color(theme.Border)).
				Foreground(lipgloss.Color("#11111B")).
				Padding(0, 1).
				Render(title)
		}
		return lipgloss.NewStyle().
			Foreground(theme.Color(theme.BorderDim)).
			Padding(0, 1).
			Render(title)
	}

	var tab1, tab2, tab3 string
	if width < 50 {
		tab1 = renderTab("󰉋 WS", m.Focus == FocusWorkspaces)
		tab2 = renderTab(" Git", m.Focus == FocusGit)
		tab3 = renderTab("󰈚 Tree", m.Focus == FocusTree)
	} else {
		tab1 = renderTab("󰉋 Workspaces", m.Focus == FocusWorkspaces)
		tab2 = renderTab(" Git Status", m.Focus == FocusGit)
		tab3 = renderTab("󰈚 File Tree", m.Focus == FocusTree)
	}

	tabs := tab1 + " " + tab2 + " " + tab3
	return " " + tabs
}

func (m Model) getLayoutDimensions(width, height int) (listWidth, rightWidth, gitHeight, treeHeight int) {
	listWidth = width * 4 / 10 // 40%
	if listWidth < 28 {
		listWidth = 28
	}
	if listWidth > width-30 {
		listWidth = width - 30
	}
	rightWidth = width - listWidth

	totalContentHeight := max(6, height)
	gitHeight = 7
	if gitHeight > totalContentHeight/2 {
		gitHeight = totalContentHeight / 2
	}
	if gitHeight < 4 {
		gitHeight = 4
	}
	treeHeight = totalContentHeight - gitHeight

	return
}

func (m Model) renderFooter(width int) string {
	theme := ui.CurrentTheme
	keyStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.Border)).Bold(true)
	descStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim))

	var keys []string

	if m.Searching {
		keys = []string{
			keyStyle.Render("󰌑") + " " + descStyle.Render("Pilih"),
			keyStyle.Render("Esc") + " " + descStyle.Render("Batal"),
		}
	} else if width < 55 {
		keys = []string{
			keyStyle.Render("󰌑") + " " + descStyle.Render("Jump"),
			keyStyle.Render("←/→") + " " + descStyle.Render("View"),
			keyStyle.Render("?") + " " + descStyle.Render("Help"),
		}
	} else if width < 95 {
		keys = []string{
			keyStyle.Render("󰌑") + " " + descStyle.Render("Jump"),
			keyStyle.Render("←/→") + " " + descStyle.Render("View"),
			keyStyle.Render("e") + " " + descStyle.Render("Edit"),
			keyStyle.Render("T") + " " + descStyle.Render("Theme"),
			keyStyle.Render("?") + " " + descStyle.Render("Help"),
		}
	} else {
		keys = []string{
			keyStyle.Render("󰌑") + " " + descStyle.Render("Jump"),
			keyStyle.Render("←/→") + " " + descStyle.Render("Focus"),
			keyStyle.Render("t") + " " + descStyle.Render("Tmux"),
			keyStyle.Render("f") + " " + descStyle.Render("Fex"),
			keyStyle.Render("g") + " " + descStyle.Render("Gb"),
			keyStyle.Render("l") + " " + descStyle.Render("Lazygit"),
			keyStyle.Render("e") + " " + descStyle.Render("Edit"),
			keyStyle.Render("T") + " " + descStyle.Render("Theme"),
			keyStyle.Render("/") + " " + descStyle.Render("Search"),
			keyStyle.Render("?") + " " + descStyle.Render("Help"),
		}
	}

	left := strings.Join(keys, "  ")

	right := ""
	if m.ToastMessage != "" {
		right = lipgloss.NewStyle().Foreground(theme.Color(theme.Git)).Bold(true).Render(m.ToastMessage)
	} else if len(m.Filtered) > 0 {
		right = lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render(fmt.Sprintf("%d/%d", m.SelectedIdx+1, len(m.Filtered)))
	}

	// DisplayWidth: icon 󰌑 di keybinding dirender double-width di terminal mobile
	gap := width - ui.DisplayWidth(left) - ui.DisplayWidth(right) - 2
	if gap < 0 {
		gap = 0
	}

	return " " + left + strings.Repeat(" ", gap) + right
}
