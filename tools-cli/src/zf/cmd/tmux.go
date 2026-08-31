package cmd

import (
	"civil/goblin-vault/tools-cli/src/zf/internal/tmux"
	"civil/goblin-vault/tools-cli/src/zf/internal/ui"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
)

const interactiveOptVal = "__INTERACTIVE__"

var (
	flagTmNew string
	flagTmDel string
	flagTmIn  string
	flagTmLs  bool
)

var tmuxCmd = &cobra.Command{
	Use:     "tmux [subcommand|flags]",
	Aliases: []string{"tm"},
	Short:   "Manage Tmux sessions (ls, new, in, del)",
	Long: `ZF Tmux — Session Controller (Level 2 Help)

Manage persistent terminal multiplexer sessions directly from ZF without opening the full TUI.

USAGE:
  zf tm [flags]
  zf tm <command> [args]

COMMANDS & FLAGS:
  -l, --ls, ls          List all active sessions and window counts
  -n, --new, new [name] Create a new session in current directory and attach
  -i, --in, in [name]   Attach or switch to an existing session (interactive if empty)
  -d, --del, del [name] Safely delete session with client migration (interactive if empty)

EXAMPLES:
  $ zf tm -l
  $ zf tm -n project-api
  $ zf tm -i
  $ zf tm -i project-api
  $ zf tm -d
  $ zf tm in
  $ zf tm del
`,
	RunE: func(cmd *cobra.Command, args []string) error {
		client := tmux.NewClient()

		// Flag handling — flag tanpa value (-i/-n/-d) memicu mode interaktif
		if cmd.Flags().Changed("ls") {
			return runTmuxLs(client)
		}
		if cmd.Flags().Changed("new") {
			target := flagTmNew
			if target == interactiveOptVal {
				target = ""
			}
			if target == "" && len(args) > 0 {
				target = args[0]
			}
			if target != "" {
				return runTmuxNew(client, target)
			}
			return runTmuxNewInteractive(client)
		}
		if cmd.Flags().Changed("in") {
			target := flagTmIn
			if target == interactiveOptVal {
				target = ""
			}
			if target == "" && len(args) > 0 {
				target = args[0]
			}
			if target != "" {
				return client.Attach(target)
			}
			return runTmuxInInteractive(client)
		}
		if cmd.Flags().Changed("del") {
			target := flagTmDel
			if target == interactiveOptVal {
				target = ""
			}
			if target == "" && len(args) > 0 {
				target = args[0]
			}
			if target != "" {
				return runTmuxDel(client, target)
			}
			return runTmuxDelInteractive(client)
		}

		// Positional subcommand handling
		if len(args) == 0 {
			return runTmuxLs(client)
		}

		action := args[0]
		switch action {
		case "ls", "list":
			return runTmuxLs(client)

		case "new", "create", "-n":
			if len(args) > 1 {
				return runTmuxNew(client, args[1])
			}
			return runTmuxNewInteractive(client)

		case "in", "attach", "-i":
			if len(args) > 1 {
				return client.Attach(args[1])
			}
			return runTmuxInInteractive(client)

		case "del", "delete", "rm", "kill", "-d":
			if len(args) > 1 {
				return runTmuxDel(client, args[1])
			}
			return runTmuxDelInteractive(client)

		case "help":
			return cmd.Help()

		default:
			return fmt.Errorf("unknown tmux command '%s'. Available: ls, new, in, del", action)
		}
	},
}

func runTmuxLs(client tmux.Client) error {
	sessions, err := client.List()
	if err != nil {
		return err
	}
	if len(sessions) == 0 {
		fmt.Println("No active tmux sessions found.")
		return nil
	}
	for _, s := range sessions {
		status := "detached"
		if s.Attached {
			status = "attached"
		}
		fmt.Printf("%-20s (%d windows) [%s]\n", s.Name, s.Windows, status)
	}
	return nil
}

func runTmuxNew(client tmux.Client, name string) error {
	cwd, _ := os.Getwd()
	if err := client.NewSession(name, cwd); err != nil {
		return err
	}
	return client.Attach(name)
}

func runTmuxDel(client tmux.Client, name string) error {
	if err := client.Kill(name); err != nil {
		return err
	}
	fmt.Printf("Session '%s' deleted successfully.\n", name)
	return nil
}

// currentSessionName mengambil nama session aktif saat ini tempat client berada
func currentSessionName() string {
	out, err := exec.Command("tmux", "display-message", "-p", "#{session_name}").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// handleCancel mengkonversi pembatalan user (esc) menjadi exit sukses tanpa error
func handleCancel(err error) error {
	if errors.Is(err, ui.ErrCancelled) {
		return nil
	}
	return err
}

// runTmuxInInteractive membuka picker session; parity legacy: tanpa session, tawarkan buat baru via prompt nama.
func runTmuxInInteractive(client tmux.Client) error {
	sessions, err := client.List()
	if err != nil {
		return err
	}
	if len(sessions) == 0 {
		name, err := ui.PromptSessionName("No active sessions. New session name:")
		if err != nil {
			return handleCancel(err)
		}
		return runTmuxNew(client, name)
	}
	choice, err := ui.PickSessionFromList(sessions, currentSessionName())
	if err != nil {
		return handleCancel(err)
	}
	return client.Attach(choice)
}

// runTmuxNewInteractive meminta nama session via prompt interaktif
func runTmuxNewInteractive(client tmux.Client) error {
	name, err := ui.PromptSessionName("New tmux session name:")
	if err != nil {
		return handleCancel(err)
	}
	return runTmuxNew(client, name)
}

// runTmuxDelInteractive membuka picker untuk memilih session yang akan di-kill
func runTmuxDelInteractive(client tmux.Client) error {
	sessions, err := client.List()
	if err != nil {
		return err
	}
	if len(sessions) == 0 {
		fmt.Println("No active tmux sessions found.")
		return nil
	}
	choice, err := ui.PickSessionFromList(sessions, currentSessionName())
	if err != nil {
		return handleCancel(err)
	}
	return runTmuxDel(client, choice)
}

func init() {
	tmuxCmd.Flags().BoolVarP(&flagTmLs, "ls", "l", false, "List active tmux sessions")
	tmuxCmd.Flags().StringVarP(&flagTmNew, "new", "n", "", "Create new session")
	tmuxCmd.Flags().StringVarP(&flagTmIn, "in", "i", "", "Attach to session")
	tmuxCmd.Flags().StringVarP(&flagTmDel, "del", "d", "", "Delete session")

	// NoOptDefVal membuat -i/-n/-d valid tanpa nilai: flag tanpa value
	// memicu mode interaktif, flag dengan value tetap bypass langsung (issue #33)
	tmuxCmd.Flags().Lookup("new").NoOptDefVal = interactiveOptVal
	tmuxCmd.Flags().Lookup("in").NoOptDefVal = interactiveOptVal
	tmuxCmd.Flags().Lookup("del").NoOptDefVal = interactiveOptVal

	rootCmd.AddCommand(tmuxCmd)
}
