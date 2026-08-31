package cmd

import (
	"strings"

	"github.com/spf13/cobra"
)

var execCmd = &cobra.Command{
	Use:     "exec <command>",
	Aliases: []string{"x"},
	Short:   "Select workspace via TUI and execute custom command",
	Long: `ZF Exec — Targeted Command Launcher (Level 2 Help)

Launches interactive TUI to pick a workspace, then navigates to target directory
and executes the specified command.

ARGUMENTS:
  <command>   Command or script to execute in selected workspace

EXAMPLES:
  $ zf exec "cargo build"
  $ zf exec "npm test"
  $ zf exec "git status"
`,
	Args: cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		commandToRun := strings.Join(args, " ")
		return RunTUI(flagPick, commandToRun)
	},
}

func init() {
	rootCmd.AddCommand(execCmd)
}
