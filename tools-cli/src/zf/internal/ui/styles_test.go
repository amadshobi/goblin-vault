package ui

import (
	"strings"
	"testing"

	xansi "github.com/charmbracelet/x/ansi"
)

func TestDisplayWidthDefaults(t *testing.T) {
	SetGlyphWidths(map[rune]int{})
	tests := []struct {
		name string
		in   string
		want int
	}{
		{"ascii", "abc", 3},
		{"ansi styled ascii", "\x1b[31mabc\x1b[0m", 3},
		{"empty", "", 0},
	}
	for _, tt := range tests {
		if got := DisplayWidth(tt.in); got != tt.want {
			t.Errorf("%s: DisplayWidth(%q) = %d, want %d", tt.name, tt.in, got, tt.want)
		}
	}
}

func TestDisplayWidthUsesCalibrationTable(t *testing.T) {
	icon := "\U000F021A"
	iconRune := []rune(icon)[0]

	SetGlyphWidths(map[rune]int{iconRune: 2})
	if got := DisplayWidth(icon + "x"); got != 3 {
		t.Errorf("calibrated wide icon: DisplayWidth = %d, want 3", got)
	}

	SetGlyphWidths(map[rune]int{iconRune: 1})
	if got := DisplayWidth(icon + "x"); got != 2 {
		t.Errorf("calibrated narrow icon: DisplayWidth = %d, want 2", got)
	}

	SetGlyphWidths(map[rune]int{})
}

func TestNerdClamp(t *testing.T) {
	SetGlyphWidths(map[rune]int{[]rune("\U000F021A")[0]: 2})
	defer SetGlyphWidths(map[rune]int{})

	icon := "\U000F021A"
	long := "  " + icon + " " + strings.Repeat("x", 100)

	got := NerdClamp(long, 20)
	if w := DisplayWidth(got); w > 20 {
		t.Errorf("NerdClamp width = %d, want <= 20", w)
	}
	if NerdClamp("abc", 10) != "abc" {
		t.Error("NerdClamp should not touch short strings")
	}
	if NerdClamp("", 5) != "" {
		t.Error("NerdClamp empty string mismatch")
	}
}

func TestDecoratePaneAlignment(t *testing.T) {
	icon := "\U000F021A"
	width, height := 40, 8

	content := strings.Join([]string{
		"  " + icon + " short row",
		"  plain ascii row without icons",
		"  " + icon + " " + strings.Repeat("long", 30),
		"",
	}, "\n")

	// Invarian harus berlaku di semua skenario lebar glyph: narrow, wide, default
	scenarios := map[string]map[rune]int{
		"narrow icons":   {[]rune(icon)[0]: 1},
		"wide icons":     {[]rune(icon)[0]: 2},
		"default tables": {},
	}
	for name, table := range scenarios {
		t.Run(name, func(t *testing.T) {
			SetGlyphWidths(table)
			defer SetGlyphWidths(map[rune]int{})

			out := DecoratePane(content, width, height, true, icon+" Title")
			lines := strings.Split(out, "\n")

			if len(lines) != height {
				t.Fatalf("line count = %d, want %d", len(lines), height)
			}
			for i, line := range lines {
				if w := DisplayWidth(line); w != width {
					t.Errorf("line %d DisplayWidth = %d, want %d (border would be jagged)", i, w, width)
				}
			}
		})
	}
}

func TestDecoratePaneXansiNeverExceeds(t *testing.T) {
	SetGlyphWidths(map[rune]int{})
	defer SetGlyphWidths(map[rune]int{})

	icon := "\uE725"
	width, height := 30, 5

	content := "  " + icon + " row with icon\n  second row"
	out := DecoratePane(content, width, height, false, "")
	for i, line := range strings.Split(out, "\n") {
		if w := xansi.StringWidth(line); w > width+4 {
			t.Errorf("line %d raw width = %d, unreasonably exceeds pane width %d", i, w, width)
		}
	}
}
