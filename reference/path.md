# Path Reference

> Pusat knowledge agent untuk build, navigasi, dan operasi sistem.
> Semua path relatif dari workspace `~/goblin`.

---

## 1. Path Project

| Path                                                        | Description                   |
| ----------------------------------------------------------- | ----------------------------- |
| `~/goblin/projects/civil-api/docs`        | API civil group documentation |
| `~/goblin/projects/benchmark-engine/docs` | benchmark documentation       |

---

## 2. Path Docs Kilo

### Config (punya sendiri)

| Path                                             | Description                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `~/.opencode/agents/`                         | Agent definitions (assistant-operator, debugger, reviewer, coder-light, automation, creator-agent, prompt-optimizer) |
| `~/.opencode/skills/`    | Skill packages (agent-customization, create-agent, create-hook, create-instructions, create-prompt, create-skill)    |
| `~/.opencode/commands/`  | Slash commands (6 custom commands)                                                                                   |
| `~/.opencode/reference/` | Pusat pengetahuan agent                                                                                              |

### Library (third-party repos)

| Path                                                                     | Description                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `~/goblin/library/kilo.docs/`                                | **Official Kilo Docs (Cloned from kilo.ai/docs)** |
| `~/goblin/library/repos/claude_code_toolkit/agents/`    | 50+ agent definitions                             |
| `~/goblin/library/repos/claude_code_toolkit/commands/`  | 100+ slash commands                               |
| `~/goblin/library/repos/claude_code_toolkit/skills/`    | 40+ SKILL.md                                      |
| `~/goblin/library/repos/claude_code_toolkit/plugins/`   | 100+ plugins                                      |
| `~/goblin/library/repos/claude_code_toolkit/rules/`     | Rules                                             |
| `~/goblin/library/repos/claude_code_toolkit/templates/` | Templates                                         |
| `~/goblin/library/repos/claude_code_toolkit/contexts/`  | Contexts                                          |
| `~/goblin/library/repos/claude_code_toolkit/examples/`  | Examples                                          |
| `~/goblin/library/agents-codex/`                             | 14 kategori agent templates                       |
| `~/goblin/library/repos/github-mcp-server/`             | MCP server untuk GitHub                           |
| `~/goblin/library/repos/oh-my-pi/`                      | Pi coding agent framework (agent runtime, TUI, multi-provider LLM) |
| `~/goblin/library/repos/DS-reasonix/`                   | Reasonix — Go-based AI coding agent toolkit       |

---

## 3. Path System

| Path                                              | Description                         |
| ------------------------------------------------- | ----------------------------------- |
| `~/.opencode/opencode.jsonc`   | Main config (JSON with comments)    |
| `~/.local/share/opencode/`            | SQLite database (model cache, auth) |

---
## 4. tree home direktory

 .
├── 󰡯 $LOG_FILE
├──  .antigravity-ide-server
├──  .aws -> '/mnt/c/Users/AHMAD SHOBI ULINNAFI'/.aws
├──  .azure -> '/mnt/c/Users/AHMAD SHOBI ULINNAFI'/.azure
├── 󱆃 .bash_history
├── 󱆃 .bash_logout
├── 󱆃 .bashrc
├──  .bun
├──  .cache
├──  .cline
├──  .config
├──  .copilot
├──  .docker
├──  .dotnet
├──  .gemini
├── 󰊢 .gitconfig
├──  .github
├──  .github-copilot-cli
├──  .google-accounts
├──  .kilo
├──  .landscape
├──  .lesshst
├──  .local                          -> Mini storage
├──  .motd_shown
├──  .nanorc
├──  .npm
├──  .oh-my-zsh
├──  .ollama
├──  .ollama-accounts
├──  .openclaw
├──  .opencode                       -> Tools Cli utama (basic)
├── 󱆃 .profile
├──  .python_history
├──  .redhat
├──  .secrets.env
├──  .shell                          -> script tui mini ( Goblin Mini OS )
├──  .shell.backup
├── 󰢬 .ssh
├──  .viminfo
├──  .vscode
├──  .vscode-remote-containers
├──  .vscode-server
├──  .wget-hsts
├──  .zcompdump
├── 󱆃 .zshrc
├──  .zshrc.bak
├──  archive                         -> Fosil
├──  goblin                          -> project utama (replaces civil)
├──  commands.md                     -> Referensi Commands Linux ( yang sakti sakti )
├──  library                         -> Knowledge
├──  llama-switcher
├──  Microsoft
├──  ollama-switcher
├──  package-lock.json
├──  package.json
└──  snap

_Last updated: 2026-07-03_