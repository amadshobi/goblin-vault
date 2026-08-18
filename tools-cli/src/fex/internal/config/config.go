// == CORE MISSION ==============================================
// internal/config/config.go — Config Loader + Defaults
//
// Basi dari config.sh: tool detection, preview command,
// find depth, editor chain, bookmarks path.
//
// Pake viper buat load YAML dari ~/.config/fex/config.yaml
// (fallback auto-migrate dari ~/.config/fe/config.yaml bila ada).
// Fallback default config kalo file ga ada.
// ==============================================================
package config

import (
	"io"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// KeybindingsConfig — mapping shortcut aksi ke key fzf/terminal.
type KeybindingsConfig struct {
	// Navigation & Mode Switching
	SwitchMode string `mapstructure:"switch_mode"` // default: tab
	Search     string `mapstructure:"search"`      // default: ctrl-f
	Git        string `mapstructure:"git"`         // default: ctrl-g
	Help       string `mapstructure:"help"`        // default: ctrl-h
	CopyPath   string `mapstructure:"copy_path"`   // default: ctrl-y

	// Clipboard & File CRUD
	MarkCopy  string `mapstructure:"mark_copy"`  // default: alt-c
	MarkMove  string `mapstructure:"mark_move"`  // default: alt-m
	Paste     string `mapstructure:"paste"`      // default: ctrl-v
	Rename    string `mapstructure:"rename"`     // default: ctrl-r
	Delete    string `mapstructure:"delete"`     // default: ctrl-d
	NewFile   string `mapstructure:"new_file"`   // default: ctrl-n
	NewFolder string `mapstructure:"new_folder"` // default: ctrl-k

	// In-TUI Preview & Bookmarks
	TogglePreview string `mapstructure:"toggle_preview"` // default: ctrl-p
	ToggleLayout  string `mapstructure:"toggle_layout"`  // default: ctrl-s
	Bookmark      string `mapstructure:"bookmark"`       // default: ctrl-b
	Unbookmark    string `mapstructure:"unbookmark"`     // default: ctrl-x
	TmuxPane      string `mapstructure:"tmux_pane"`      // default: ctrl-o

	// Custom raw fzf bindings (opsional)
	Custom map[string]string `mapstructure:"custom"`
}

// DefaultKeybindings — default keys untuk semua aksi fex.
func DefaultKeybindings() KeybindingsConfig {
	return KeybindingsConfig{
		SwitchMode:    "tab",
		Search:        "ctrl-f",
		Git:           "ctrl-g",
		Help:          "ctrl-h",
		CopyPath:      "ctrl-y",
		MarkCopy:      "alt-c",
		MarkMove:      "alt-m",
		Paste:         "ctrl-v",
		Rename:        "ctrl-r",
		Delete:        "ctrl-d",
		NewFile:       "ctrl-n",
		NewFolder:     "ctrl-k",
		TogglePreview: "ctrl-p",
		ToggleLayout:  "ctrl-s",
		Bookmark:      "ctrl-b",
		Unbookmark:    "ctrl-x",
		TmuxPane:      "ctrl-o",
		Custom:        map[string]string{},
	}
}

// Config — struktur utama config YAML.
// Padanan struct dari variable-variable di config.sh + defaults.
type Config struct {
	// General
	BookmarksFile string `mapstructure:"bookmarks_file"`
	ConfigHome    string `mapstructure:"config_home"`
	FindDepth     int    `mapstructure:"find_depth"`
	FindFilter    string `mapstructure:"find_filter"`

	// Tools
	PreviewCmd string `mapstructure:"preview_cmd"` // auto-detected: bat > batcat > cat -n
	UseFd      bool   `mapstructure:"use_fd"`      // auto-detected: apakah fd tersedia
	Editor     string `mapstructure:"editor"`      // auto-detected: micro > nano > vim > vi
	EditorOpts string `mapstructure:"editor_opts"` // flags tambahan buat editor

	// Tmux
	TmuxPrefix   string `mapstructure:"tmux_prefix"`    // misal: C-b, C-a
	TmuxSplitPct int    `mapstructure:"tmux_split_pct"` // default 30

	// Keybindings
	Keybindings KeybindingsConfig `mapstructure:"keybindings"`

	// FZF Legacy / Direct Map
	FzfOpts map[string]string `mapstructure:"fzf_opts"` // extra keybinding overrides

	// Layout
	PreviewSize string `mapstructure:"preview_size"` // responsive, auto-detect dari terminal height
}

// DefaultConfig — fallback values kalo file config ga ada.
func DefaultConfig() *Config {
	home, _ := os.UserHomeDir()
	return &Config{
		BookmarksFile: filepath.Join(home, ".cache", "fex-bookmarks"),
		ConfigHome:    filepath.Join(home, ".config", "fex"),
		FindDepth:     5,
		FindFilter:    `-not -path "*/.npm/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/vendor/*" -not -path "*/target/debug/*" -not -path "*/dist/*"`,
		PreviewCmd:    "", // auto-detect di Init()
		UseFd:         false,
		Editor:        "", // auto-detect
		TmuxPrefix:    "C-b",
		TmuxSplitPct:  30,
		Keybindings:   DefaultKeybindings(),
		FzfOpts:       map[string]string{},
		PreviewSize:   "up:75%",
	}
}

// Load — load YAML config dari ~/.config/fex/config.yaml.
// Kalo belum ada tapi ~/.config/fe/config.yaml ada, otomatis copy migrasi.
// Kalo file ga ada, init default + create file.
func Load() (*Config, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	configDir := filepath.Join(home, ".config", "fex")
	configFile := filepath.Join(configDir, "config.yaml")

	legacyConfigDir := filepath.Join(home, ".config", "fe")
	legacyConfigFile := filepath.Join(legacyConfigDir, "config.yaml")

	// Ensure new config dir exists
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}

	// Auto-migrate dari legacy ~/.config/fe/config.yaml jika ~/.config/fex/config.yaml belum ada
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		if _, legErr := os.Stat(legacyConfigFile); legErr == nil {
			_ = copyFile(legacyConfigFile, configFile)
		}
	}

	v := viper.New()
	v.SetConfigFile(configFile)
	v.SetConfigType("yaml")

	// Bind env vars: FEX_* (prioritas utama) dan FE_* (legacy backward compatibility)
	v.SetEnvPrefix("FEX")
	v.AutomaticEnv()

	// Set defaults dari DefaultConfig
	dc := DefaultConfig()
	v.SetDefault("bookmarks_file", dc.BookmarksFile)
	v.SetDefault("config_home", dc.ConfigHome)
	v.SetDefault("find_depth", dc.FindDepth)
	v.SetDefault("find_filter", dc.FindFilter)
	v.SetDefault("preview_cmd", dc.PreviewCmd)
	v.SetDefault("use_fd", dc.UseFd)
	v.SetDefault("editor", dc.Editor)
	v.SetDefault("editor_opts", dc.EditorOpts)
	v.SetDefault("tmux_prefix", dc.TmuxPrefix)
	v.SetDefault("tmux_split_pct", dc.TmuxSplitPct)
	v.SetDefault("preview_size", dc.PreviewSize)
	v.SetDefault("keybindings.switch_mode", dc.Keybindings.SwitchMode)
	v.SetDefault("keybindings.search", dc.Keybindings.Search)
	v.SetDefault("keybindings.git", dc.Keybindings.Git)
	v.SetDefault("keybindings.help", dc.Keybindings.Help)
	v.SetDefault("keybindings.copy_path", dc.Keybindings.CopyPath)
	v.SetDefault("keybindings.mark_copy", dc.Keybindings.MarkCopy)
	v.SetDefault("keybindings.mark_move", dc.Keybindings.MarkMove)
	v.SetDefault("keybindings.paste", dc.Keybindings.Paste)
	v.SetDefault("keybindings.rename", dc.Keybindings.Rename)
	v.SetDefault("keybindings.delete", dc.Keybindings.Delete)
	v.SetDefault("keybindings.new_file", dc.Keybindings.NewFile)
	v.SetDefault("keybindings.new_folder", dc.Keybindings.NewFolder)
	v.SetDefault("keybindings.toggle_preview", dc.Keybindings.TogglePreview)
	v.SetDefault("keybindings.toggle_layout", dc.Keybindings.ToggleLayout)
	v.SetDefault("keybindings.bookmark", dc.Keybindings.Bookmark)
	v.SetDefault("keybindings.unbookmark", dc.Keybindings.Unbookmark)
	v.SetDefault("keybindings.tmux_pane", dc.Keybindings.TmuxPane)

	// Try read config file
	if _, err := os.Stat(configFile); err == nil {
		if err := v.ReadInConfig(); err != nil {
			return nil, err
		}
	} else {
		// File ga ada — write default config
		if err := v.SafeWriteConfigAs(configFile); err != nil {
			// Non-fatal: maybe concurrent write, just log
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	// ── Auto-detect tools ──
	cfg.Init()

	return &cfg, nil
}

// copyFile — helper untuk migrasi config file sederhana.
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

// Init — auto-detect tools di sistem (padanan config.sh lines 17-61).
// Panggil otomatis dari Load(). Bisa dipanggil ulang kalo perlu re-detect.
func (c *Config) Init() {
	// 1. Preview command chain: bat > batcat > cat -n
	for _, cmd := range []string{"bat", "batcat"} {
		if path, err := execLookPath(cmd); err == nil {
			if cmd == "bat" {
				c.PreviewCmd = path + " --style=numbers --color=always"
			} else {
				c.PreviewCmd = path + " --style=numbers --color=always"
			}
			break
		}
	}
	if c.PreviewCmd == "" {
		c.PreviewCmd = "cat -n"
	}

	// 2. fd detection
	if _, err := execLookPath("fd"); err == nil {
		c.UseFd = true
	}

	// 3. Editor chain: micro > nano > vim > vi
	for _, cmd := range []string{"micro", "nano", "vim", "vi"} {
		if path, err := execLookPath(cmd); err == nil {
			c.Editor = path
			break
		}
	}
	if c.Editor == "" {
		c.Editor = "cat"
	}
}

// execLookPath — wrapper os/exec.LookPath biar ga ribet.
func execLookPath(file string) (string, error) {
	return findExecutable(file)
}

// findExecutable — simple PATH lookup tanpa os/exec (biar ga
// perlu import os/exec di config package, dependency minimal).
func findExecutable(file string) (string, error) {
	pathEnv := os.Getenv("PATH")
	if pathEnv == "" {
		return "", os.ErrNotExist
	}
	for _, dir := range filepath.SplitList(pathEnv) {
		full := filepath.Join(dir, file)
		if info, err := os.Stat(full); err == nil && !info.IsDir() && (info.Mode().Perm()&0111) != 0 {
			return full, nil
		}
	}
	return "", os.ErrNotExist
}
