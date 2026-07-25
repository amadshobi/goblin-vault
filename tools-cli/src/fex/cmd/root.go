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
	Long: `fex — File Explorer dengan fzf dan tmux split.
Hybrid architecture: Go manages config, state, routing, error handling.
Bash helpers handle external tool interaction (fzf, fd, rg, tmux, bat).

Usage:
  fex                    Browse files from current directory
  fex <path>             Browse files from <path>
  fex <extension>        Filter by extension (e.g. fex .js)
  fex <path> <extension> Both
  fex --search <query>   Search file content
  fex --tree             Tree navigation (folder explorer)
  fex --bookmarks        Browse bookmarked files
  fex -h, --help         Show help`,
	SilenceUsage:  true,
	SilenceErrors: true,
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

		// ── 5. Dispatcher ──
		switch {
		case flagTreeMode:
			return runTreeMode(sess, absDir)

		case flagBookmarkMode:
			return runBookmarksMode(sess)

		case flagSearchMode:
			return runSearchMode(sess, "")

		case flagFindMode:
			return runFindMode(sess, absDir, extFilter, cfg, true)

		default:
			return runFindMode(sess, absDir, extFilter, cfg, false)
		}
	},
}

// ── Execute ───────────────────────────────────────────────────

// Execute — entry point dipanggil dari cmd/fe/main.go
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
