package zoxide

import (
	"testing"
)

func TestCreateEntryWithHome(t *testing.T) {
	home := "/home/user"
	path := "/home/user/civil/project"
	score := 42.5
	rank := 1

	entry := createEntryWithHome(path, score, rank, home)
	if entry.DisplayPath != "~/civil/project" {
		t.Errorf("Expected DisplayPath to be '~/civil/project', got '%s'", entry.DisplayPath)
	}
	if entry.Score != score {
		t.Errorf("Expected Score to be %f, got %f", score, entry.Score)
	}
	if entry.Rank != rank {
		t.Errorf("Expected Rank to be %d, got %d", rank, entry.Rank)
	}
}
