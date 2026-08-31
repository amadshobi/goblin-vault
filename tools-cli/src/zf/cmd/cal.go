package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/icons"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"
	"sort"

	xansi "github.com/charmbracelet/x/ansi"
	"github.com/spf13/cobra"
)

// calCmd adalah perintah diagnosa tersembunyi untuk memverifikasi kalibrasi
// lebar glyph di terminal aktif — dipakai untuk debugging border alignment.
var calCmd = &cobra.Command{
	Use:    "cal",
	Short:  "Diagnosa kalibrasi lebar glyph terminal",
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		glyphs := append(icons.All(), []rune("│─╭╮╰╯…·●↑↓")...)

		fmt.Println("== zf glyph calibration ==")
		m, log := ui.MeasureGlyphWidthsWithLog(glyphs)
		for _, l := range log {
			fmt.Println(l)
		}

		fmt.Printf("\n-- tabel hasil (%d rune) --\n", len(m))
		keys := make([]rune, 0, len(m))
		for r := range m {
			keys = append(keys, r)
		}
		sort.Slice(keys, func(i, j int) bool { return keys[i] < keys[j] })
		for _, r := range keys {
			fmt.Printf("U+%05X -> %d\n", r, m[r])
		}

		fmt.Printf("\n-- sampel baris (target: semua %d kolom) --\n", 40)
		ui.SetGlyphWidths(m)
		rows := []string{
			"  \U000F021A sample icon row",
			"  plain ascii row",
			"\uE725 bmp pua row",
		}
		for i, row := range rows {
			fmt.Printf("row %d: nerd=%d raw=%d |%s\n", i,
				ui.DisplayWidth(row), xansi.StringWidth(row), row)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(calCmd)
}
