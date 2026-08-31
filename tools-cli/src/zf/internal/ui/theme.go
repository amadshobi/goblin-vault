package ui

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/termenv"
)

// Theme mendefinisikan schema tema sederhana berbasis JSON/YAML
type Theme struct {
	Name           string `json:"name"`
	Border         string `json:"border"`
	BorderDim      string `json:"border_dim"`
	PathSelected   string `json:"path_selected"`
	PathUnselected string `json:"path_unselected"`
	Git            string `json:"git"`
	FileSelected   string `json:"file_selected"`
	FileUnselected string `json:"file_unselected"`
	BgSelected     string `json:"bg_selected"`
}

// Builtin Default Themes
var BuiltinThemes = []Theme{
	{
		Name:           "Monokai",
		Border:         "#A6E22E",
		BorderDim:      "#49483E",
		PathSelected:   "#FD971F",
		PathUnselected: "#F8F8F2",
		Git:            "#A6E22E",
		FileSelected:   "#66D9EF",
		FileUnselected: "#F8F8F2",
		BgSelected:     "#3E3D32",
	},
	{
		Name:           "Catppuccin",
		Border:         "#CBA6F7",
		BorderDim:      "#45475A",
		PathSelected:   "#FAB387",
		PathUnselected: "#CDD6F4",
		Git:            "#A6E3A1",
		FileSelected:   "#89B4FA",
		FileUnselected: "#CDD6F4",
		BgSelected:     "#313244",
	},
	{
		Name:           "TokyoNight",
		Border:         "#7AA2F7",
		BorderDim:      "#414868",
		PathSelected:   "#E0AF68",
		PathUnselected: "#C0CAF5",
		Git:            "#9ECE6A",
		FileSelected:   "#7DCFFF",
		FileUnselected: "#C0CAF5",
		BgSelected:     "#283457",
	},
	{
		Name:           "Nord",
		Border:         "#88C0D0",
		BorderDim:      "#4C566A",
		PathSelected:   "#EBCB8B",
		PathUnselected: "#ECEFF4",
		Git:            "#A3BE8C",
		FileSelected:   "#81A1C1",
		FileUnselected: "#ECEFF4",
		BgSelected:     "#3B4252",
	},
	{
		Name:           "Gruvbox",
		Border:         "#FABD2F",
		BorderDim:      "#504945",
		PathSelected:   "#FE8019",
		PathUnselected: "#EBDBB2",
		Git:            "#B8BB26",
		FileSelected:   "#83A598",
		FileUnselected: "#EBDBB2",
		BgSelected:     "#3C3836",
	},
}

var (
	CurrentTheme Theme
	AllThemes    []Theme
)

func init() {
	lipgloss.SetColorProfile(termenv.TrueColor)
	lipgloss.DefaultRenderer().SetOutput(termenv.NewOutput(os.Stderr))
	ReloadThemes()
}

// ConfigDir returns ~/.config/zf
func ConfigDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "zf")
}

// ThemesDir returns ~/.config/zf/themes
func ThemesDir() string {
	return filepath.Join(ConfigDir(), "themes")
}

// EnsureDefaultThemes populates ~/.config/zf/themes with JSON files if they don't exist
func EnsureDefaultThemes() {
	dir := ThemesDir()
	_ = os.MkdirAll(dir, 0755)

	for _, t := range BuiltinThemes {
		file := filepath.Join(dir, strings.ToLower(t.Name)+".json")
		if _, err := os.Stat(file); os.IsNotExist(err) {
			data, _ := json.MarshalIndent(t, "", "  ")
			_ = os.WriteFile(file, data, 0644)
		}
	}
}

// ReloadThemes loads all themes from ~/.config/zf/themes and default config
func ReloadThemes() {
	EnsureDefaultThemes()

	var loaded []Theme
	files, err := filepath.Glob(filepath.Join(ThemesDir(), "*.json"))
	if err == nil && len(files) > 0 {
		for _, f := range files {
			data, rErr := os.ReadFile(f)
			if rErr == nil {
				var t Theme
				if jErr := json.Unmarshal(data, &t); jErr == nil && t.Name != "" {
					loaded = append(loaded, t)
				}
			}
		}
	}

	if len(loaded) == 0 {
		loaded = BuiltinThemes
	}
	AllThemes = loaded

	// Load active theme from ~/.config/zf/config.json
	activeThemeName := "Catppuccin"
	cfgFile := filepath.Join(ConfigDir(), "config.json")
	if cfgData, err := os.ReadFile(cfgFile); err == nil {
		var cfg struct {
			Theme string `json:"theme"`
		}
		if err := json.Unmarshal(cfgData, &cfg); err == nil && cfg.Theme != "" {
			activeThemeName = cfg.Theme
		}
	}

	SetTheme(activeThemeName)
}

// SetTheme sets the active theme by name
func SetTheme(name string) {
	lower := strings.ToLower(name)
	for _, t := range AllThemes {
		if strings.ToLower(t.Name) == lower || strings.ToLower(filepath.Base(t.Name)) == lower {
			CurrentTheme = t
			saveConfig(t.Name)
			return
		}
	}
	if len(AllThemes) > 0 {
		CurrentTheme = AllThemes[0]
		saveConfig(CurrentTheme.Name)
	}
}

func saveConfig(themeName string) {
	dir := ConfigDir()
	_ = os.MkdirAll(dir, 0755)
	cfgFile := filepath.Join(dir, "config.json")

	payload, _ := json.MarshalIndent(map[string]string{"theme": themeName}, "", "  ")
	_ = os.WriteFile(cfgFile, payload, 0644)
}

// Color parses string hex or name into lipgloss.Color
func (t Theme) Color(val string) lipgloss.Color {
	if val == "" {
		return lipgloss.Color("#FFFFFF")
	}
	return lipgloss.Color(val)
}
