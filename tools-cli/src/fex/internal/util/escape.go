// Package util provides shared utility functions for fex.
package util

import "strings"

// ShEscape wraps a string in single quotes, escaping internal single quotes.
// This is used for safe shell argument quoting.
func ShEscape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'"
}
