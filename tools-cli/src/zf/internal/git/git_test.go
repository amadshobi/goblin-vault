package git

import (
	"testing"
)

func TestGetSnapshotNonRepo(t *testing.T) {
	snap := GetSnapshot(t.TempDir())
	if snap.IsRepo {
		t.Errorf("Expected IsRepo to be false for temp directory")
	}
}
