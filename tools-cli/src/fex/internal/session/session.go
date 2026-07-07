// == CORE MISSION ==============================================
// internal/session/session.go — Session State Management
//
// Manage: current working directory, bookmarks (file-backed),
// tmux windows, config reference.
//
// Bookmark persistence: file-based, one path per line.
// Default: ~/.cache/fe-bookmarks (dari Config.BookmarksFile).
// ==============================================================
package session

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
)

// TmuxWindow — representasi window/pane tmux yang dilacak session.
type TmuxWindow struct {
	ID      string
	Name    string
	Command string
	Active  bool
}

// Session — state container untuk satu sesi fe.
type Session struct {
	mu sync.RWMutex

	Cwd       string        // current working directory (abs path)
	Bookmarks []string      // list bookmark paths (loaded dari file)
	Windows   []TmuxWindow  // tracked tmux windows/panes
	Config    *config.Config

	// Internal state untuk tree navigation (dulu pake FE_TREE_FILE)
	TreeCwd string
	// Input mode tracking (dulu pake FE_INPUT_MODE)
	InputMode string // "", "new_file", "new_dir"

	// LastOpenedPath — path file yang terakhir dibuka (cursor jump)
	LastOpenedPath string
	// LastQuery — query terakhir (buat search mode)
	LastQuery string
}

// New — buat session baru dengan config + initial CWD.
func New(cfg *config.Config, initialDir string) *Session {
	return &Session{
		Cwd:       initialDir,
		Config:    cfg,
		Bookmarks: []string{},
		Windows:   []TmuxWindow{},
	}
}

// ── CWD Management ────────────────────────────────────────────

// SetCwd — update current directory dengan validasi path.
func (s *Session) SetCwd(path string) error {
	abs, err := resolveAbs(path)
	if err != nil {
		return fmt.Errorf("cwd: %w", err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return fmt.Errorf("cwd: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("cwd: %s is not a directory", abs)
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.Cwd = abs
	return nil
}

// GetCwd — get current directory.
func (s *Session) GetCwd() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Cwd
}

// resolveAbs — resolve path ke absolute, handle relative paths.
func resolveAbs(path string) (string, error) {
	if filepath.IsAbs(path) {
		return path, nil
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return filepath.Join(cwd, path), nil
}

// ── Bookmark Management (File-backed) ─────────────────────────

// bookmarkFile — return path ke file bookmark dari config.
func (s *Session) bookmarkFile() string {
	if s.Config != nil && s.Config.BookmarksFile != "" {
		return s.Config.BookmarksFile
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache", "fe-bookmarks")
}

// GetBookmarksFile — public accessor untuk bookmark file path.
func (s *Session) GetBookmarksFile() string {
	return s.bookmarkFile()
}

// LoadBookmarks — read bookmark dari file (create if not exist).
// Idempotent: dedup + sort.
func (s *Session) LoadBookmarks() ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := s.bookmarkFile()

	// Ensure file exists
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return nil, fmt.Errorf("bookmarks dir: %w", err)
	}

	f, err := os.OpenFile(path, os.O_RDONLY|os.O_CREATE, 0644)
	if err != nil {
		return nil, fmt.Errorf("open bookmarks: %w", err)
	}
	defer f.Close()

	var list []string
	seen := make(map[string]bool)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || seen[line] {
			continue
		}
		seen[line] = true
		list = append(list, line)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read bookmarks: %w", err)
	}

	sort.Strings(list)
	s.Bookmarks = list
	return list, nil
}

// saveBookmarks — flush in-memory bookmarks ke file.
func (s *Session) saveBookmarks() error {
	path := s.bookmarkFile()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("bookmarks dir: %w", err)
	}
	data := strings.Join(s.Bookmarks, "\n") + "\n"
	if err := os.WriteFile(path, []byte(data), 0644); err != nil {
		return fmt.Errorf("write bookmarks: %w", err)
	}
	return nil
}

// AddBookmark — tambah path ke bookmarks (dedup + save).
func (s *Session) AddBookmark(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already exists
	for _, b := range s.Bookmarks {
		if b == path {
			return nil // already bookmarked, idempotent
		}
	}

	s.Bookmarks = append(s.Bookmarks, path)
	sort.Strings(s.Bookmarks)

	return s.saveBookmarks()
}

// RemoveBookmark — hapus path dari bookmarks (case-sensitive exact match).
func (s *Session) RemoveBookmark(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	filtered := make([]string, 0, len(s.Bookmarks))
	for _, b := range s.Bookmarks {
		if b != path {
			filtered = append(filtered, b)
		}
	}

	if len(filtered) == len(s.Bookmarks) {
		return nil // not found, idempotent
	}

	s.Bookmarks = filtered
	return s.saveBookmarks()
}

// ListBookmarks — return semua bookmark (thread-safe).
func (s *Session) ListBookmarks() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]string, len(s.Bookmarks))
	copy(result, s.Bookmarks)
	return result
}

// ── Tree Navigation State ─────────────────────────────────────

// SetTreeCwd — update tree internal directory.
func (s *Session) SetTreeCwd(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.TreeCwd = path
}

// GetTreeCwd — get tree current directory.
func (s *Session) GetTreeCwd() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.TreeCwd
}

// SetInputMode — tracking mode buat tree: "", "new_file", "new_dir".
func (s *Session) SetInputMode(mode string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.InputMode = mode
}

// GetInputMode — get current input mode.
func (s *Session) GetInputMode() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.InputMode
}

// ── Last Opened Path ───────────────────────────────────────────

// SetLastOpened — simpen path file yang baru dibuka.
func (s *Session) SetLastOpened(path string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.LastOpenedPath = path
}

// GetLastOpened — return path file terakhir dibuka.
func (s *Session) GetLastOpened() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.LastOpenedPath
}
