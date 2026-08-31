package tmux

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

var (
	ErrTmuxNotFound = errors.New("tmux tidak ditemukan di sistem")
)

// Session merepresentasikan sesi tmux aktif
type Session struct {
	Name     string
	Windows  int
	Attached bool
}

// Client interface untuk operasi tmux
type Client interface {
	List() ([]Session, error)
	NewSession(name, cwd string) error
	Attach(name string) error
	Kill(name string) error
}

type execClient struct{}

// NewClient membuat instance default Tmux client
func NewClient() Client {
	return &execClient{}
}

// List mengambil seluruh daftar sesi tmux aktif
func (c *execClient) List() ([]Session, error) {
	if _, err := exec.LookPath("tmux"); err != nil {
		return nil, ErrTmuxNotFound
	}

	cmd := exec.Command("tmux", "list-sessions", "-F", "#{session_name}:#{session_windows}:#{session_attached}")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		return nil, nil // Tidak ada sesi yang berjalan
	}

	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	var sessions []Session

	for _, line := range lines {
		parts := strings.Split(line, ":")
		if len(parts) >= 3 {
			wins, _ := strconv.Atoi(parts[1])
			attached := parts[2] == "1"
			sessions = append(sessions, Session{
				Name:     parts[0],
				Windows:  wins,
				Attached: attached,
			})
		}
	}

	return sessions, nil
}

// NewSession membuat sesi tmux baru di direktori tertentu
func (c *execClient) NewSession(name, cwd string) error {
	if _, err := exec.LookPath("tmux"); err != nil {
		return ErrTmuxNotFound
	}

	name = sanitizeSessionName(name)
	cmd := exec.Command("tmux", "new-session", "-d", "-s", name, "-c", cwd)
	return cmd.Run()
}

// Attach masuk / switch ke sesi tmux
func (c *execClient) Attach(name string) error {
	if _, err := exec.LookPath("tmux"); err != nil {
		return ErrTmuxNotFound
	}

	// Jika sudah di dalam sesi TMUX, gunakan switch-client
	if os.Getenv("TMUX") != "" {
		return exec.Command("tmux", "switch-client", "-t", name).Run()
	}

	// Jalankan attach interaktif yang mewarisi stdio
	cmd := exec.Command("tmux", "attach-session", "-t", name)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Kill mematikan sesi tmux dengan memindahkan client aktif terlebih dahulu jika ada
func (c *execClient) Kill(name string) error {
	if _, err := exec.LookPath("tmux"); err != nil {
		return ErrTmuxNotFound
	}

	// Cek apakah sesi yang mau di-kill adalah sesi tempat kita berada saat ini
	currentSessionCmd := exec.Command("tmux", "display-message", "-p", "#{session_name}")
	var curOut bytes.Buffer
	currentSessionCmd.Stdout = &curOut
	_ = currentSessionCmd.Run()
	currentSession := strings.TrimSpace(curOut.String())

	sessions, _ := c.List()
	var otherSessions []string
	for _, s := range sessions {
		if s.Name != name {
			otherSessions = append(otherSessions, s.Name)
		}
	}

	if name == currentSession && len(otherSessions) > 0 {
		target := otherSessions[0]
		// Switch all clients from target session before killing
		clientsCmd := exec.Command("tmux", "list-clients", "-F", "#{client_name}", "-t", name)
		var clOut bytes.Buffer
		clientsCmd.Stdout = &clOut
		if err := clientsCmd.Run(); err == nil {
			for _, client := range strings.Split(strings.TrimSpace(clOut.String()), "\n") {
				if client != "" {
					_ = exec.Command("tmux", "switch-client", "-c", client, "-t", target).Run()
				}
			}
		}
	}

	return exec.Command("tmux", "kill-session", "-t", name).Run()
}

func sanitizeSessionName(name string) string {
	name = strings.ReplaceAll(name, ".", "_")
	name = strings.ReplaceAll(name, " ", "_")
	name = strings.ReplaceAll(name, ":", "_")
	if name == "" {
		name = fmt.Sprintf("session_%d", os.Getpid())
	}
	return name
}
