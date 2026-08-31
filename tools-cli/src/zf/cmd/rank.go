package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/zoxide"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rankCmd = &cobra.Command{
	Use:     "rank",
	Aliases: []string{"r"},
	Short:   "Display indexed directories ordered by frecency score",
	Long: `ZF Rank — Zoxide Ranking Inspector (Level 2 Help)

Lists all indexed directories sorted by visit frecency score in descending order.
Clean format designed for pipeline filtering via fzf, grep, or automation scripts.

EXAMPLES:
  $ zf rank
  $ zf rank | head -n 10
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		client := zoxide.NewClient()
		entries, err := client.QueryScores()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			return err
		}

		if len(entries) == 0 {
			fmt.Println("Zoxide database is empty.")
			return nil
		}

		for _, e := range entries {
			fmt.Printf("%6.1f  %s\n", e.Score, e.Path)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(rankCmd)
}
