//! pm — TUI Terminal Runner & Event Stream Coordinator

use crossterm::{
    event::{self, Event},
    execute,
    terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode},
};
use ratatui::Terminal;
use ratatui::backend::CrosstermBackend;
use std::io::stdout;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

use crate::core::error::Result;
use crate::sudo::SudoManager;
use crate::tui::app::App;
use crate::tui::events::handle_key_event;
use crate::tui::ui::render;

pub mod app;
pub mod events;
pub mod ui;

/// Run the interactive TUI
pub async fn run_tui(sudo: Arc<SudoManager>) -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Channel for background async tasks to communicate with UI thread
    let (msg_tx, mut msg_rx) = mpsc::unbounded_channel();

    let mut app = App::new(sudo, msg_tx);
    // Trigger initial background scan on launch
    app.trigger_background_scan();

    while app.running {
        // Drain any incoming background messages
        while let Ok(msg) = msg_rx.try_recv() {
            app.handle_message(msg);
        }

        terminal.draw(|f| render(f, &app))?;

        // Poll for user keyboard input with small timeout (smooth 60fps)
        if event::poll(Duration::from_millis(30))?
            && let Event::Key(key) = event::read()?
        {
            handle_key_event(&mut app, key);
        }
    }

    // Teardown & clean terminal restoration
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    // Wipe sudo credentials on session termination
    app.sudo.clear();

    Ok(())
}
