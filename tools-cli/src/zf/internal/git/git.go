package git

import (
	"bytes"
	"context"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// FileDiff menyimpan status satu file pada git repo (M, A, D, ?, R)
type FileDiff struct {
	Status string // "M", "A", "D", "?", "R"
	Path   string
}

// Snapshot menyimpan informasi status ringkas git di suatu direktori
type Snapshot struct {
	IsRepo    bool
	Branch    string
	Staged    int
	Unstaged  int
	Untracked int
	ShortHash string
	Message   string
	RelTime   string
	Author    string
	Ahead     int
	Behind    int
	Files     []FileDiff // Daftar file yang modified/staged/untracked
}

// GetSnapshot mengambil status git secara asynchronous & aman dengan timeout
func GetSnapshot(dir string) Snapshot {
	ctx, cancel := context.WithTimeout(context.Background(), 750*time.Millisecond)
	defer cancel()

	// Cek apakah direktori merupakan git worktree/repo
	checkCmd := exec.CommandContext(ctx, "git", "-C", dir, "rev-parse", "--is-inside-work-tree")
	if err := checkCmd.Run(); err != nil {
		return Snapshot{IsRepo: false}
	}

	snap := Snapshot{IsRepo: true}

	// 1. Branch
	branchCmd := exec.CommandContext(ctx, "git", "-C", dir, "branch", "--show-current")
	var bOut bytes.Buffer
	branchCmd.Stdout = &bOut
	if err := branchCmd.Run(); err == nil {
		snap.Branch = strings.TrimSpace(bOut.String())
	}
	if snap.Branch == "" {
		// Fallback ke short HEAD jika detached
		headCmd := exec.CommandContext(ctx, "git", "-C", dir, "rev-parse", "--short", "HEAD")
		var hOut bytes.Buffer
		headCmd.Stdout = &hOut
		if err := headCmd.Run(); err == nil {
			snap.Branch = strings.TrimSpace(hOut.String())
		}
	}

	// 2. Commit Info (Hash, RelTime, Author, Message)
	logCmd := exec.CommandContext(ctx, "git", "-C", dir, "log", "-1", "--format=%h%x00%cr%x00%an%x00%s")
	var lOut bytes.Buffer
	logCmd.Stdout = &lOut
	if err := logCmd.Run(); err == nil {
		parts := strings.Split(strings.TrimSpace(lOut.String()), "\x00")
		if len(parts) >= 4 {
			snap.ShortHash = parts[0]
			snap.RelTime = parts[1]
			snap.Author = parts[2]
			snap.Message = parts[3]
		}
	}

	// 3. Status Counts & File Diffs
	statusCmd := exec.CommandContext(ctx, "git", "-C", dir, "status", "--porcelain")
	var sOut bytes.Buffer
	statusCmd.Stdout = &sOut
	if err := statusCmd.Run(); err == nil {
		lines := strings.Split(strings.TrimSpace(sOut.String()), "\n")
		for _, l := range lines {
			if len(l) < 3 {
				continue
			}
			x := l[0]
			y := l[1]
			filePath := strings.TrimSpace(l[3:])

			// Status tag
			statusTag := "M"
			if x == '?' && y == '?' {
				snap.Untracked++
				statusTag = "?"
			} else {
				if x == 'A' || y == 'A' {
					statusTag = "A"
				} else if x == 'D' || y == 'D' {
					statusTag = "D"
				} else if x == 'R' || y == 'R' {
					statusTag = "R"
				} else {
					statusTag = "M"
				}

				if x != ' ' && x != '?' {
					snap.Staged++
				}
				if y != ' ' && y != '?' {
					snap.Unstaged++
				}
			}

			// Simpan daftar file ringkas
			snap.Files = append(snap.Files, FileDiff{
				Status: statusTag,
				Path:   filepath.Clean(filePath),
			})
		}
	}

	// 4. Ahead / Behind upstream
	revCmd := exec.CommandContext(ctx, "git", "-C", dir, "rev-list", "--left-right", "--count", "@{upstream}...HEAD")
	var rOut bytes.Buffer
	revCmd.Stdout = &rOut
	if err := revCmd.Run(); err == nil {
		counts := strings.Fields(strings.TrimSpace(rOut.String()))
		if len(counts) >= 2 {
			behind, _ := strconv.Atoi(counts[0])
			ahead, _ := strconv.Atoi(counts[1])
			snap.Behind = behind
			snap.Ahead = ahead
		}
	}

	return snap
}
