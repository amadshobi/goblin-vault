package zoxide

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

var (
	ErrZoxideNotFound = errors.New("zoxide tidak ditemukan di sistem (install via: sudo apt install zoxide / brew install zoxide)")
)

// Entry merepresentasikan satu baris direktori di database Zoxide
type Entry struct {
	Path        string
	DisplayPath string
	Score       float64
	Rank        int
	Missing     bool
}

// Client interface untuk operasi database zoxide
type Client interface {
	QueryScores() ([]Entry, error)
	QueryList() ([]string, error)
	Add(path string) error
	Remove(path string) error
}

type execClient struct{}

// NewClient membuat instance default Zoxide client
func NewClient() Client {
	return &execClient{}
}

// QueryScores mengambil semua path beserta ranking score dari Zoxide
func (c *execClient) QueryScores() ([]Entry, error) {
	if _, err := exec.LookPath("zoxide"); err != nil {
		return nil, ErrZoxideNotFound
	}

	cmd := exec.Command("zoxide", "query", "-ls")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		// Fallback ke query biasa jika -ls gagal
		list, lErr := c.QueryList()
		if lErr != nil {
			return nil, err
		}
		var entries []Entry
		for i, p := range list {
			entries = append(entries, createEntry(p, 0, i+1))
		}
		return entries, nil
	}

	homeDir, _ := os.UserHomeDir()
	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	var entries []Entry
	rank := 1

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) >= 2 {
			score, err := strconv.ParseFloat(parts[0], 64)
			if err == nil {
				path := strings.Join(parts[1:], " ")
				entries = append(entries, createEntryWithHome(path, score, rank, homeDir))
				rank++
				continue
			}
		}

		// Fallback jika tidak ada score
		entries = append(entries, createEntryWithHome(line, 0, rank, homeDir))
		rank++
	}

	return entries, nil
}

// QueryList mengambil daftar path murni dari Zoxide
func (c *execClient) QueryList() ([]string, error) {
	if _, err := exec.LookPath("zoxide"); err != nil {
		return nil, ErrZoxideNotFound
	}

	cmd := exec.Command("zoxide", "query", "-l")
	var stdout bytes.Buffer
	cmd.Stdout = &stdout

	if err := cmd.Run(); err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	var results []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l != "" {
			results = append(results, l)
		}
	}
	return results, nil
}

// Add menambahkan path ke zoxide
func (c *execClient) Add(path string) error {
	if _, err := exec.LookPath("zoxide"); err != nil {
		return ErrZoxideNotFound
	}

	absPath, err := filepath.Abs(path)
	if err != nil {
		absPath = path
	}

	if fi, err := os.Stat(absPath); err != nil || !fi.IsDir() {
		return fmt.Errorf("direktori '%s' tidak valid atau tidak ditemukan", path)
	}

	return exec.Command("zoxide", "add", absPath).Run()
}

// Remove menghapus path dari zoxide
func (c *execClient) Remove(path string) error {
	if _, err := exec.LookPath("zoxide"); err != nil {
		return ErrZoxideNotFound
	}

	return exec.Command("zoxide", "remove", path).Run()
}

func createEntry(path string, score float64, rank int) Entry {
	home, _ := os.UserHomeDir()
	return createEntryWithHome(path, score, rank, home)
}

func createEntryWithHome(path string, score float64, rank int, home string) Entry {
	disp := path
	if home != "" && strings.HasPrefix(path, home) {
		disp = "~" + strings.TrimPrefix(path, home)
	}

	missing := false
	if _, err := os.Stat(path); err != nil {
		missing = true
	}

	return Entry{
		Path:        path,
		DisplayPath: disp,
		Score:       score,
		Rank:        rank,
		Missing:     missing,
	}
}
