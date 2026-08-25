//! pm — Ratatui UI Rendering Engine

use ratatui::{
    Frame,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Row, Table, Tabs, Wrap},
};

use crate::tui::app::{ActivePane, ActiveTab, App};

pub fn render(frame: &mut Frame, app: &App) {
    let size = frame.area();

    // 1. Root Layout (Header, Tabs, Main Area, Logs/Footer)
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header & Tabs
            Constraint::Min(10),   // Main Split-Pane
            Constraint::Length(7), // Logs & Action Bar
        ])
        .split(size);

    render_header_and_tabs(frame, app, chunks[0]);
    render_main_split_pane(frame, app, chunks[1]);
    render_logs_and_footer(frame, app, chunks[2]);

    // Render Modals if active
    if app.show_help {
        render_help_modal(frame, size);
    }
    if app.show_sudo_prompt {
        render_sudo_modal(frame, app, size);
    }
}

fn render_header_and_tabs(frame: &mut Frame, app: &App, area: Rect) {
    let tab_titles = vec![
        Span::raw(" 🔄 1. Updates "),
        Span::raw(" 🔍 2. Registry Search "),
        Span::raw(" 📦 3. Installed "),
    ];

    let selected_tab = match app.active_tab {
        ActiveTab::Updates => 0,
        ActiveTab::Search => 1,
        ActiveTab::Installed => 2,
    };

    let tabs = Tabs::new(tab_titles)
        .select(selected_tab)
        .block(
            Block::default().borders(Borders::ALL).title(Span::styled(
                " 🚀 PM — Universal Package & Registry Manager ",
                Style::default()
                    .fg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            )),
        )
        .style(Style::default().fg(Color::DarkGray))
        .highlight_style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        );

    frame.render_widget(tabs, area);
}

fn render_main_split_pane(frame: &mut Frame, app: &App, area: Rect) {
    let sub_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(22), // Sidebar
            Constraint::Percentage(48), // Main List / Table
            Constraint::Percentage(30), // Details
        ])
        .split(area);

    render_sidebar(frame, app, sub_chunks[0]);

    match app.active_tab {
        ActiveTab::Updates => {
            render_updates_table(frame, app, sub_chunks[1]);
            render_updates_details(frame, app, sub_chunks[2]);
        }
        ActiveTab::Search => {
            render_search_table(frame, app, sub_chunks[1]);
            render_search_details(frame, app, sub_chunks[2]);
        }
        ActiveTab::Installed => {
            render_installed_table(frame, app, sub_chunks[1]);
            render_installed_details(frame, app, sub_chunks[2]);
        }
    }
}

fn render_sidebar(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.active_pane == ActivePane::Sidebar;
    let border_style = if is_focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let items = vec![
        ListItem::new(Line::from(vec![
            Span::styled("▸ All Outdated ", Style::default().fg(Color::White)),
            Span::styled(
                format!("({})", app.outdated_items.len()),
                Style::default().fg(Color::Yellow),
            ),
        ])),
        ListItem::new(Line::from("─ System (APT, Snap, Flatpak)")),
        ListItem::new(Line::from("─ Toolchains (Bun, OMP, Rustup)")),
        ListItem::new(Line::from("─ Dev (NPM, PIP, Cargo, Brew)")),
    ];

    let list = List::new(items).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" 📂 Categories ")
            .border_style(border_style),
    );

    frame.render_widget(list, area);
}

fn render_updates_table(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.active_pane == ActivePane::MainList;
    let border_style = if is_focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let rows: Vec<Row> = app
        .outdated_items
        .iter()
        .enumerate()
        .map(|(idx, it)| {
            let check = if it.selected { "[✓]" } else { "[ ]" };
            let check_style = if it.selected {
                Style::default().fg(Color::Green)
            } else {
                Style::default().fg(Color::DarkGray)
            };

            let row_style = if idx == app.selected_index {
                Style::default()
                    .bg(Color::Rgb(30, 40, 60))
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };

            let cur = it.current_version.as_deref().unwrap_or("-");
            let lat = it.latest_version.as_deref().unwrap_or("latest");

            Row::new(vec![
                Span::styled(check, check_style),
                Span::raw(it.name.clone()),
                Span::styled(cur, Style::default().fg(Color::DarkGray)),
                Span::styled("➔", Style::default().fg(Color::Yellow)),
                Span::styled(lat, Style::default().fg(Color::Green)),
                Span::styled(it.target.as_str(), Style::default().fg(Color::Cyan)),
            ])
            .style(row_style)
        })
        .collect();

    let title = if app.is_scanning {
        " 📦 Outdated Packages (🔍 Scanning...) "
    } else if app.is_updating {
        " 📦 Outdated Packages (🔄 Updating...) "
    } else {
        " 📦 Outdated Packages "
    };

    let table = Table::new(
        rows,
        [
            Constraint::Length(4),
            Constraint::Percentage(32),
            Constraint::Percentage(20),
            Constraint::Length(2),
            Constraint::Percentage(20),
            Constraint::Percentage(16),
        ],
    )
    .header(
        Row::new(vec!["Sel", "Package Name", "Current", "", "Latest", "PM"]).style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(title)
            .border_style(border_style),
    );

    frame.render_widget(table, area);
}

fn render_updates_details(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.active_pane == ActivePane::Detail;
    let border_style = if is_focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let content = if let Some(it) = app.outdated_items.get(app.selected_index) {
        vec![
            Line::from(vec![
                Span::styled("Package:     ", Style::default().fg(Color::Cyan)),
                Span::styled(&it.name, Style::default().add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::styled("Manager:     ", Style::default().fg(Color::Cyan)),
                Span::raw(it.target.display_label()),
            ]),
            Line::from(vec![
                Span::styled("Category:    ", Style::default().fg(Color::Cyan)),
                Span::raw(it.target.category()),
            ]),
            Line::from(vec![
                Span::styled("Current Ver: ", Style::default().fg(Color::Cyan)),
                Span::raw(it.current_version.as_deref().unwrap_or("-")),
            ]),
            Line::from(vec![
                Span::styled("Target Ver:  ", Style::default().fg(Color::Cyan)),
                Span::styled(
                    it.latest_version.as_deref().unwrap_or("latest"),
                    Style::default().fg(Color::Green),
                ),
            ]),
            Line::from(vec![
                Span::styled("Sudo Root:   ", Style::default().fg(Color::Cyan)),
                Span::raw(if it.target.requires_sudo() {
                    "⚠️ Required"
                } else {
                    "No (User space)"
                }),
            ]),
        ]
    } else {
        vec![Line::from("No package selected.")]
    };

    let paragraph = Paragraph::new(content)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" 📄 Package Details ")
                .border_style(border_style),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

fn render_search_table(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.active_pane == ActivePane::MainList;
    let border_style = if is_focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let rows: Vec<Row> = app
        .search_results
        .iter()
        .enumerate()
        .map(|(idx, pkg)| {
            let row_style = if idx == app.search_index {
                Style::default()
                    .bg(Color::Rgb(30, 40, 60))
                    .fg(Color::White)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default()
            };

            Row::new(vec![
                Span::raw(pkg.name.clone()),
                Span::styled(&pkg.version, Style::default().fg(Color::Green)),
                Span::styled(pkg.registry.as_str(), Style::default().fg(Color::Cyan)),
                Span::styled(
                    pkg.description.chars().take(40).collect::<String>(),
                    Style::default().fg(Color::DarkGray),
                ),
            ])
            .style(row_style)
        })
        .collect();

    let query_display = if app.is_editing_search {
        format!(" 🔍 Query: {}█ ", app.search_query)
    } else {
        format!(" 🔍 Query: '{}' (Press '/' to edit) ", app.search_query)
    };

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(30),
            Constraint::Percentage(15),
            Constraint::Percentage(15),
            Constraint::Percentage(40),
        ],
    )
    .header(
        Row::new(vec!["Package Name", "Version", "Registry", "Description"]).style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(query_display)
            .border_style(border_style),
    );

    frame.render_widget(table, area);
}

fn render_search_details(frame: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.active_pane == ActivePane::Detail;
    let border_style = if is_focused {
        Style::default().fg(Color::Cyan)
    } else {
        Style::default().fg(Color::DarkGray)
    };

    let content = if let Some(pkg) = app.search_results.get(app.search_index) {
        vec![
            Line::from(vec![
                Span::styled("Name:        ", Style::default().fg(Color::Cyan)),
                Span::styled(&pkg.name, Style::default().add_modifier(Modifier::BOLD)),
            ]),
            Line::from(vec![
                Span::styled("Registry:    ", Style::default().fg(Color::Cyan)),
                Span::raw(pkg.registry.display_label()),
            ]),
            Line::from(vec![
                Span::styled("Version:     ", Style::default().fg(Color::Cyan)),
                Span::styled(&pkg.version, Style::default().fg(Color::Green)),
            ]),
            Line::from(vec![
                Span::styled("Homepage:    ", Style::default().fg(Color::Cyan)),
                Span::raw(pkg.homepage.as_deref().unwrap_or("-")),
            ]),
            Line::from(vec![
                Span::styled("Repository:  ", Style::default().fg(Color::Cyan)),
                Span::raw(pkg.repository.as_deref().unwrap_or("-")),
            ]),
            Line::from(""),
            Line::from(vec![Span::styled(
                "Description:",
                Style::default().fg(Color::Yellow),
            )]),
            Line::from(pkg.description.clone()),
        ]
    } else {
        vec![Line::from("No search results.")]
    };

    let paragraph = Paragraph::new(content)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" 📄 Registry Details ")
                .border_style(border_style),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

fn render_installed_table(frame: &mut Frame, _app: &App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" 📦 Installed System Packages ")
        .border_style(Style::default().fg(Color::DarkGray));

    let p = Paragraph::new("Press 'Tab' or '1/2/3' to switch modes.").block(block);
    frame.render_widget(p, area);
}

fn render_installed_details(frame: &mut Frame, _app: &App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .title(" 📄 Metadata ")
        .border_style(Style::default().fg(Color::DarkGray));

    let p = Paragraph::new("Installed package metadata inspection.").block(block);
    frame.render_widget(p, area);
}

fn render_logs_and_footer(frame: &mut Frame, app: &App, area: Rect) {
    let log_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(4), Constraint::Length(1)])
        .split(area);

    let log_lines: Vec<Line> = app
        .logs
        .iter()
        .rev()
        .take(5)
        .rev()
        .map(|l| Line::from(Span::styled(l, Style::default().fg(Color::White))))
        .collect();

    let logs_widget = Paragraph::new(log_lines).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" 📝 Live Execution Logs & Status "),
    );

    frame.render_widget(logs_widget, log_chunks[0]);

    let keybindings_bar = Line::from(vec![
        Span::styled(
            " [Space] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Toggle  "),
        Span::styled(
            " [a] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("All  "),
        Span::styled(
            " [u/Enter] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Update  "),
        Span::styled(
            " [/] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Search  "),
        Span::styled(
            " [Tab] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Switch Pane  "),
        Span::styled(
            " [?] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Help  "),
        Span::styled(
            " [q] ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw("Quit"),
    ]);

    let footer = Paragraph::new(keybindings_bar).alignment(Alignment::Center);
    frame.render_widget(footer, log_chunks[1]);
}

fn render_help_modal(frame: &mut Frame, area: Rect) {
    let popup_area = centered_rect(60, 50, area);
    frame.render_widget(Clear, popup_area);

    let text = vec![
        Line::from(Span::styled(
            "🚀 PM TUI Keybindings & Controls",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from("  j / k / ↑ / ↓  : Navigate list and table items"),
        Line::from("  1 / 2 / 3      : Switch active tabs (Updates / Search / Installed)"),
        Line::from("  Tab / Shift-Tab: Switch focused split pane (Sidebar ⇄ Table ⇄ Details)"),
        Line::from("  Space          : Toggle select/unselect package for upgrade"),
        Line::from("  a              : Select all / unselect all"),
        Line::from("  u / Enter      : Execute batch update or package installation"),
        Line::from("  /              : Live search mode / edit search query"),
        Line::from("  ?              : Toggle this help dialog"),
        Line::from("  q / Esc        : Quit application safely / cancel modal"),
        Line::from(""),
        Line::from(Span::styled(
            "Press '?' or 'Esc' to close.",
            Style::default().fg(Color::Yellow),
        )),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" 💡 Quick Help & Manual ")
        .border_style(Style::default().fg(Color::Yellow));

    let p = Paragraph::new(text).block(block).wrap(Wrap { trim: true });
    frame.render_widget(p, popup_area);
}

fn render_sudo_modal(frame: &mut Frame, app: &App, area: Rect) {
    let popup_area = centered_rect(50, 20, area);
    frame.render_widget(Clear, popup_area);

    let masked: String = "*".repeat(app.sudo_input.len());
    let text = vec![
        Line::from("🔑 Root access required for APT / Snap operations."),
        Line::from("Enter your sudo password:"),
        Line::from(""),
        Line::from(Span::styled(
            format!("Password: {}█", masked),
            Style::default().fg(Color::Yellow),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "Press Enter to submit, Esc to skip.",
            Style::default().fg(Color::DarkGray),
        )),
    ];

    let block = Block::default()
        .borders(Borders::ALL)
        .title(" 🔐 Sudo Authentication ")
        .border_style(Style::default().fg(Color::Red));

    let p = Paragraph::new(text).block(block).wrap(Wrap { trim: true });
    frame.render_widget(p, popup_area);
}

fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
