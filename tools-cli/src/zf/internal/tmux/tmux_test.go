package tmux

import (
	"testing"
)

func TestSanitizeSessionName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"my.project", "my_project"},
		{"space name", "space_name"},
		{"colon:name", "colon_name"},
	}

	for _, tt := range tests {
		got := sanitizeSessionName(tt.input)
		if got != tt.expected {
			t.Errorf("sanitizeSessionName(%q) = %q, expected %q", tt.input, got, tt.expected)
		}
	}
}
