package ui

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"civil/goblin-vault/tools-cli/src/zf/internal/tmux"
)

// ErrCancelled dikembalikan saat user membatalkan picker/prompt (esc/q/ctrl+c).
// Dipisahkan dari error operasional agar caller bisa exit 0 tanpa noise.
var ErrCancelled = errors.New("cancelled")

// SessionEntry adalah satu entri pilihan di session picker
type SessionEntry struct {
	Name    string
	Windows int
	Current bool
}

type sessionPickerModel struct {
	entries   []SessionEntry
	cursor    int
	choice    string
	cancelled bool
}

func newSessionPickerModel(entries []SessionEntry) sessionPickerModel {
	return sessionPickerModel{entries: entries}
}

func (m sessionPickerModel) Init() tea.Cmd { return nil }

func (m sessionPickerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		return m, nil
	}
	switch key.String() {
	case "ctrl+c", "esc", "q":
		m.cancelled = true
		return m, tea.Quit
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.entries)-1 {
			m.cursor++
		}
	case "enter":
		if len(m.entries) > 0 {
			m.choice = m.entries[m.cursor].Name
		}
		return m, tea.Quit
	}
	return m, nil
}

func (m sessionPickerModel) View() string {
	theme := CurrentTheme
	var b strings.Builder

	header := lipgloss.NewStyle().
		Bold(true).
		Foreground(theme.Color(theme.PathSelected)).
		Render("Select tmux session")
	b.WriteString(header + "\n")

	for i, e := range m.entries {
		cursor := "  "
		if i == m.cursor {
			cursor = lipgloss.NewStyle().
				Foreground(theme.Color(theme.Border)).
				Bold(true).
				Render("> ")
		}
		line := lipgloss.NewStyle().
			Foreground(theme.Color(theme.PathUnselected)).
			Render(e.Name + statusSuffix(e))
		if e.Current {
			line += lipgloss.NewStyle().
				Foreground(theme.Color(theme.BorderDim)).
				Render("  (current)")
		}
		if i == m.cursor {
			line = lipgloss.NewStyle().
				Bold(true).
				Foreground(theme.Color(theme.PathSelected)).
				Background(theme.Color(theme.BgSelected)).
				Render(e.Name + statusSuffix(e))
		}
		b.WriteString(cursor + line + "\n")
	}

	help := lipgloss.NewStyle().
		Foreground(theme.Color(theme.BorderDim)).
		Render("up/down move  enter select  esc cancel")
	b.WriteString("\n" + help)

	return b.String()
}

// statusSuffix menambahkan info jumlah windows pada entri picker
func statusSuffix(e SessionEntry) string {
	return fmt.Sprintf("  (%d windows)", e.Windows)
}

// PickSession menampilkan picker interaktif untuk memilih session tmux via Bubble Tea.
// Mengembalikan ErrCancelled jika user membatalkan.
func PickSession(entries []SessionEntry) (string, error) {
	if len(entries) == 0 {
		return "", errors.New("no sessions to pick")
	}
	m := newSessionPickerModel(entries)
	finalModel, err := tea.NewProgram(m, tea.WithAltScreen(), tea.WithOutput(os.Stderr)).Run()
	if err != nil {
		return "", err
	}
	res, ok := finalModel.(sessionPickerModel)
	if !ok || res.cancelled || res.choice == "" {
		return "", ErrCancelled
	}
	return res.choice, nil
}

// PickSessionFromList mengkonversi []tmux.Session lalu membuka FZF interactive selector (fallback ke Bubble Tea)
func PickSessionFromList(sessions []tmux.Session, current string) (string, error) {
	if len(sessions) == 0 {
		return "", errors.New("no sessions to pick")
	}

	// Gunakan FZF jika tersedia untuk parity legacy & tmux popup stability
	if _, err := exec.LookPath("fzf"); err == nil {
		var input strings.Builder
		for _, s := range sessions {
			status := ""
			if s.Name == current {
				status = "  (current)"
			}
			input.WriteString(fmt.Sprintf("%s\t(%d windows)%s\n", s.Name, s.Windows, status))
		}

		cmd := exec.Command("fzf",
			"--prompt=    Session → ",
			"--header=Pilih tmux session (Enter: pilih/attach, Esc: batal)",
			"--layout=reverse",
			"--border=rounded",
			"--cycle",
			"--margin=1,2",
			"--pointer=❯",
			"--delimiter=\t",
			"--with-nth=1,2",
		)
		cmd.Stdin = strings.NewReader(input.String())
		var stdout bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = os.Stderr

		_ = cmd.Run()

		line := strings.TrimSpace(stdout.String())
		if line == "" {
			return "", ErrCancelled
		}
		parts := strings.Split(line, "\t")
		return strings.TrimSpace(parts[0]), nil
	}

	entries := make([]SessionEntry, 0, len(sessions))
	for _, s := range sessions {
		entries = append(entries, SessionEntry{
			Name:    s.Name,
			Windows: s.Windows,
			Current: s.Name == current,
		})
	}
	return PickSession(entries)
}

type namePromptModel struct {
	input     textinput.Model
	header    string
	cancelled bool
}

func newNamePromptModel(header string) namePromptModel {
	ti := textinput.New()
	ti.Placeholder = "session name"
	ti.Focus()
	ti.CharLimit = 64
	return namePromptModel{input: ti, header: header}
}

func (m namePromptModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m namePromptModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, ok := msg.(tea.KeyMsg)
	if !ok {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}
	switch key.String() {
	case "esc", "ctrl+c":
		m.cancelled = true
		return m, tea.Quit
	case "enter":
		if strings.TrimSpace(m.input.Value()) != "" {
			return m, tea.Quit
		}
		return m, nil
	default:
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}
}

func (m namePromptModel) View() string {
	theme := CurrentTheme
	header := lipgloss.NewStyle().
		Bold(true).
		Foreground(theme.Color(theme.PathSelected)).
		Render(m.header)
	return header + "\n" + m.input.View() + "\n" +
		lipgloss.NewStyle().
			Foreground(theme.Color(theme.BorderDim)).
			Render("enter confirm  esc cancel")
}

// PromptSessionNameWithDefault menampilkan prompt input nama session via FZF (fallback ke Bubble Tea)
// dengan nilai default/query awal
func PromptSessionNameWithDefault(header, defaultName string) (string, error) {
	if _, err := exec.LookPath("fzf"); err == nil {
		args := []string{
			"--print-query",
			"--prompt=    Session name → ",
			fmt.Sprintf("--header=%s (Enter to confirm, Esc to cancel)", header),
			"--layout=reverse",
			"--border=rounded",
			"--margin=1,2",
		}
		if defaultName != "" {
			args = append(args, fmt.Sprintf("--query=%s", defaultName))
		}

		cmd := exec.Command("fzf", args...)
		cmd.Stdin = strings.NewReader("")
		var stdout bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = os.Stderr

		_ = cmd.Run()

		lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
		if len(lines) == 0 {
			return "", ErrCancelled
		}
		name := strings.TrimSpace(lines[0])
		if name == "" {
			return "", ErrCancelled
		}
		return name, nil
	}

	m := newNamePromptModel(header)
	if defaultName != "" {
		m.input.SetValue(defaultName)
	}
	finalModel, err := tea.NewProgram(m, tea.WithOutput(os.Stderr)).Run()
	if err != nil {
		return "", err
	}
	res, ok := finalModel.(namePromptModel)
	if !ok || res.cancelled {
		return "", ErrCancelled
	}
	val := strings.TrimSpace(res.input.Value())
	if val == "" {
		return "", ErrCancelled
	}
	return val, nil
}

// PromptSessionName menampilkan prompt input nama session via FZF (fallback ke Bubble Tea)
func PromptSessionName(header string) (string, error) {
	return PromptSessionNameWithDefault(header, "")
}
