// == CORE MISSION ==============================================
// cmd/root.go — Cobra root command + dispatcher
//
// Mirip parsing arg di bin/fe bash entrypoint.
// Hubungin semua internal package: config → session → tree/fzf/tmux.
// ==============================================================
package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"civil/goblin-vault/tools-cli/src/fex/internal/config"
	"civil/goblin-vault/tools-cli/src/fex/internal/session"

	"github.com/spf13/cobra"
)

// Build-time vars — diisi pas build (ldflags)
var (
	Version = "0.2.0"
	Date    = "2026-07-25"
)

// flagVars — holds parsed CLI flags
var (
	flagSearchMode   bool
	flagFindMode     bool
	flagTreeMode     bool
	flagBookmarkMode bool
	flagTargetDir    string
	flagExtFilter    string
)

// rootCmd — representasi dari flow bash: parsing arg, dispatcher, cleanup
var rootCmd = &cobra.Command{
	Use:   "fex [path] [extension]",
	Short: "fex — File Explorer with fzf + tmux split (Hybrid Go + Bash)",
	Long: "\n\x1b[1;37m  ██████╗███████╗██╗  ██╗\x1b[0m\n" +
		"\x1b[1;37m  ██╔═══╝██╔════╝╚██╗██╔╝\x1b[0m\n" +
		"\x1b[1;37m  █████╗ █████╗   ╚███╔╝ \x1b[0m\n" +
		"\x1b[1;37m  ██╔══╝ ██╔══╝   ██╔██╗ \x1b[0m\n" +
		"\x1b[1;37m  ██║    ███████╗██╔╝ ██╗\x1b[0m\n" +
		"\x1b[1;37m  ╚═╝    ╚══════╝╚═╝  ╚═╝\x1b[0m\n" +
		"  \x1b[1;37m   FEX File Explorer\x1b[0m\n\n" +
		`fex — File Explorer dengan fzf dan tmux split.
Hybrid architecture: Go manages config, state, routing, error handling.
Bash helpers handle external tool interaction (fzf, fd, rg, tmux, bat).

Usage:
  fex                    Explore folders (Tree Mode — default)
  fex <path>             Explore folders from <path>
  fex <extension>        Flat find filtered by extension (e.g. fex .go)
  fex <path> <extension> Both
  fex -f, --find         Flat file search across all subdirectories
  fex -s, --search [q]   Live interactive Ripgrep content search
  fex -t, --tree         Explore folders (explicit Tree mode)
  fex -b, --bookmarks    Browse bookmarked files
  fex -h, --help         Show help

Keybindings (in TUI):
  Navigation:
    Enter                Buka file di Editor / Masuk folder
    Esc                  Batal / Naik 1 direktori (Tree) / Kembali (Search)
    Tab                  Beralih mode instan (Tree Mode ⇄ Flat Find Mode)

  Clipboard & File Ops:
    Alt-c                Tandai untuk Salin (Copy)
    Alt-m                Tandai untuk Pindah (Move / Cut)
    Ctrl-v               Tempel (Paste) di direktori aktif
    Ctrl-r               Ganti nama (Rename) file/folder
    Ctrl-d               Hapus (Delete) file/folder
    Ctrl-n               Buat file baru (Tree mode)
    Ctrl-k               Buat folder baru (Tree mode)

  Search & Utilities:
    Ctrl-f               Live interactive search konten file (ripgrep)
    Ctrl-g               Buka lazygit (Tree mode) / File Git Diff Viewer (Find mode)
    Ctrl-y               Salin path ke clipboard OS (Universal OSC 52)
    Ctrl-b               Tambahkan ke Bookmarks
    Ctrl-x               Hapus dari Bookmarks
    Ctrl-o               Buka direktori di Tmux pane sebelah

  Preview & Help:
    Ctrl-p               Toggle preview pane
    Ctrl-s               Toggle fullscreen layout preview
    Ctrl-h, ?            Buka dialog panduan bantuan interaktif`,
	SilenceUsage:  true,
	SilenceErrors: true,
	Args:          cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// ── 1. Load config ──
		cfg, err := config.Load()
		if err != nil {
			return fmt.Errorf("config load: %w", err)
		}

		// ── 2. Parse positional args ──
		targetDir := "."
		extFilter := ""
		for _, arg := range args {
			if info, statErr := os.Stat(arg); statErr == nil && info.IsDir() {
				targetDir = arg
			} else {
				extFilter = arg
			}
		}
		if flagTargetDir != "" {
			targetDir = flagTargetDir
		}
		if flagExtFilter != "" {
			extFilter = flagExtFilter
		}

		// ── 3. Resolve absolute path ──
		absDir, err := filepath.Abs(targetDir)
		if err != nil {
			return fmt.Errorf("resolve path %s: %w", targetDir, err)
		}

		// ── 4. Init session ──
		sess := session.New(cfg, absDir)
		if err := sess.SetCwd(absDir); err != nil {
			return fmt.Errorf("session init: %w", err)
		}

		// ── 5. Dispatcher State Machine ──
		currentMode := "tree" // Default starts in Tree Mode
		prevMode := "tree"

		if flagBookmarkMode {
			currentMode = "bookmarks"
		} else if flagSearchMode {
			currentMode = "search"
			prevMode = "tree"
		} else if flagFindMode || extFilter != "" {
			currentMode = "find"
			prevMode = "tree"
		}

		for {
			switch currentMode {
			case "tree":
				prevMode = "tree"
				nextMode, err := runTreeMode(sess, sess.GetCwd())
				if err != nil || nextMode == "" {
					return err
				}
				currentMode = nextMode

			case "search":
				nextMode, err := runSearchMode(sess, "", prevMode)
				if err != nil || nextMode == "" {
					return err
				}
				if nextMode == "back" {
					currentMode = prevMode
				} else {
					currentMode = nextMode
				}

			case "bookmarks":
				return runBookmarksMode(sess)

			case "find":
				fallthrough
			default:
				prevMode = "find"
				nextMode, err := runFindMode(sess, sess.GetCwd(), extFilter, cfg, flagFindMode)
				if err != nil || nextMode == "" {
					return err
				}
				currentMode = nextMode
			}
		}
	},
}

// ── Execute ───────────────────────────────────────────────────

// Execute — entry point dipanggil dari cmd/fex/main.go
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// ── Init flags ────────────────────────────────────────────────

func init() {
	rootCmd.PersistentFlags().BoolVarP(&flagSearchMode, "search", "s", false, "Search file content (interactive or with query arg)")
	rootCmd.PersistentFlags().BoolVarP(&flagFindMode, "find", "f", false, "Browse files (explicit find mode)")
	rootCmd.PersistentFlags().BoolVarP(&flagTreeMode, "tree", "t", false, "Tree navigation (folder explorer)")
	rootCmd.PersistentFlags().BoolVarP(&flagBookmarkMode, "bookmarks", "b", false, "Browse bookmarked files")
	rootCmd.Flags().StringVar(&flagTargetDir, "dir", "", "Target directory (positional fallback)")
	rootCmd.Flags().StringVar(&flagExtFilter, "ext", "", "Extension filter (positional fallback)")
	rootCmd.Version = Version
}
