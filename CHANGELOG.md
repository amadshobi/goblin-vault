# Changelog

## [Unreleased]

### Added
- `fex backup micro` — backup micro editor config from `~/.config/micro/` to `goblin-vault/configs/micro/`
- `fex restore micro` — restore micro editor config from `goblin-vault/configs/micro/` to `~/.config/micro/`
- `install.sh` — now deploys micro config as symlinks to `~/.config/micro/` (auto-sync with goblin-vault)
- `configs/micro/` — source-of-truth directory for micro editor configuration
  - `settings.json`, `bindings.json`, `init.lua`, `palettero.cfg`, `goblin-help.md`
  - `colorschemes/darcula-glass.micro`, `colorschemes/darcula-goblin.micro`
  - `plug/filemanager/filemanager.lua`, `syntax.yaml`, `repo.json`
- CHANGELOG.md — project changelog (since initial commit)
- Micro editor: `softwrap` enabled (long lines auto-wrap, no horizontal scroll)
- Micro editor: filemanager plugin now opens tree at parent directory of current file (not CWD)

## [0.1.0] - 2026-07-08

### Fixed
- `fex` tree mode: Esc/Ctrl-H now respects `$HOME` boundary — exits tree at root instead of navigating above home
- `fex` tree mode: scroll wrap via `--cycle` flag (cyclical scrolling top→bottom and vice versa)
- `fex` create file/folder dialog: replaced `--expect` + dummy-item pattern with `enter:print-query` binding + empty stdin — no more empty list exit code 1
- `fex`: after file/dir create, new file is automatically opened in editor (tmux-aware with `tmux.OpenFileInPane` fallback)
- `fex`: removed `sess.SetLastOpened` after create — prevents search input from being filled with new file name
- `fex`: diagnostic scripts no longer report false alarms

### Changed
- `fex`: complete rewrite from shell-based `fe` to Go CLI `fex` (v4.0) — modular architecture with subcommands (`tree`, `search`, `create`, `editor`, `path`, `kill`)
- `fex`: internal fzf API — added `Cycle` field and `--cycle` arg emission

### Removed
- `scripts/fe` — fully replaced by `fex` Go binary
- `scripts/fe.bak.*` — stale backup files

## [0.0.2] - 2026-07-07

### Added
- `worktree.sh` — Git Worktree Manager for parallel branch workflows
- `notes` tool — markdown-based notes manager
- `tools-cli/` directory with Go CLI scaffolding
- Syntax check script (`scripts/check_syntax.sh`)
- Doctor script (`scripts/doctor.sh`)
- Install script (`scripts/install.sh`)
- `.gitattributes` for cross-device line ending normalization

### Changed
- Project structure: migrated all scripts to `tools-cli/` with proper Go module layout
- `fe` (file explorer) — refactored to modular architecture (v3.0) with popup-based rename/delete, search popup, quoting safety, keybinding overhaul
- `fe` helper scripts: simplified `popup_input.sh`, replaced temp helper with static `fe-helper.sh`

## [0.0.1] - 2026-07-06

### Added
- OpenCode configuration (`opencode.jsonc`, `tui.jsonc`)
- `fe` — file explorer shell script (v1.0)
- Agent definitions: assistant, coder, code-review, explore, research, doctor, task-organizer
- Commands: health-check, prompt-optimizer, agent creator, command creator, hooks creator, instructions, prompts, rules, skills, code delegate, plan delegate, review delegate, rules delegate, executor
- Plugins: compaction-enhancer, doom-loop, fast-tools, pending-todos, smart-truncation
- Reference docs: boss-goblin, free-models, opencode-docs, path, repo-wishlist
- `gh-blin` — GitHub CLI wrapper
- `gh_tui` — GitHub TUI (issues, PRs, releases, repos)
- `goblin-control` — Node.js control center (check, cmd, create, delete, git, shortcuts)
- `ocm` — OpenCode Model manager wrapper
- Utility scripts: `remove_emojis.js`, `test.js`, etc.
- Skills: context7-mcp for library documentation queries
- TUI dashboard with commands for agents, doctor, MCP, models, providers, reference, run, sessions, settings

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/) conventions:
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for bug fixes
- **Security** for vulnerability fixes
