// == CORE MISSION ==============================================
// cmd/backup.go — Backup & restore configs to/from goblin-vault
//
// Usage:
//   fex backup micro    — backup micro config → goblin-vault/configs/micro/
//   fex restore micro   — restore micro config → ~/.config/micro/
// ==============================================================
package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

// ── Goblin Vault root ────────────────────────────────────────
func goblinVaultRoot() string {
	if root := os.Getenv("CIVIL_HOME"); root != "" {
		return root
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join("/home/shobixlinuxdev", "civil", "goblin-vault")
	}
	return filepath.Join(home, "civil", "goblin-vault")
}

// ── Tracked micro config files ──────────────────────────────
var trackedMicroFiles = []struct {
	srcRel string // relative to ~/.config/micro/ (source for backup, dest for restore)
	dstRel string // relative to configs/micro/ (dest for backup, source for restore)
}{
	{srcRel: "settings.json", dstRel: "settings.json"},
	{srcRel: "bindings.json", dstRel: "bindings.json"},
	{srcRel: "init.lua", dstRel: "init.lua"},
	{srcRel: "palettero.cfg", dstRel: "palettero.cfg"},
	{srcRel: "goblin-help.md", dstRel: "goblin-help.md"},
	{srcRel: "colorschemes/darcula-glass.micro", dstRel: "colorschemes/darcula-glass.micro"},
	{srcRel: "colorschemes/darcula-goblin.micro", dstRel: "colorschemes/darcula-goblin.micro"},
	{srcRel: "plug/filemanager/filemanager.lua", dstRel: "plug/filemanager/filemanager.lua"},
	{srcRel: "plug/filemanager/syntax.yaml", dstRel: "plug/filemanager/syntax.yaml"},
	{srcRel: "plug/filemanager/repo.json", dstRel: "plug/filemanager/repo.json"},
}

// ── copyFile — copy file, creating parent dirs if needed ─────
func copyFile(src, dst string) error {
	// Create parent directory
	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	data, err := os.ReadFile(src)
	if err != nil {
		return fmt.Errorf("read %s: %w", src, err)
	}

	if err := os.WriteFile(dst, data, 0644); err != nil {
		return fmt.Errorf("write %s: %w", dst, err)
	}
	return nil
}

// ── resolveMicroDirs ─────────────────────────────────────────
func resolveMicroDirs() (configDir string, vaultDir string, err error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", fmt.Errorf("home dir: %w", err)
	}
	configDir = filepath.Join(home, ".config", "micro")
	vaultDir = filepath.Join(goblinVaultRoot(), "configs", "micro")
	return configDir, vaultDir, nil
}

// ── backupMicro — copy ~/.config/micro/ → configs/micro/ ─────
func runBackupMicro(cmd *cobra.Command, args []string) error {
	configDir, vaultDir, err := resolveMicroDirs()
	if err != nil {
		return err
	}

	var copied int
	for _, f := range trackedMicroFiles {
		src := filepath.Join(configDir, f.srcRel)
		dst := filepath.Join(vaultDir, f.dstRel)

		// Skip if source doesn't exist
		if _, err := os.Stat(src); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  ⏭  skip (not found): %s\n", f.srcRel)
			continue
		}

		if err := copyFile(src, dst); err != nil {
			fmt.Fprintf(os.Stderr, "  ❌  %s\n", err)
			continue
		}
		fmt.Fprintf(os.Stderr, "  ✅  %s\n", f.srcRel)
		copied++
	}

	fmt.Fprintf(os.Stderr, "\n📦  Backed up %d files to %s\n", copied, vaultDir)
	return nil
}

// ── restoreMicro — copy configs/micro/ → ~/.config/micro/ ────
func runRestoreMicro(cmd *cobra.Command, args []string) error {
	configDir, vaultDir, err := resolveMicroDirs()
	if err != nil {
		return err
	}

	var copied int
	for _, f := range trackedMicroFiles {
		src := filepath.Join(vaultDir, f.dstRel)
		dst := filepath.Join(configDir, f.srcRel)

		// Skip if source doesn't exist in vault
		if _, err := os.Stat(src); os.IsNotExist(err) {
			fmt.Fprintf(os.Stderr, "  ⏭  skip (not found in vault): %s\n", f.dstRel)
			continue
		}

		if err := copyFile(src, dst); err != nil {
			fmt.Fprintf(os.Stderr, "  ❌  %s\n", err)
			continue
		}
		fmt.Fprintf(os.Stderr, "  ✅  → %s\n", f.srcRel)
		copied++
	}

	fmt.Fprintf(os.Stderr, "\n📦  Restored %d files to %s\n", copied, configDir)
	return nil
}

// ── Cobra commands ───────────────────────────────────────────
var backupCmd = &cobra.Command{
	Use:   "backup",
	Short: "Backup configs to goblin-vault",
	Long:  `Backup editor/tool configs from ~/.config/ into goblin-vault/configs/.`,
}

var backupMicroCmd = &cobra.Command{
	Use:   "micro",
	Short: "Backup micro editor config",
	Long:  `Copy tracked micro config files from ~/.config/micro/ to goblin-vault/configs/micro/.`,
	RunE:  runBackupMicro,
}

var restoreCmd = &cobra.Command{
	Use:   "restore",
	Short: "Restore configs from goblin-vault",
	Long:  `Restore editor/tool configs from goblin-vault/configs/ into ~/.config/.`,
}

var restoreMicroCmd = &cobra.Command{
	Use:   "micro",
	Short: "Restore micro editor config",
	Long:  `Copy tracked micro config files from goblin-vault/configs/micro/ to ~/.config/micro/.`,
	RunE:  runRestoreMicro,
}

func init() {
	rootCmd.AddCommand(backupCmd)
	backupCmd.AddCommand(backupMicroCmd)

	rootCmd.AddCommand(restoreCmd)
	restoreCmd.AddCommand(restoreMicroCmd)
}
