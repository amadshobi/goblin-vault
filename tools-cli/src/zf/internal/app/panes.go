package app

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/icons"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	xansi "github.com/charmbracelet/x/ansi"
)

// 1. Workspaces List Pane (Left)
func (m Model) renderWorkspacesPane(width, height int) string {
	theme := ui.CurrentTheme
	var lines []string

	p := ui.NewPaneLayout(width, height)
	contentWidth := p.ContentWidth
	contentHeight := p.ContentHeight

	// Search bar jika sedang searching
	if m.Searching {
		lines = append(lines, " "+m.SearchInput.View())
		lines = append(lines, " "+lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render(strings.Repeat("─", max(1, contentWidth-2))))
		contentHeight -= 2
	}

	if len(m.Filtered) == 0 {
		lines = append(lines, "")
		lines = append(lines, "  "+icons.DirHome+" "+lipgloss.NewStyle().Foreground(theme.Color(theme.PathUnselected)).Render("Tidak ada workspace ditemukan."))
	} else {
		start := 0
		if m.SelectedIdx >= contentHeight {
			start = m.SelectedIdx - contentHeight + 1
		}
		end := min(len(m.Filtered), start+contentHeight)

		for i := start; i < end; i++ {
			entry := m.Filtered[i]
			isSelected := (m.Focus == FocusWorkspaces && i == m.SelectedIdx)

			icon := icons.DirClosed
			if entry.Missing {
				icon = "󰍁"
			}

			scoreStr := fmt.Sprintf("%.1f", entry.Score)
			if entry.Score == 0 {
				scoreStr = "-"
			}

			// Format path yang dipotong aman (budget -1 ekstra untuk kompensasi icon double-width)
			maxPathLen := max(6, contentWidth-len(scoreStr)-8)
			dispPath := ui.Truncate(entry.DisplayPath, maxPathLen)

			// Gap presisi via DisplayWidth (tabel kalibrasi terminal) agar icon
			// dengan lebar render berapa pun tetap membuat baris pas penuh
			rawLeft := fmt.Sprintf("  %s %s", icon, dispPath)
			leftW := ui.DisplayWidth(rawLeft)
			scoreW := xansi.StringWidth(scoreStr)
			gap := max(1, contentWidth-leftW-scoreW)
			spaces := strings.Repeat(" ", gap)

			if isSelected {
				fullLine := rawLeft + spaces + scoreStr
				styledRow := lipgloss.NewStyle().
					Background(theme.Color(theme.PathSelected)).
					Foreground(lipgloss.Color("#11111B")).
					Bold(true).
					Render(fullLine)

				lines = append(lines, styledRow)
			} else {
				styledIcon := lipgloss.NewStyle().Foreground(theme.Color(theme.Border)).Render(icon)
				styledPath := lipgloss.NewStyle().Foreground(theme.Color(theme.PathUnselected)).Render(dispPath)
				styledScore := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render(scoreStr)

				rowText := fmt.Sprintf("  %s %s%s%s", styledIcon, styledPath, spaces, styledScore)
				lines = append(lines, rowText)
			}
		}
	}

	content := strings.Join(lines, "\n")
	title := fmt.Sprintf("󰉋 Workspaces (%d)", len(m.Filtered))
	if len(m.Filtered) == 0 {
		title = "󰉋 Workspaces"
	}
	return ui.DecoratePane(content, width, height, m.Focus == FocusWorkspaces, title)
}

// 2. Git Inspector Pane (Right Top)
func (m Model) renderGitPane(width, height int) string {
	theme := ui.CurrentTheme
	var lines []string

	p := ui.NewPaneLayout(width, height)
	contentWidth := p.ContentWidth
	contentHeight := p.ContentHeight

	if !m.GitSnapshot.IsRepo {
		lines = append(lines, "")
		lines = append(lines, "  "+icons.GitBranch+"  "+lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render("Bukan repository Git"))
	} else {
		snap := m.GitSnapshot

		branchPill := lipgloss.NewStyle().
			Background(theme.Color(theme.Git)).
			Foreground(lipgloss.Color("#11111B")).
			Bold(true).
			Padding(0, 1).
			Render(icons.GitBranch + " " + snap.Branch)

		if snap.Ahead > 0 || snap.Behind > 0 {
			branchPill += lipgloss.NewStyle().Foreground(theme.Color(theme.PathSelected)).Render(fmt.Sprintf(" ↑%d ↓%d", snap.Ahead, snap.Behind))
		}

		commitInfo := ""
		if snap.ShortHash != "" {
			commitInfo = lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render(fmt.Sprintf(" %s · %s", snap.ShortHash, snap.RelTime))
		}

		lines = append(lines, fmt.Sprintf(" %s%s", branchPill, commitInfo))
		lines = append(lines, "")

		if len(snap.Files) == 0 {
			cleanBadge := lipgloss.NewStyle().Foreground(theme.Color(theme.Git)).Bold(true).Render(icons.GitStaged + " Working tree clean")
			lines = append(lines, "   "+cleanBadge)
		} else {
			fileListHeight := max(1, contentHeight-3)
			start := 0
			if m.GitSelIdx >= fileListHeight {
				start = m.GitSelIdx - fileListHeight + 1
			}
			end := min(len(snap.Files), start+fileListHeight)

			for i := start; i < end; i++ {
				f := snap.Files[i]
				isSelected := (m.Focus == FocusGit && i == m.GitSelIdx)

				statusTagRaw := fmt.Sprintf("%-2s", f.Status)
				maxFileLen := max(5, contentWidth-8)
				filePath := ui.Truncate(f.Path, maxFileLen)

				// Gap presisi via DisplayWidth agar filename wide-char tidak menggeser border
				rawLine := fmt.Sprintf("   %s %s", statusTagRaw, filePath)
				gap := max(0, contentWidth-ui.DisplayWidth(rawLine))
				spaces := strings.Repeat(" ", gap)

				if isSelected {
					fullLine := rawLine + spaces
					styledRow := lipgloss.NewStyle().
						Background(theme.Color(theme.PathSelected)).
						Foreground(lipgloss.Color("#11111B")).
						Bold(true).
						Render(fullLine)

					lines = append(lines, styledRow)
				} else {
					tagStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.PathSelected)).Bold(true)
					if f.Status == "A" {
						tagStyle = lipgloss.NewStyle().Foreground(theme.Color(theme.Git)).Bold(true)
					} else if f.Status == "D" {
						tagStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#F38BA8")).Bold(true)
					}

					statusTag := tagStyle.Render(statusTagRaw)
					fileStyle := lipgloss.NewStyle().Foreground(theme.Color(theme.FileUnselected))
					rowText := fmt.Sprintf("   %s %s%s", statusTag, fileStyle.Render(filePath), spaces)

					lines = append(lines, rowText)
				}
			}
		}
	}

	content := strings.Join(lines, "\n")
	title := " Git Status"
	if m.GitSnapshot.IsRepo && len(m.GitSnapshot.Files) > 0 {
		title = fmt.Sprintf(" Git Status (%d)", len(m.GitSnapshot.Files))
	}
	return ui.DecoratePane(content, width, height, m.Focus == FocusGit, title)
}

// 3. File Tree Pane (Right Bottom)
func (m Model) renderTreePane(width, height int) string {
	theme := ui.CurrentTheme
	var lines []string

	p := ui.NewPaneLayout(width, height)
	contentWidth := p.ContentWidth
	contentHeight := p.ContentHeight

	if len(m.FlatTree) == 0 {
		lines = append(lines, "")
		lines = append(lines, "  "+icons.DirClosed+"  "+lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render("Tidak ada file / direktori kosong"))
	} else {
		start := 0
		if m.TreeSelIdx >= contentHeight {
			start = m.TreeSelIdx - contentHeight + 1
		}
		end := min(len(m.FlatTree), start+contentHeight)

		for i := start; i < end; i++ {
			node := m.FlatTree[i]
			isSelected := (m.Focus == FocusTree && i == m.TreeSelIdx)

			name := node.Name
			if node.IsDir {
				name += "/"
			}

			// Budget nama dikurangi 1 ekstra sebagai ruang aman truncation
			indentLen := node.Depth * 3
			maxNameLen := max(5, contentWidth-indentLen-9)
			dispName := ui.Truncate(name, maxNameLen)
			rawIcon := icons.ForFile(node.Name, node.IsDir)

			// Gap presisi via DisplayWidth: lebar icon diambil dari tabel hasil
			// kalibrasi terminal sehingga border kanan tidak pernah bergeser
			rawLine := fmt.Sprintf("  %s%s %s", strings.Repeat("│  ", node.Depth), rawIcon, dispName)
			gap := max(0, contentWidth-ui.DisplayWidth(rawLine))
			spaces := strings.Repeat(" ", gap)

			if isSelected {
				fullLine := rawLine + spaces
				styledRow := lipgloss.NewStyle().
					Background(theme.Color(theme.FileSelected)).
					Foreground(lipgloss.Color("#11111B")).
					Bold(true).
					Render(fullLine)

				lines = append(lines, styledRow)
			} else {
				indent := ""
				if node.Depth > 0 {
					guide := lipgloss.NewStyle().Foreground(theme.Color(theme.BorderDim)).Render("│  ")
					indent = strings.Repeat(guide, node.Depth)
				}

				styledIcon := icons.StyledForFile(node.Name, node.IsDir, theme)
				styledName := lipgloss.NewStyle().Foreground(theme.Color(theme.FileUnselected)).Render(dispName)
				rowText := fmt.Sprintf("  %s%s %s%s", indent, styledIcon, styledName, spaces)

				lines = append(lines, rowText)
			}
		}
	}

	content := strings.Join(lines, "\n")
	currPath := m.GetCurrentPath()
	baseTitle := "󰈚 File Tree"
	if currPath != "" {
		baseTitle = fmt.Sprintf("󰈚 %s", filepath.Base(currPath))
	}
	return ui.DecoratePane(content, width, height, m.Focus == FocusTree, baseTitle)
}

func splitPath(path string) (parent, project string) {
	if path == "" {
		return "", ""
	}
	idx := strings.LastIndex(path, "/")
	if idx == -1 {
		return "", path
	}
	return path[:idx+1], path[idx+1:]
}
