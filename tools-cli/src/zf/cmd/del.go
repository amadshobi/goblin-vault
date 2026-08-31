package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/zoxide"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var delCmd = &cobra.Command{
	Use:     "del [path]",
	Aliases: []string{"d"},
	Short:   "Remove directory from Zoxide database",
	Long: `ZF Del — Zoxide Path Removal (Level 2 Help)

Removes directory path from Zoxide database index.
If invoked without arguments, launches interactive TUI for selection.

ARGUMENTS:
  [path]    Specific path to remove from database

EXAMPLES:
  $ zf del
  $ zf del ~/projects/deprecated-app
`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) == 0 {
			return RunTUI(false, "")
		}

		target := args[0]
		client := zoxide.NewClient()
		if err := client.Remove(target); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			return err
		}

		fmt.Printf("Directory '%s' removed from Zoxide database.\n", target)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(delCmd)
}
