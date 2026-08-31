package app

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/tmux"
	"civil/goblin-vault/tools-cli/src/zf/internal/tree"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"civil/goblin-vault/tools-cli/src/zf/internal/zoxide"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type EditorFinishedMsg struct {
	Err error
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		return m, nil

	case EditorFinishedMsg:
		cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
		cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
		return m, tea.Batch(cmds...)

	case ZoxideLoadedMsg:
		if msg.Err == nil {
			m.Entries = msg.Entries
			m.Filtered = m.filterEntries(m.SearchInput.Value())
			if len(m.Filtered) > 0 {
				m.SelectedIdx = 0
				cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
				cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
			}
		}
		return m, tea.Batch(cmds...)

	case GitLoadedMsg:
		m.GitSnapshot = msg.Snapshot
		m.GitSelIdx = 0
		return m, nil

	case TreeLoadedMsg:
		m.TreeNodes = msg.Nodes
		m.FlatTree = tree.FlattenNodes(msg.Nodes)
		m.TreeSelIdx = 0
		return m, nil

	case TmuxLoadedMsg:
		if msg.Err == nil {
			m.TmuxSessions = msg.Sessions
			m.TmuxSelIdx = 0
		}
		return m, nil

	case tea.KeyMsg:
		// 1. Tangani overlay mode (Help / Delete / Tmux / Theme)
		if m.Overlay != OverlayNone {
			return m.handleOverlayKeys(msg)
		}

		// 2. Tangani searching input
		if m.Searching {
			switch msg.String() {
			case "esc":
				m.Searching = false
				m.SearchInput.Blur()
				return m, nil
			case "enter":
				m.Searching = false
				m.SearchInput.Blur()
				return m, nil
			case "up", "ctrl+k":
				if len(m.Filtered) > 0 {
					if m.SelectedIdx > 0 {
						m.SelectedIdx--
					} else {
						m.SelectedIdx = len(m.Filtered) - 1
					}
					cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
					cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
				}
				return m, tea.Batch(cmds...)
			case "down", "ctrl+j":
				if len(m.Filtered) > 0 {
					if m.SelectedIdx < len(m.Filtered)-1 {
						m.SelectedIdx++
					} else {
						m.SelectedIdx = 0
					}
					cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
					cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
				}
				return m, tea.Batch(cmds...)
			default:
				var tiCmd tea.Cmd
				m.SearchInput, tiCmd = m.SearchInput.Update(msg)
				m.Filtered = m.filterEntries(m.SearchInput.Value())
				if m.SelectedIdx >= len(m.Filtered) {
					m.SelectedIdx = max(0, len(m.Filtered)-1)
				}
				cmds = append(cmds, tiCmd)
				if len(m.Filtered) > 0 {
					cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
					cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
				}
				return m, tea.Batch(cmds...)
			}
		}

		// 3. Normal navigation keys
		switch msg.String() {
		case "ctrl+c", "q", "esc":
			m.Quitting = true
			m.ChosenPath = ""
			m.ChosenAction = ""
			return m, tea.Quit

		case "?":
			m.Overlay = OverlayHelp
			m.HelpSelIdx = 0
			return m, nil

		case "T":
			m.Overlay = OverlayTheme
			m.ThemeSelIdx = 0
			return m, nil

		case "/":
			m.Searching = true
			m.SearchInput.Focus()
			return m, textinput.Blink

		case "tab":
			switch m.Focus {
			case FocusWorkspaces:
				m.Focus = FocusGit
			case FocusGit:
				m.Focus = FocusTree
			case FocusTree:
				m.Focus = FocusWorkspaces
			}
			return m, nil

		case "shift+tab":
			switch m.Focus {
			case FocusWorkspaces:
				m.Focus = FocusTree
			case FocusTree:
				m.Focus = FocusGit
			case FocusGit:
				m.Focus = FocusWorkspaces
			}
			return m, nil

		case "right":
			if m.Focus == FocusWorkspaces {
				m.Focus = FocusTree
			} else if m.Focus == FocusGit {
				m.Focus = FocusTree
			}
			return m, nil

		case "left":
			if m.Focus == FocusTree || m.Focus == FocusGit {
				m.Focus = FocusWorkspaces
			}
			return m, nil

		case "1":
			m.Focus = FocusWorkspaces
			return m, nil
		case "2":
			m.Focus = FocusGit
			return m, nil
		case "3":
			m.Focus = FocusTree
			return m, nil

		case "up", "k":
			switch m.Focus {
			case FocusWorkspaces:
				if len(m.Filtered) > 0 {
					if m.SelectedIdx > 0 {
						m.SelectedIdx--
					} else {
						m.SelectedIdx = len(m.Filtered) - 1
					}
					cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
					cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
				}
			case FocusGit:
				if len(m.GitSnapshot.Files) > 0 {
					if m.GitSelIdx > 0 {
						m.GitSelIdx--
					} else {
						m.GitSelIdx = len(m.GitSnapshot.Files) - 1
					}
				}
			case FocusTree:
				if len(m.FlatTree) > 0 {
					if m.TreeSelIdx > 0 {
						m.TreeSelIdx--
					} else {
						m.TreeSelIdx = len(m.FlatTree) - 1
					}
				}
			}
			return m, tea.Batch(cmds...)

		case "down", "j":
			switch m.Focus {
			case FocusWorkspaces:
				if len(m.Filtered) > 0 {
					if m.SelectedIdx < len(m.Filtered)-1 {
						m.SelectedIdx++
					} else {
						m.SelectedIdx = 0
					}
					cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
					cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
				}
			case FocusGit:
				if len(m.GitSnapshot.Files) > 0 {
					if m.GitSelIdx < len(m.GitSnapshot.Files)-1 {
						m.GitSelIdx++
					} else {
						m.GitSelIdx = 0
					}
				}
			case FocusTree:
				if len(m.FlatTree) > 0 {
					if m.TreeSelIdx < len(m.FlatTree)-1 {
						m.TreeSelIdx++
					} else {
						m.TreeSelIdx = 0
					}
				}
			}
			return m, tea.Batch(cmds...)

		case "r":
			m.ToastMessage = "Data dimuat ulang..."
			cmds = append(cmds, LoadZoxideScoresCmd())
			cmds = append(cmds, LoadGitSnapshotCmd(m.GetCurrentPath()))
			cmds = append(cmds, LoadTreeCmd(m.GetCurrentPath()))
			return m, tea.Batch(cmds...)

		case "d":
			if len(m.Filtered) > 0 {
				m.Overlay = OverlayDelete
			}
			return m, nil

		case "t":
			if len(m.Filtered) > 0 {
				m.ChosenPath = m.GetCurrentPath()
				m.ChosenAction = "tmux"
				m.Quitting = true
				return m, tea.Quit
			}
			return m, nil

		case "f":
			if len(m.Filtered) > 0 {
				m.ChosenPath = m.GetCurrentPath()
				m.ChosenAction = "fex"
				m.Quitting = true
				return m, tea.Quit
			}
			return m, nil

		case "g":
			if len(m.Filtered) > 0 {
				m.ChosenPath = m.GetCurrentPath()
				m.ChosenAction = "gb"
				m.Quitting = true
				return m, tea.Quit
			}
			return m, nil

		case "l":
			if len(m.Filtered) > 0 {
				m.ChosenPath = m.GetCurrentPath()
				m.ChosenAction = "lazygit"
				m.Quitting = true
				return m, tea.Quit
			}
			return m, nil

		case "e":
			editorCmd := getEditorCmd()
			if m.Focus == FocusTree {
				if len(m.FlatTree) > 0 && m.TreeSelIdx < len(m.FlatTree) {
					node := m.FlatTree[m.TreeSelIdx]
					if node.IsDir {
						return m, nil
					}
					cmd := exec.Command(editorCmd, node.Path)
					cmd.Dir = m.GetCurrentPath()
					return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
						return EditorFinishedMsg{Err: err}
					})
				}
				return m, nil
			} else if m.Focus == FocusGit {
				if len(m.GitSnapshot.Files) > 0 && m.GitSelIdx < len(m.GitSnapshot.Files) {
					f := m.GitSnapshot.Files[m.GitSelIdx]
					fullPath := filepath.Join(m.GetCurrentPath(), f.Path)
					cmd := exec.Command(editorCmd, fullPath)
					cmd.Dir = m.GetCurrentPath()
					return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
						return EditorFinishedMsg{Err: err}
					})
				}
				return m, nil
			} else if len(m.Filtered) > 0 {
				targetPath := m.GetCurrentPath()
				cmd := exec.Command(editorCmd, targetPath)
				cmd.Dir = targetPath
				return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
					return EditorFinishedMsg{Err: err}
				})
			}
			return m, nil

		case "enter":
			if m.Focus == FocusWorkspaces {
				if len(m.Filtered) > 0 {
					m.ChosenPath = m.GetCurrentPath()
					m.ChosenAction = m.ActionPrefix
					m.Quitting = true
					return m, tea.Quit
				}
			} else if m.Focus == FocusTree {
				if len(m.FlatTree) > 0 && m.TreeSelIdx < len(m.FlatTree) {
					node := m.FlatTree[m.TreeSelIdx]
					if node.IsDir {
						return m, nil
					}
					editorCmd := getEditorCmd()
					cmd := exec.Command(editorCmd, node.Path)
					cmd.Dir = m.GetCurrentPath()
					return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
						return EditorFinishedMsg{Err: err}
					})
				}
			} else if m.Focus == FocusGit {
				if len(m.GitSnapshot.Files) > 0 && m.GitSelIdx < len(m.GitSnapshot.Files) {
					f := m.GitSnapshot.Files[m.GitSelIdx]
					fullPath := filepath.Join(m.GetCurrentPath(), f.Path)
					editorCmd := getEditorCmd()
					cmd := exec.Command(editorCmd, fullPath)
					cmd.Dir = m.GetCurrentPath()
					return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
						return EditorFinishedMsg{Err: err}
					})
				}
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m Model) handleOverlayKeys(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	switch m.Overlay {
	case OverlayHelp:
		switch key {
		case "esc", "q", "?":
			m.Overlay = OverlayNone
			return m, nil
		case "up", "k":
			if m.HelpSelIdx > 0 {
				m.HelpSelIdx--
			} else {
				m.HelpSelIdx = len(HelpActions) - 1
			}
			return m, nil
		case "down", "j":
			if m.HelpSelIdx < len(HelpActions)-1 {
				m.HelpSelIdx++
			} else {
				m.HelpSelIdx = 0
			}
			return m, nil
		case "enter":
			if len(HelpActions) > 0 && m.HelpSelIdx < len(HelpActions) {
				act := HelpActions[m.HelpSelIdx]
				m.Overlay = OverlayNone

				switch act.ActionID {
				case "jump":
					if len(m.Filtered) > 0 {
						m.ChosenPath = m.GetCurrentPath()
						m.ChosenAction = m.ActionPrefix
						m.Quitting = true
						return m, tea.Quit
					}
				case "fex":
					if len(m.Filtered) > 0 {
						m.ChosenPath = m.GetCurrentPath()
						m.ChosenAction = "fex"
						m.Quitting = true
						return m, tea.Quit
					}
				case "gb":
					if len(m.Filtered) > 0 {
						m.ChosenPath = m.GetCurrentPath()
						m.ChosenAction = "gb"
						m.Quitting = true
						return m, tea.Quit
					}
				case "lazygit":
					if len(m.Filtered) > 0 {
						m.ChosenPath = m.GetCurrentPath()
						m.ChosenAction = "lazygit"
						m.Quitting = true
						return m, tea.Quit
					}
				case "editor":
					if len(m.Filtered) > 0 {
						editorCmd := getEditorCmd()
						cmd := exec.Command(editorCmd, m.GetCurrentPath())
						cmd.Dir = m.GetCurrentPath()
						return m, tea.ExecProcess(cmd, func(err error) tea.Msg {
							return EditorFinishedMsg{Err: err}
						})
					}
				case "tmux":
					if len(m.Filtered) > 0 {
						m.ChosenPath = m.GetCurrentPath()
						m.ChosenAction = "tmux"
						m.Quitting = true
						return m, tea.Quit
					}
				case "theme":
					m.Overlay = OverlayTheme
					m.ThemeSelIdx = 0
					return m, nil
				case "search":
					m.Searching = true
					m.SearchInput.Focus()
					return m, textinput.Blink
				case "reload":
					m.ToastMessage = "Data dimuat ulang..."
					return m, tea.Batch(
						LoadZoxideScoresCmd(),
						LoadGitSnapshotCmd(m.GetCurrentPath()),
						LoadTreeCmd(m.GetCurrentPath()),
					)
				case "delete":
					if len(m.Filtered) > 0 {
						m.Overlay = OverlayDelete
					}
					return m, nil
				}
			}
		}

	case OverlayDelete:
		switch key {
		case "esc", "n":
			m.Overlay = OverlayNone
			return m, nil
		case "y", "enter":
			path := m.GetCurrentPath()
			m.Overlay = OverlayNone
			if path != "" {
				client := zoxide.NewClient()
				_ = client.Remove(path)
				m.ToastMessage = "Dihapus dari database!"
				return m, LoadZoxideScoresCmd()
			}
		}

	case OverlayTmux:
		switch key {
		case "esc", "q":
			m.Overlay = OverlayNone
			return m, nil
		case "up", "k":
			if len(m.TmuxSessions) > 0 {
				if m.TmuxSelIdx > 0 {
					m.TmuxSelIdx--
				} else {
					m.TmuxSelIdx = len(m.TmuxSessions) - 1
				}
			}
			return m, nil
		case "down", "j":
			if len(m.TmuxSessions) > 0 {
				if m.TmuxSelIdx < len(m.TmuxSessions)-1 {
					m.TmuxSelIdx++
				} else {
					m.TmuxSelIdx = 0
				}
			}
			return m, nil
		case "enter":
			if len(m.TmuxSessions) > 0 {
				s := m.TmuxSessions[m.TmuxSelIdx]
				client := tmux.NewClient()
				_ = client.Attach(s.Name)
				m.Quitting = true
				return m, tea.Quit
			}
		case "x":
			if len(m.TmuxSessions) > 0 {
				s := m.TmuxSessions[m.TmuxSelIdx]
				client := tmux.NewClient()
				_ = client.Kill(s.Name)
				return m, LoadTmuxSessionsCmd()
			}
		}

	case OverlayTheme:
		switch key {
		case "esc", "q":
			m.Overlay = OverlayNone
			return m, nil
		case "up", "k":
			if len(ui.AllThemes) > 0 {
				if m.ThemeSelIdx > 0 {
					m.ThemeSelIdx--
				} else {
					m.ThemeSelIdx = len(ui.AllThemes) - 1
				}
			}
			return m, nil
		case "down", "j":
			if len(ui.AllThemes) > 0 {
				if m.ThemeSelIdx < len(ui.AllThemes)-1 {
					m.ThemeSelIdx++
				} else {
					m.ThemeSelIdx = 0
				}
			}
			return m, nil
		case "enter":
			if len(ui.AllThemes) > 0 && m.ThemeSelIdx < len(ui.AllThemes) {
				ui.SetTheme(ui.AllThemes[m.ThemeSelIdx].Name)
				m.ToastMessage = "Tema: " + ui.CurrentTheme.Name
				m.Overlay = OverlayNone
				return m, nil
			}
		}
	}

	return m, nil
}

func getEditorCmd() string {
	if ed := os.Getenv("EDITOR"); ed != "" {
		return ed
	}
	if vis := os.Getenv("VISUAL"); vis != "" {
		return vis
	}
	return "nvim"
}

func (m Model) ExecuteFinalAction() error {
	if m.ChosenPath == "" {
		return nil
	}

	runInteractive := func(name string, args ...string) error {
		cmd := exec.Command(name, args...)
		cmd.Dir = m.ChosenPath
		cmd.Stdin = os.Stdin
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		return cmd.Run()
	}

	if strings.HasPrefix(m.ChosenAction, "nvim") || strings.HasPrefix(m.ChosenAction, "micro") || strings.HasPrefix(m.ChosenAction, "code") || strings.HasPrefix(m.ChosenAction, "vim") {
		parts := strings.Fields(m.ChosenAction)
		if len(parts) > 1 {
			return runInteractive(parts[0], parts[1:]...)
		}
		return runInteractive(parts[0])
	}

	switch m.ChosenAction {
	case "fex":
		return runInteractive("fex")
	case "gb":
		return runInteractive("gb")
	case "lazygit":
		return runInteractive("lazygit")
	case "tmux":
		name, err := ui.PromptSessionName("New tmux session name:")
		if err != nil {
			if errors.Is(err, ui.ErrCancelled) {
				return nil
			}
			return err
		}
		client := tmux.NewClient()
		_ = client.NewSession(name, m.ChosenPath)
		return client.Attach(name)
	default:
		parts := strings.Fields(m.ChosenAction)
		if len(parts) > 0 {
			return runInteractive(parts[0], parts[1:]...)
		}
	}

	return nil
}
