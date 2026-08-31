package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"

	"github.com/spf13/cobra"
)

var (
	// Version details
	Version = "2.0.0"
	Commit  = "none"
	Date    = "unknown"

	// Action launch flags
	flagFex     bool
	flagGb      bool
	flagLg      bool
	flagCode    bool
	flagTmux    bool
	flagExec    string
	flagTheme   string
	flagPick    bool
	flagVersion bool
)

var helpMessage = ui.BannerText() + `Rapid directory navigation and workspace launcher powered by Zoxide & Tmux.
Features interactive 3-pane TUI, Git Inspector, File Tree, and shell integration.

USAGE:
  zf [flags]
  zf [command]

CORE COMMANDS:
  init [shell]      Generate shell integration hook (zsh, bash, fish)
  add  [path]       Register directory into Zoxide database (default: $PWD)
  del  [path]       Remove directory from database (interactive if empty)
  rank              Display indexed directories ordered by frecency score
  tm   [flags]      Manage Tmux sessions (aliases: tmux) [-l, -n, -i, -d]
  exec <cmd>        Select workspace via TUI and execute command

ACTION FLAGS (Jump & Launch):
  -f, --fex           Jump to workspace and launch Fex
  -g, --gb            Jump to workspace and launch GitHub Assistant (gb)
  -l, --lg            Jump to workspace and launch LazyGit
  -c, --code          Jump to workspace and open in VS Code
  -t, --tmux          Jump to workspace and open/create Tmux session
  -x, --exec <cmd>    Jump to workspace and execute custom command

CONFIGURATION & OPTIONS:
      --theme <name>  Set TUI theme palette (catppuccin, tokyonight, monokai, nord, gruvbox)
  -v, --version       Display version information
  -h, --help          Display help overview

LEARN MORE:
  Use 'zf <command> --help' for detailed sub-command documentation (Level 2 Help).
  Add 'eval "$(zf init zsh)"' to your ~/.zshrc for instant parent-shell navigation.
`

var rootCmd = &cobra.Command{
	Use:           "zf [flags] [command]",
	Short:         "Rapid Directory Navigation & Workspace Launcher",
	SilenceUsage:  true,
	SilenceErrors: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if flagVersion {
			if Commit != "none" && Date != "unknown" {
				fmt.Printf("zf v%s (commit: %s, date: %s)\n", Version, Commit, Date)
			} else {
				fmt.Printf("zf v%s\n", Version)
			}
			return nil
		}

		if flagTheme != "" {
			ui.SetTheme(flagTheme)
		}

		// Fast action flags
		action := ""
		switch {
		case flagFex:
			action = "fex"
		case flagGb:
			action = "gb"
		case flagLg:
			action = "lazygit"
		case flagCode:
			action = "code ."
		case flagTmux:
			action = "tmux"
		case flagExec != "":
			action = flagExec
		}

		return RunTUI(flagPick, action)
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.SetHelpFunc(func(cmd *cobra.Command, args []string) {
		if cmd == rootCmd {
			fmt.Print(helpMessage)
		} else if cmd.Long != "" {
			fmt.Print(cmd.Long)
		} else {
			_ = cmd.Usage()
		}
	})

	rootCmd.Flags().BoolVarP(&flagFex, "fex", "f", false, "Jump to workspace and launch Fex")
	rootCmd.Flags().BoolVarP(&flagGb, "gb", "g", false, "Jump to workspace and launch GitHub Assistant")
	rootCmd.Flags().BoolVarP(&flagLg, "lg", "l", false, "Jump to workspace and launch LazyGit")
	rootCmd.Flags().BoolVarP(&flagCode, "code", "c", false, "Jump to workspace and open in VS Code")
	rootCmd.Flags().BoolVarP(&flagTmux, "tmux", "t", false, "Jump to workspace and open/create Tmux session")
	rootCmd.Flags().StringVarP(&flagExec, "exec", "x", "", "Jump to workspace and execute custom command")
	rootCmd.Flags().StringVar(&flagTheme, "theme", "", "Set TUI theme palette (catppuccin, tokyonight, monokai, nord, gruvbox)")
	rootCmd.Flags().BoolVar(&flagPick, "pick", false, "Machine-readable output mode for shell wrapper")
	rootCmd.Flags().BoolVarP(&flagVersion, "version", "v", false, "Display version information")

	rootCmd.Flags().MarkHidden("pick")
}
