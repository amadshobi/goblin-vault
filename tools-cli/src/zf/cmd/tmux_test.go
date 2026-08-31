package cmd

import (
	"bytes"
	"strings"
	"testing"
)

func TestTmuxCmdFlagContracts(t *testing.T) {
	// Memastikan flag kontrak -i, -n, -d terdefinisi dengan NoOptDefVal agar tidak error saat dipanggil tanpa argumen (Issue #33)
	inFlag := tmuxCmd.Flags().Lookup("in")
	if inFlag == nil {
		t.Fatal("flag 'in' should exist on tmuxCmd")
	}
	if inFlag.Shorthand != "i" {
		t.Errorf("expected shorthand 'i', got %q", inFlag.Shorthand)
	}
	if inFlag.NoOptDefVal != interactiveOptVal {
		t.Errorf("expected NoOptDefVal to be %q, got %q", interactiveOptVal, inFlag.NoOptDefVal)
	}

	newFlag := tmuxCmd.Flags().Lookup("new")
	if newFlag == nil {
		t.Fatal("flag 'new' should exist on tmuxCmd")
	}
	if newFlag.Shorthand != "n" {
		t.Errorf("expected shorthand 'n', got %q", newFlag.Shorthand)
	}
	if newFlag.NoOptDefVal != interactiveOptVal {
		t.Errorf("expected NoOptDefVal to be %q, got %q", interactiveOptVal, newFlag.NoOptDefVal)
	}

	delFlag := tmuxCmd.Flags().Lookup("del")
	if delFlag == nil {
		t.Fatal("flag 'del' should exist on tmuxCmd")
	}
	if delFlag.Shorthand != "d" {
		t.Errorf("expected shorthand 'd', got %q", delFlag.Shorthand)
	}
	if delFlag.NoOptDefVal != interactiveOptVal {
		t.Errorf("expected NoOptDefVal to be %q, got %q", interactiveOptVal, delFlag.NoOptDefVal)
	}

	lsFlag := tmuxCmd.Flags().Lookup("ls")
	if lsFlag == nil {
		t.Fatal("flag 'ls' should exist on tmuxCmd")
	}
	if lsFlag.Shorthand != "l" {
		t.Errorf("expected shorthand 'l', got %q", lsFlag.Shorthand)
	}
}

func TestTmuxCmdUnknownSubcommand(t *testing.T) {
	buf := new(bytes.Buffer)
	tmuxCmd.SetOut(buf)
	tmuxCmd.SetErr(buf)

	err := tmuxCmd.RunE(tmuxCmd, []string{"invalid-subcommand"})
	if err == nil {
		t.Fatal("expected error for unknown subcommand, got nil")
	}
	if !strings.Contains(err.Error(), "unknown tmux command 'invalid-subcommand'") {
		t.Errorf("unexpected error message: %v", err)
	}
}
