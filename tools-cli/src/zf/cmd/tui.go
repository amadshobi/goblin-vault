package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/app"
	"civil/goblin-vault/tools-cli/src/zf/internal/icons"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
)

// RunTUI menjalankan Bubble Tea interactive session
func RunTUI(pickMode bool, actionPrefix string) error {
	// Kalibrasi lebar glyph langsung ke terminal sebelum TUI start: ikon,
	// box-drawing, dan simbol lain diukur render aktualnya sehingga layout
	// presisi di terminal/font apa pun (Termius, kitty, dll).
	glyphs := append(icons.All(), []rune("│─╭╮╰╯…·●↑↓")...)
	ui.SetGlyphWidths(ui.MeasureGlyphWidths(glyphs))

	m := app.NewModel(pickMode, actionPrefix)

	// Pastikan TUI me-render ke os.Stderr agar stdout bersih untuk ditangkap wrapper shell $(...)
	p := tea.NewProgram(
		m,
		tea.WithAltScreen(),
		tea.WithOutput(os.Stderr),
	)

	finalModel, err := p.Run()
	if err != nil {
		return err
	}

	resModel, ok := finalModel.(app.Model)
	if !ok {
		return nil
	}

	if resModel.ChosenPath == "" {
		return nil
	}

	// Output protocol: jika mode --pick, print hasil ke stdout
	if pickMode {
		if resModel.ChosenAction != "" && resModel.ChosenAction != actionPrefix {
			fmt.Printf("%s\t%s\n", resModel.ChosenPath, resModel.ChosenAction)
		} else if actionPrefix != "" {
			fmt.Printf("%s\t%s\n", resModel.ChosenPath, actionPrefix)
		} else {
			fmt.Println(resModel.ChosenPath)
		}
		return nil
	}

	// Jika dijalankan langsung tanpa wrapper shell dan ada action yang dipilih
	if resModel.ChosenAction != "" {
		if err := os.Chdir(resModel.ChosenPath); err != nil {
			return fmt.Errorf("gagal berpindah ke direktori '%s': %w", resModel.ChosenPath, err)
		}
		return resModel.ExecuteFinalAction()
	}

	// Tampilkan path ke stdout
	fmt.Println(resModel.ChosenPath)
	return nil
}
