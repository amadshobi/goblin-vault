package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/zoxide"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var addCmd = &cobra.Command{
	Use:     "add [path]",
	Aliases: []string{"a"},
	Short:   "Register directory into Zoxide database",
	Long: `ZF Add — Zoxide Database Registration (Level 2 Help)

Registers directory path into Zoxide index for instant jumping and ranking.

ARGUMENTS:
  [path]    Directory path to index (default: current working directory)

EXAMPLES:
  $ zf add
  $ zf add ~/projects/my-cool-app
`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		target := "."
		if len(args) > 0 {
			target = args[0]
		}

		client := zoxide.NewClient()
		if err := client.Add(target); err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			return err
		}

		fmt.Printf("Directory '%s' registered into Zoxide database.\n", target)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(addCmd)
}
