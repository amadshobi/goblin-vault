package app

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/git"
	"civil/goblin-vault/tools-cli/src/zf/internal/tmux"
	"civil/goblin-vault/tools-cli/src/zf/internal/tree"
	"civil/goblin-vault/tools-cli/src/zf/internal/zoxide"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type FocusPane int

const (
	FocusWorkspaces FocusPane = iota
	FocusGit
	FocusTree
)

type OverlayMode int

const (
	OverlayNone OverlayMode = iota
	OverlayHelp
	OverlayDelete
	OverlayTmux
	OverlayTheme
)

// PaletteAction mendefinisikan item pada interactive command palette help
type PaletteAction struct {
	Title    string
	Shortcut string
	ActionID string
}

var HelpActions = []PaletteAction{
	{Title: "Jump to Directory", Shortcut: "Enter", ActionID: "jump"},
	{Title: "Open in Fex (File Explorer)", Shortcut: "f", ActionID: "fex"},
	{Title: "Open in GitHub Assistant (gb)", Shortcut: "g", ActionID: "gb"},
	{Title: "Open in LazyGit", Shortcut: "l", ActionID: "lazygit"},
	{Title: "Edit in $EDITOR (In-place)", Shortcut: "e", ActionID: "editor"},
	{Title: "Open/Create Tmux Session", Shortcut: "t", ActionID: "tmux"},
	{Title: "Switch Theme Palette", Shortcut: "T", ActionID: "theme"},
	{Title: "Search / Filter Workspaces", Shortcut: "/", ActionID: "search"},
	{Title: "Reload Git & Workspace Data", Shortcut: "r", ActionID: "reload"},
	{Title: "Delete from Zoxide Database", Shortcut: "d", ActionID: "delete"},
}

// Model menyimpan immutable UI state untuk Bubble Tea
type Model struct {
	// Domain data
	Entries     []zoxide.Entry
	Filtered    []zoxide.Entry
	SelectedIdx int

	// Git & Tree inspection
	GitSnapshot git.Snapshot
	GitSelIdx   int
	TreeNodes   []tree.Node
	FlatTree    []tree.Node
	TreeSelIdx  int

	// Tmux data
	TmuxSessions []tmux.Session
	TmuxSelIdx   int

	// Interactive Overlays data
	HelpSelIdx  int
	ThemeSelIdx int

	// UI layout & focus
	Width       int
	Height      int
	Focus       FocusPane
	Overlay     OverlayMode
	SearchInput textinput.Model
	Searching   bool

	// Execution contract
	PickMode     bool
	ActionPrefix string
	ChosenPath   string
	ChosenAction string
	Quitting     bool
	ErrMessage   string
	ToastMessage string
}

// NewModel menginisialisasi model TUI dengan parameter awal
func NewModel(pickMode bool, actionPrefix string) Model {
	ti := textinput.New()
	ti.Placeholder = "Ketik untuk filter workspace..."
	ti.Prompt = " / "
	ti.CharLimit = 100

	return Model{
		Entries:      nil,
		Filtered:     nil,
		SelectedIdx:  0,
		GitSelIdx:    0,
		HelpSelIdx:   0,
		ThemeSelIdx:  0,
		Focus:        FocusWorkspaces,
		Overlay:      OverlayNone,
		SearchInput:  ti,
		Searching:    false,
		PickMode:     pickMode,
		ActionPrefix: actionPrefix,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Batch(
		LoadZoxideScoresCmd(),
		textinput.Blink,
	)
}

// Msg types
type ZoxideLoadedMsg struct {
	Entries []zoxide.Entry
	Err     error
}

type GitLoadedMsg struct {
	Snapshot git.Snapshot
}

type TreeLoadedMsg struct {
	Nodes []tree.Node
}

type TmuxLoadedMsg struct {
	Sessions []tmux.Session
	Err      error
}

// Commands async
func LoadZoxideScoresCmd() tea.Cmd {
	return func() tea.Msg {
		client := zoxide.NewClient()
		entries, err := client.QueryScores()
		return ZoxideLoadedMsg{Entries: entries, Err: err}
	}
}

func LoadGitSnapshotCmd(dir string) tea.Cmd {
	return func() tea.Msg {
		if dir == "" {
			return GitLoadedMsg{Snapshot: git.Snapshot{IsRepo: false}}
		}
		snap := git.GetSnapshot(dir)
		return GitLoadedMsg{Snapshot: snap}
	}
}

func LoadTreeCmd(dir string) tea.Cmd {
	return func() tea.Msg {
		if dir == "" {
			return TreeLoadedMsg{Nodes: nil}
		}
		nodes := tree.BuildTree(dir, 2)
		return TreeLoadedMsg{Nodes: nodes}
	}
}

func LoadTmuxSessionsCmd() tea.Cmd {
	return func() tea.Msg {
		client := tmux.NewClient()
		sessions, err := client.List()
		return TmuxLoadedMsg{Sessions: sessions, Err: err}
	}
}

// FilterEntries menyaring entri berdasarkan query pencarian
func (m Model) filterEntries(query string) []zoxide.Entry {
	if query == "" {
		return m.Entries
	}

	q := strings.ToLower(query)
	var res []zoxide.Entry
	for _, e := range m.Entries {
		if strings.Contains(strings.ToLower(e.Path), q) || strings.Contains(strings.ToLower(e.DisplayPath), q) {
			res = append(res, e)
		}
	}
	return res
}

func (m Model) GetCurrentPath() string {
	if len(m.Filtered) == 0 || m.SelectedIdx < 0 || m.SelectedIdx >= len(m.Filtered) {
		return ""
	}
	return m.Filtered[m.SelectedIdx].Path
}
