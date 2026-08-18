package cmd

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestClipboardFlow(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "fex-test-*")
	if err != nil {
		t.Fatalf("MkdirTemp failed: %v", err)
	}
	defer os.RemoveAll(tempDir)

	srcDir := filepath.Join(tempDir, "src")
	dstDir := filepath.Join(tempDir, "dst")
	_ = os.MkdirAll(srcDir, 0755)
	_ = os.MkdirAll(dstDir, 0755)

	testFile := filepath.Join(srcDir, "sample.txt")
	testContent := "Hello FEX Clipboard!"
	if err := os.WriteFile(testFile, []byte(testContent), 0644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	// 1. Test Mark Copy
	if err := MarkClipboard(testFile, ClipActionCopy); err != nil {
		t.Fatalf("MarkClipboard copy failed: %v", err)
	}

	item, err := ReadClipboard()
	if err != nil || item == nil {
		t.Fatalf("ReadClipboard failed: %v", err)
	}
	if item.Action != ClipActionCopy || item.Filename != "sample.txt" {
		t.Errorf("Unexpected item: %+v", item)
	}

	badge := GetClipboardBadge()
	if !strings.Contains(badge, "sample.txt") || !strings.Contains(badge, "Copy") {
		t.Errorf("Unexpected badge: %s", badge)
	}

	// 2. Test Paste Copy
	msg, err := ExecutePaste(dstDir)
	if err != nil {
		t.Fatalf("ExecutePaste copy failed: %v", err)
	}
	if !strings.Contains(msg, "Copied") {
		t.Errorf("Unexpected msg: %s", msg)
	}

	// Verify destination file
	copiedFile := filepath.Join(dstDir, "sample.txt")
	copiedContent, err := os.ReadFile(copiedFile)
	if err != nil || string(copiedContent) != testContent {
		t.Errorf("Copied content mismatch: %s", string(copiedContent))
	}
	// Source file should still exist
	if _, err := os.Stat(testFile); err != nil {
		t.Errorf("Source file should exist after copy")
	}

	// 3. Test Mark Move
	if err := MarkClipboard(testFile, ClipActionMove); err != nil {
		t.Fatalf("MarkClipboard move failed: %v", err)
	}

	moveDstDir := filepath.Join(tempDir, "moved_dst")
	_ = os.MkdirAll(moveDstDir, 0755)

	msg, err = ExecutePaste(moveDstDir)
	if err != nil {
		t.Fatalf("ExecutePaste move failed: %v", err)
	}
	if !strings.Contains(msg, "Moved") {
		t.Errorf("Unexpected move msg: %s", msg)
	}

	// Source file should NOT exist after move
	if _, err := os.Stat(testFile); !os.IsNotExist(err) {
		t.Errorf("Source file should NOT exist after move")
	}

	// Destination file should exist
	movedFile := filepath.Join(moveDstDir, "sample.txt")
	movedContent, err := os.ReadFile(movedFile)
	if err != nil || string(movedContent) != testContent {
		t.Errorf("Moved content mismatch: %s", string(movedContent))
	}

	// Clipboard should be cleared after move
	clipAfterMove, _ := ReadClipboard()
	if clipAfterMove != nil {
		t.Errorf("Clipboard should be empty after move")
	}
}
