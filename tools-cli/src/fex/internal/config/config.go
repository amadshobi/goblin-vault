// == CORE MISSION ==============================================
// internal/config/config.go — Config Loader + Defaults
//
// Basi dari config.sh: tool detection, preview command,
// find depth, editor chain, bookmarks path.
//
// Pake viper buat load YAML dari ~/.config/fe/config.yaml.
// Fallback default config kalo file ga ada.
// ==============================================================
package config

import (
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

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
	TmuxPrefix   string `mapstructure:"tmux_prefix"`   // misal: C-b, C-a
	TmuxSplitPct int    `mapstructure:"tmux_split_pct"` // default 30

	// FZF
	FzfOpts map[string]string `mapstructure:"fzf_opts"` // keybinding overrides

	// Layout
	PreviewSize string `mapstructure:"preview_size"` // responsive, auto-detect dari terminal height
}

// DefaultConfig — fallback values kalo file config ga ada.
// Nilai-nilai ini nyocokin sama default dari config.sh.
func DefaultConfig() *Config {
	home, _ := os.UserHomeDir()
	return &Config{
		BookmarksFile: filepath.Join(home, ".cache", "fe-bookmarks"),
		ConfigHome:    filepath.Join(home, ".config", "fe"),
		FindDepth:     5,
		FindFilter:    `-not -path "*/.npm/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" -not -path "*/vendor/*" -not -path "*/target/debug/*" -not -path "*/dist/*"`,
		PreviewCmd:    "", // auto-detect di Init()
		UseFd:         false,
		Editor:        "", // auto-detect
		TmuxPrefix:    "C-b",
		TmuxSplitPct:  30,
		FzfOpts:       map[string]string{},
		PreviewSize:   "up:75%",
	}
}

// Load — load YAML config dari ~/.config/fe/config.yaml.
// Kalo file ga ada, init default + create file.
func Load() (*Config, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	configDir := filepath.Join(home, ".config", "fe")
	configFile := filepath.Join(configDir, "config.yaml")

	// Ensure config dir exists
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}

	v := viper.New()
	v.SetConfigFile(configFile)
	v.SetConfigType("yaml")

	// Bind env vars (uppercase, underscore)
	v.SetEnvPrefix("FE")
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

	// Try read config file
	if _, err := os.Stat(configFile); err == nil {
		if err := v.ReadInConfig(); err != nil {
			return nil, err
		}
	} else {
		// File ga ada — write default config
		if err := v.SafeWriteConfigAs(configFile); err != nil {
			// Non-fatal: maybe concurrent write, just log
			// TODO: log warning
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
