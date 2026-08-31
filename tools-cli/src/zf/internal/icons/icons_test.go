package icons

import (
	"testing"
)

func TestIconsForFile(t *testing.T) {
	tests := []struct {
		name     string
		isDir    bool
		expected string
	}{
		{"src", true, DirClosed},
		{"main.go", false, FileGo},
		{"Cargo.toml", false, FileRust},
		{"package.json", false, FileJS},
		{"README.md", false, FileMarkdown},
		{"script.sh", false, FileShell},
		{"config.yaml", false, FileConfig},
	}

	for _, tt := range tests {
		got := ForFile(tt.name, tt.isDir)
		if got != tt.expected {
			t.Errorf("ForFile(%q, %v) = %q, expected %q", tt.name, tt.isDir, got, tt.expected)
		}
	}
}
