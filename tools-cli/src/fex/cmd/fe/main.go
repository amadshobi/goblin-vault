// == CORE MISSION ==============================================
// fex — File Explorer with fzf + tmux split (Hybrid Go + Bash)
// Letak: cmd/fe/main.go
//
// Entry point Go. Cobra-based CLI framework.
// Panggil via: go run ./cmd/fe/ -- atau build + jalankan binary
// ==============================================================
package main

import "civil/goblin-vault/tools-cli/src/fex/cmd"

func main() {
	cmd.Execute()
}
