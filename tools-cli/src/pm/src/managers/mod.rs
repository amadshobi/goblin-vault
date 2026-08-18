//! pm — Package Manager Trait & Definitions

use async_trait::async_trait;

use crate::core::error::Result;
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::sudo::SudoManager;

pub mod apt;
pub mod brew;
pub mod bun;
pub mod cargo_pm;
pub mod detect;
pub mod exec;
pub mod flatpak;
pub mod npm;
pub mod omp;
pub mod pip;
pub mod rustup;
pub mod snap;

#[async_trait]
pub trait PackageManager: Send + Sync {
    /// Unique identifier for this manager
    fn id(&self) -> TargetId;

    /// Display label for TUI & CLI headers
    fn label(&self) -> &'static str {
        self.id().display_label()
    }

    /// Descriptive hint for help & preview
    fn hint(&self) -> &'static str;

    /// Check if the package manager executable exists in PATH
    async fn detect(&self) -> bool;

    /// Scan for available outdated packages/upgrades
    async fn scan(&self) -> Result<Vec<OutdatedItem>>;

    /// Update outdated packages (or all if selected is None)
    async fn update(
        &self,
        selected_ids: Option<&[String]>,
        sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome>;

    /// Install specific package(s)
    async fn install(&self, packages: &[String], sudo: &SudoManager, mode: ExecMode) -> Result<()>;

    /// List installed packages
    async fn list_installed(&self) -> Result<Vec<String>>;
}

/// Retrieve all registered package manager instances
pub fn all_managers() -> Vec<Box<dyn PackageManager>> {
    vec![
        Box::new(apt::AptManager),
        Box::new(snap::SnapManager),
        Box::new(flatpak::FlatpakManager),
        Box::new(bun::BunManager),
        Box::new(omp::OmpManager),
        Box::new(rustup::RustupManager),
        Box::new(brew::BrewManager),
        Box::new(pip::PipManager),
        Box::new(npm::NpmManager),
        Box::new(cargo_pm::CargoManager),
    ]
}

/// Find manager instance by TargetId
pub fn find_manager(target: TargetId) -> Option<Box<dyn PackageManager>> {
    all_managers().into_iter().find(|m| m.id() == target)
}
