//! pm — TUI Event Loop & Vim Keybindings Handler

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::tui::app::{ActivePane, ActiveTab, App};

pub fn handle_key_event(app: &mut App, key: KeyEvent) {
    // 1. Sudo Prompt Modal Key Capture
    if app.show_sudo_prompt {
        match key.code {
            KeyCode::Enter => {
                if !app.sudo_input.is_empty() {
                    let pw = app.sudo_input.clone();
                    app.sudo.set_password(pw);
                    app.show_sudo_prompt = false;
                    app.sudo_input.clear();
                    app.log("🔓 Sudo password stored in session memory.");
                    // After password set, proceed to run update
                    app.trigger_background_update();
                }
            }
            KeyCode::Esc => {
                app.show_sudo_prompt = false;
                app.sudo_input.clear();
                app.log("⚠️ Sudo prompt skipped.");
            }
            KeyCode::Backspace => {
                app.sudo_input.pop();
            }
            KeyCode::Char(c) => {
                app.sudo_input.push(c);
            }
            _ => {}
        }
        return;
    }

    // 2. Help Modal Key Capture
    if app.show_help {
        if let KeyCode::Esc | KeyCode::Char('?') | KeyCode::Char('q') = key.code {
            app.show_help = false;
        }
        return;
    }

    // 3. Search Query Input Mode
    if app.is_editing_search {
        match key.code {
            KeyCode::Enter => {
                app.is_editing_search = false;
                app.trigger_background_search();
            }
            KeyCode::Esc => {
                app.is_editing_search = false;
            }
            KeyCode::Backspace => {
                app.search_query.pop();
            }
            KeyCode::Char(c) => {
                app.search_query.push(c);
            }
            _ => {}
        }
        return;
    }

    // 4. Standard Navigation & Vim Keymaps
    match key.code {
        // Quit
        KeyCode::Char('q') | KeyCode::Esc => {
            app.running = false;
        }

        // Help Modal
        KeyCode::Char('?') => {
            app.show_help = !app.show_help;
        }

        // Direct Tab Switching
        KeyCode::Char('1') => {
            app.active_tab = ActiveTab::Updates;
        }
        KeyCode::Char('2') => {
            app.active_tab = ActiveTab::Search;
        }
        KeyCode::Char('3') => {
            app.active_tab = ActiveTab::Installed;
        }

        // Tab pane / focus switching
        KeyCode::Tab => {
            app.active_pane = match app.active_pane {
                ActivePane::Sidebar => ActivePane::MainList,
                ActivePane::MainList => ActivePane::Detail,
                ActivePane::Detail => ActivePane::Logs,
                ActivePane::Logs => ActivePane::Sidebar,
            };
        }
        KeyCode::BackTab => {
            app.active_pane = match app.active_pane {
                ActivePane::Sidebar => ActivePane::Logs,
                ActivePane::MainList => ActivePane::Sidebar,
                ActivePane::Detail => ActivePane::MainList,
                ActivePane::Logs => ActivePane::Detail,
            };
        }

        // Vertical Navigation (j / k / Up / Down)
        KeyCode::Char('j') | KeyCode::Down => match app.active_tab {
            ActiveTab::Updates => {
                if !app.outdated_items.is_empty()
                    && app.selected_index + 1 < app.outdated_items.len()
                {
                    app.selected_index += 1;
                }
            }
            ActiveTab::Search => {
                if !app.search_results.is_empty() && app.search_index + 1 < app.search_results.len()
                {
                    app.search_index += 1;
                }
            }
            ActiveTab::Installed => {
                if !app.installed_packages.is_empty()
                    && app.installed_index + 1 < app.installed_packages.len()
                {
                    app.installed_index += 1;
                }
            }
        },
        KeyCode::Char('k') | KeyCode::Up => match app.active_tab {
            ActiveTab::Updates => {
                if app.selected_index > 0 {
                    app.selected_index -= 1;
                }
            }
            ActiveTab::Search => {
                if app.search_index > 0 {
                    app.search_index -= 1;
                }
            }
            ActiveTab::Installed => {
                if app.installed_index > 0 {
                    app.installed_index -= 1;
                }
            }
        },

        // Space -> Toggle selection (Tab 1)
        KeyCode::Char(' ') => {
            if app.active_tab == ActiveTab::Updates {
                app.toggle_selected();
            }
        }

        // 'a' -> Select / Unselect all (Tab 1)
        KeyCode::Char('a') => {
            if app.active_tab == ActiveTab::Updates {
                app.toggle_all_selected();
            }
        }

        // '/' -> Trigger live search editor
        KeyCode::Char('/') => {
            app.active_tab = ActiveTab::Search;
            app.is_editing_search = true;
        }

        // 'u' or Enter -> Execute Updates or Install
        KeyCode::Char('u') | KeyCode::Enter => match app.active_tab {
            ActiveTab::Updates => {
                let needs_sudo = app
                    .outdated_items
                    .iter()
                    .any(|it| it.selected && it.target.requires_sudo());

                if needs_sudo && !app.sudo.has_password() && !crate::sudo::SudoManager::is_root() {
                    app.show_sudo_prompt = true;
                } else {
                    app.trigger_background_update();
                }
            }
            ActiveTab::Search => {
                if let Some(pkg) = app.search_results.get(app.search_index) {
                    app.log(format!(
                        "📦 Installing {} from {}...",
                        pkg.name,
                        pkg.registry.display_label()
                    ));
                }
            }
            ActiveTab::Installed => {}
        },

        // 'r' -> Rescan
        KeyCode::Char('r') => {
            if app.active_tab == ActiveTab::Updates {
                app.trigger_background_scan();
            }
        }

        // Ctrl+C -> Hard Exit
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.running = false;
        }

        _ => {}
    }
}
