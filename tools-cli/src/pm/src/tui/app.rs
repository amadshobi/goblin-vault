//! pm — TUI App State Machine & Background Message Protocol

use std::sync::Arc;
use tokio::sync::mpsc::UnboundedSender;

use crate::core::types::{ExecMode, OutdatedItem, RegistryPackage, TargetId};
use crate::managers::all_managers;
use crate::registry::search_all_registries;
use crate::sudo::SudoManager;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActiveTab {
    Updates,
    Search,
    Installed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivePane {
    Sidebar,
    MainList,
    Detail,
    Logs,
}

/// Messages sent from async background workers to the UI thread
#[derive(Debug)]
pub enum AppMessage {
    Log(String),
    ScanStarted,
    ScanFinished(Vec<OutdatedItem>),
    SearchStarted(String),
    SearchFinished(Vec<RegistryPackage>),
    UpdateStarted,
    UpdateFinished,
}

pub struct App {
    pub running: bool,
    pub active_tab: ActiveTab,
    pub active_pane: ActivePane,

    // Sudo manager
    pub sudo: Arc<SudoManager>,
    pub msg_tx: UnboundedSender<AppMessage>,

    // Tab 1 — Updates / Outdated
    pub outdated_items: Vec<OutdatedItem>,
    pub selected_index: usize,
    pub is_scanning: bool,
    pub is_updating: bool,

    // Tab 2 — Live Search & Install
    pub search_query: String,
    pub is_editing_search: bool,
    pub search_results: Vec<RegistryPackage>,
    pub search_index: usize,
    pub is_searching: bool,
    pub selected_registry_filter: Option<TargetId>,

    // Tab 3 — Installed Packages
    pub installed_packages: Vec<(TargetId, String)>,
    pub installed_index: usize,
    pub is_loading_installed: bool,
    pub installed_filter: String,

    // Shared State
    pub logs: Vec<String>,
    pub show_help: bool,
    pub show_sudo_prompt: bool,
    pub sudo_input: String,
}

impl App {
    pub fn new(sudo: Arc<SudoManager>, msg_tx: UnboundedSender<AppMessage>) -> Self {
        Self {
            running: true,
            active_tab: ActiveTab::Updates,
            active_pane: ActivePane::MainList,
            sudo,
            msg_tx,

            outdated_items: Vec::new(),
            selected_index: 0,
            is_scanning: false,
            is_updating: false,

            search_query: String::new(),
            is_editing_search: false,
            search_results: Vec::new(),
            search_index: 0,
            is_searching: false,
            selected_registry_filter: None,

            installed_packages: Vec::new(),
            installed_index: 0,
            is_loading_installed: false,
            installed_filter: String::new(),

            logs: vec![
                "🚀 pm (Universal Package & Registry Manager) initialized.".to_string(),
                "ℹ️ Press '?' for Help, [Space] to toggle, 'u' to update, '/' to search."
                    .to_string(),
            ],
            show_help: false,
            show_sudo_prompt: false,
            sudo_input: String::new(),
        }
    }

    pub fn log(&mut self, message: impl Into<String>) {
        let msg = message.into();
        self.logs.push(msg);
        if self.logs.len() > 100 {
            self.logs.remove(0);
        }
    }

    /// Process incoming background message on the UI thread
    pub fn handle_message(&mut self, msg: AppMessage) {
        match msg {
            AppMessage::Log(l) => {
                self.log(l);
            }
            AppMessage::ScanStarted => {
                self.is_scanning = true;
                self.log("🔍 Scanning package managers in background...");
            }
            AppMessage::ScanFinished(items) => {
                self.is_scanning = false;
                self.outdated_items = items;
                self.selected_index = 0;
                self.log(format!(
                    "✅ Scan finished: {} outdated package(s) detected.",
                    self.outdated_items.len()
                ));
            }
            AppMessage::SearchStarted(q) => {
                self.is_searching = true;
                self.log(format!("🔍 Searching registries for '{}'...", q));
            }
            AppMessage::SearchFinished(results) => {
                self.is_searching = false;
                self.search_results = results;
                self.search_index = 0;
                self.log(format!(
                    "✅ Found {} package(s) across registries.",
                    self.search_results.len()
                ));
            }
            AppMessage::UpdateStarted => {
                self.is_updating = true;
            }
            AppMessage::UpdateFinished => {
                self.is_updating = false;
                self.log("🎉 Update batch completed! Rescanning status...");
                self.trigger_background_scan();
            }
        }
    }

    /// Spawn background scan task without blocking UI thread
    pub fn trigger_background_scan(&self) {
        let tx = self.msg_tx.clone();
        tokio::spawn(async move {
            let _ = tx.send(AppMessage::ScanStarted);

            let managers = all_managers();
            let mut all_outdated = Vec::new();

            for m in managers {
                if m.detect().await
                    && let Ok(mut items) = m.scan().await
                {
                    let _ = tx.send(AppMessage::Log(format!(
                        "  • {}: {} outdated item(s)",
                        m.label(),
                        items.len()
                    )));
                    all_outdated.append(&mut items);
                }
            }

            let _ = tx.send(AppMessage::ScanFinished(all_outdated));
        });
    }

    /// Spawn background live registry search
    pub fn trigger_background_search(&self) {
        if self.search_query.trim().is_empty() {
            return;
        }

        let query = self.search_query.clone();
        let tx = self.msg_tx.clone();

        tokio::spawn(async move {
            let _ = tx.send(AppMessage::SearchStarted(query.clone()));
            let results = search_all_registries(&query, 10).await;
            let _ = tx.send(AppMessage::SearchFinished(results));
        });
    }

    /// Toggle selection on highlighted outdated package
    pub fn toggle_selected(&mut self) {
        if let Some(item) = self.outdated_items.get_mut(self.selected_index) {
            item.selected = !item.selected;
        }
    }

    /// Select all or unselect all
    pub fn toggle_all_selected(&mut self) {
        let any_unselected = self.outdated_items.iter().any(|it| !it.selected);
        for it in &mut self.outdated_items {
            it.selected = any_unselected;
        }
    }

    /// Spawn background update execution
    pub fn trigger_background_update(&self) {
        let selected_ids: Vec<String> = self
            .outdated_items
            .iter()
            .filter(|it| it.selected)
            .map(|it| it.id.clone())
            .collect();

        if selected_ids.is_empty() {
            let _ = self.msg_tx.send(AppMessage::Log(
                "⚠️ No packages selected for update.".to_string(),
            ));
            return;
        }

        let tx = self.msg_tx.clone();
        let sudo = self.sudo.clone();

        tokio::spawn(async move {
            let _ = tx.send(AppMessage::UpdateStarted);
            let _ = tx.send(AppMessage::Log(format!(
                "🔄 Starting update for {} selected package(s)...",
                selected_ids.len()
            )));

            let managers = all_managers();
            for m in managers {
                let target_ids: Vec<String> = selected_ids
                    .iter()
                    .filter(|id| {
                        id.starts_with(&format!("{}:", m.id().as_str())) || *id == m.id().as_str()
                    })
                    .cloned()
                    .collect();

                if !target_ids.is_empty() && m.detect().await {
                    let _ = tx.send(AppMessage::Log(format!("▶ Updating {}...", m.label())));
                    match m.update(Some(&target_ids), &sudo, ExecMode::Quiet).await {
                        Ok(outcome) => {
                            if outcome.ok {
                                let _ = tx.send(AppMessage::Log(format!(
                                    "✅ {} — {}",
                                    outcome.label, outcome.message
                                )));
                            } else {
                                let _ = tx.send(AppMessage::Log(format!(
                                    "❌ {} — {}",
                                    outcome.label, outcome.message
                                )));
                            }
                        }
                        Err(e) => {
                            let _ = tx.send(AppMessage::Log(format!(
                                "❌ Error updating {}: {}",
                                m.label(),
                                e
                            )));
                        }
                    }
                }
            }

            let _ = tx.send(AppMessage::UpdateFinished);
        });
    }
}
