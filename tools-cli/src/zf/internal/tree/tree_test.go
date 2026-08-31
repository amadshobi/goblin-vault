package tree

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBuildTree(t *testing.T) {
	temp := t.TempDir()

	_ = os.Mkdir(filepath.Join(temp, "subfolder"), 0755)
	_ = os.WriteFile(filepath.Join(temp, "main.go"), []byte("package main"), 0644)
	_ = os.WriteFile(filepath.Join(temp, "README.md"), []byte("# Hello"), 0644)

	nodes := BuildTree(temp, 2)
	if len(nodes) != 3 {
		t.Errorf("Expected 3 items in root, got %d", len(nodes))
	}
}
