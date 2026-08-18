// == CORE MISSION ==============================================
// cmd/backup.go — Backup & restore configs to/from goblin-vault
//
// Usage:
//
//	fex backup micro    — backup micro config → goblin-vault/configs/micro/
//	fex restore micro   — restore micro config → ~/.config/micro/
//
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

// ── resolveFexDirs ───────────────────────────────────────────
func resolveFexDirs() (configDir string, vaultDir string, err error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", fmt.Errorf("home dir: %w", err)
	}
	configDir = filepath.Join(home, ".config", "fex")
	vaultDir = filepath.Join(goblinVaultRoot(), "configs", "fex")
	return configDir, vaultDir, nil
}

// ── backupFex — copy ~/.config/fex/config.yaml → configs/fex/ ──
func runBackupFex(cmd *cobra.Command, args []string) error {
	configDir, vaultDir, err := resolveFexDirs()
	if err != nil {
		return err
	}

	src := filepath.Join(configDir, "config.yaml")
	dst := filepath.Join(vaultDir, "config.yaml")

	// Skip if source doesn't exist
	if _, err := os.Stat(src); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "  ⏭  skip (not found): ~/.config/fex/config.yaml\n")
		return nil
	}

	if err := copyFile(src, dst); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌  %s\n", err)
		return err
	}
	fmt.Fprintf(os.Stderr, "  ✅  config.yaml\n")
	fmt.Fprintf(os.Stderr, "\n📦  Backed up fex config to %s\n", vaultDir)
	return nil
}

// ── restoreFex — copy configs/fex/config.yaml → ~/.config/fex/ ─
func runRestoreFex(cmd *cobra.Command, args []string) error {
	configDir, vaultDir, err := resolveFexDirs()
	if err != nil {
		return err
	}

	src := filepath.Join(vaultDir, "config.yaml")
	dst := filepath.Join(configDir, "config.yaml")

	if _, err := os.Stat(src); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "  ⏭  skip (not found in vault): configs/fex/config.yaml\n")
		return nil
	}

	if err := copyFile(src, dst); err != nil {
		fmt.Fprintf(os.Stderr, "  ❌  %s\n", err)
		return err
	}
	fmt.Fprintf(os.Stderr, "  ✅  → config.yaml\n")
	fmt.Fprintf(os.Stderr, "\n📦  Restored fex config to %s\n", configDir)
	return nil
}

// ── backupAll — backup micro + fex ───────────────────────────
func runBackupAll(cmd *cobra.Command, args []string) error {
	fmt.Fprintf(os.Stderr, "📦 [1/2] Backing up micro config...\n")
	_ = runBackupMicro(cmd, args)
	fmt.Fprintf(os.Stderr, "\n📦 [2/2] Backing up fex config...\n")
	_ = runBackupFex(cmd, args)
	return nil
}

// ── restoreAll — restore micro + fex ─────────────────────────
func runRestoreAll(cmd *cobra.Command, args []string) error {
	fmt.Fprintf(os.Stderr, "📦 [1/2] Restoring micro config...\n")
	_ = runRestoreMicro(cmd, args)
	fmt.Fprintf(os.Stderr, "\n📦 [2/2] Restoring fex config...\n")
	_ = runRestoreFex(cmd, args)
	return nil
}

// ── Cobra commands ───────────────────────────────────────────
var backupCmd = &cobra.Command{
	Use:   "backup [micro|fex|all]",
	Short: "Backup configs to goblin-vault",
	Long:  `Backup editor/tool configs from ~/.config/ into goblin-vault/configs/.`,
}

var backupMicroCmd = &cobra.Command{
	Use:   "micro",
	Short: "Backup micro editor config",
	Long:  `Copy tracked micro config files from ~/.config/micro/ to goblin-vault/configs/micro/.`,
	RunE:  runBackupMicro,
}

var backupFexCmd = &cobra.Command{
	Use:   "fex",
	Short: "Backup fex file explorer config",
	Long:  `Copy fex config file from ~/.config/fex/config.yaml to goblin-vault/configs/fex/config.yaml.`,
	RunE:  runBackupFex,
}

var backupAllCmd = &cobra.Command{
	Use:   "all",
	Short: "Backup all tool configs (micro + fex)",
	Long:  `Copy all tracked configs from ~/.config/ to goblin-vault/configs/.`,
	RunE:  runBackupAll,
}

var restoreCmd = &cobra.Command{
	Use:   "restore [micro|fex|all]",
	Short: "Restore configs from goblin-vault",
	Long:  `Restore editor/tool configs from goblin-vault/configs/ into ~/.config/.`,
}

var restoreMicroCmd = &cobra.Command{
	Use:   "micro",
	Short: "Restore micro editor config",
	Long:  `Copy tracked micro config files from goblin-vault/configs/micro/ to ~/.config/micro/.`,
	RunE:  runRestoreMicro,
}

var restoreFexCmd = &cobra.Command{
	Use:   "fex",
	Short: "Restore fex file explorer config",
	Long:  `Copy fex config file from goblin-vault/configs/fex/config.yaml to ~/.config/fex/config.yaml.`,
	RunE:  runRestoreFex,
}

var restoreAllCmd = &cobra.Command{
	Use:   "all",
	Short: "Restore all tool configs (micro + fex)",
	Long:  `Copy all tracked configs from goblin-vault/configs/ to ~/.config/.`,
	RunE:  runRestoreAll,
}

func init() {
	rootCmd.AddCommand(backupCmd)
	backupCmd.AddCommand(backupMicroCmd)
	backupCmd.AddCommand(backupFexCmd)
	backupCmd.AddCommand(backupAllCmd)

	rootCmd.AddCommand(restoreCmd)
	restoreCmd.AddCommand(restoreMicroCmd)
	restoreCmd.AddCommand(restoreFexCmd)
	restoreCmd.AddCommand(restoreAllCmd)
}
