package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init [zsh|bash|fish]",
	Short: "Generate shell integration wrapper for instant directory jumping",
	Long: `ZF Init — Shell Integration Generator (Level 2 Help)

Generates shell wrapper function to enable 'zf' to mutate the working directory
directly in your active parent shell.

SETUP:
  Zsh (append to ~/.zshrc):
    eval "$(zf init zsh)"

  Bash (append to ~/.bashrc):
    eval "$(zf init bash)"

  Fish (append to ~/.config/fish/config.fish):
    zf init fish | source

EXAMPLES:
  $ zf init zsh
`,
	Args: cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		shell := "zsh"
		if len(args) > 0 {
			shell = args[0]
		}

		switch shell {
		case "fish":
			raw := `function zf
    for arg in $argv
        switch $arg
            case "-h" "--help" "-v" "--version" "help" "init" "rank" "tm" "tmux" "add" "del" "exec"
                command zf $argv
                return $status
        end
    end

    set -l target (command zf --pick $argv)
    if test -n "$target"
        set -l parts (string split \t -- $target)
        set -l dest $parts[1]
        if test -d "$dest"
            builtin cd $dest
            if test (count $parts) -gt 1
                set -l act $parts[2]
                switch $act
                    case "fex" "gb" "lazygit" "code ." "code" "nvim" "micro" "vim"
                        eval $act
                    case "*"
                        if not string match -r '[;|\&$]' -- $act
                            eval $act
                        else
                            echo "zf: invalid or unpermitted action: $act" >&2
                            return 1
                        end
                end
            end
        end
    end
end
`
			fmt.Print(raw)
		default: // zsh & bash
			raw := `zf() {
    for arg in "$@"; do
        case "$arg" in
            -h|--help|-v|--version|help|init|rank|tm|tmux|add|del|exec)
                command zf "$@"
                return $?
                ;;
        esac
    done

    local target
    target=$(command zf --pick "$@") || return $?
    if [ -n "$target" ]; then
        case "$target" in
            *$'\n'*)
                echo "$target"
                return 0
                ;;
        esac

        local dest="${target%%$'\t'*}"
        local action="${target#*$'\t'}"
        if [ -d "$dest" ]; then
            builtin cd "$dest" || return 1
            if [ "$action" != "$dest" ] && [ -n "$action" ]; then
                case "$action" in
                    fex|gb|lazygit|"code ."|code|nvim|micro|vim)
                        eval "$action"
                        ;;
                    *)
                        case "$action" in
                            *[;\|\&\$]*)
                                echo "zf: invalid or unpermitted action '$action'" >&2
                                return 1
                                ;;
                            *)
                                eval "$action"
                                ;;
                        esac
                        ;;
                esac
            fi
        fi
    fi
}
`
			fmt.Print(raw)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
