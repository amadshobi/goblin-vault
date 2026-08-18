//! pm — Core domain models & data types

use serde::{Deserialize, Serialize};
use std::fmt;

/// Identifier for supported Package Managers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TargetId {
    Apt,
    Snap,
    Flatpak,
    Bun,
    Omp,
    Rustup,
    Brew,
    Pip,
    Npm,
    Cargo,
}

impl TargetId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Apt => "apt",
            Self::Snap => "snap",
            Self::Flatpak => "flatpak",
            Self::Bun => "bun",
            Self::Omp => "omp",
            Self::Rustup => "rustup",
            Self::Brew => "brew",
            Self::Pip => "pip",
            Self::Npm => "npm",
            Self::Cargo => "cargo",
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::Apt => "📦 System: APT",
            Self::Snap => "📦 System: SNAP",
            Self::Flatpak => "📦 System: Flatpak",
            Self::Bun => "🍞 Runtime: Bun",
            Self::Omp => "🧙 CLI: Oh My Pi (omp)",
            Self::Rustup => "🦀 Runtime: Rust Toolchain",
            Self::Brew => "🍺 Package: Homebrew",
            Self::Pip => "🐍 Python: PIP",
            Self::Npm => "📦 NPM Global",
            Self::Cargo => "🦀 Rust: Cargo / Crates",
        }
    }

    pub fn category(&self) -> &'static str {
        match self {
            Self::Apt | Self::Snap | Self::Flatpak => "System",
            Self::Bun | Self::Omp | Self::Rustup => "Toolchains",
            Self::Brew | Self::Pip | Self::Npm | Self::Cargo => "Dev & Runtimes",
        }
    }

    pub fn requires_sudo(&self) -> bool {
        matches!(self, Self::Apt | Self::Snap)
    }

    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.to_lowercase().trim() {
            "apt" | "apt-get" | "debian" | "ubuntu" => Some(Self::Apt),
            "snap" => Some(Self::Snap),
            "flatpak" => Some(Self::Flatpak),
            "bun" => Some(Self::Bun),
            "omp" | "oh-my-pi" => Some(Self::Omp),
            "rustup" | "rust" => Some(Self::Rustup),
            "brew" | "homebrew" => Some(Self::Brew),
            "pip" | "pip3" | "pypi" | "python" => Some(Self::Pip),
            "npm" | "node" => Some(Self::Npm),
            "cargo" | "crates" | "crates.io" => Some(Self::Cargo),
            _ => None,
        }
    }
}

impl fmt::Display for TargetId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Outdated package representation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OutdatedItem {
    /// Unique identifier for selection (e.g., "npm:opencode", "apt:ripgrep", "bun:bun")
    pub id: String,
    /// Parent target manager ID
    pub target: TargetId,
    /// Package or tool name
    pub name: String,
    /// Current installed version
    pub current_version: Option<String>,
    /// Available upgrade version
    pub latest_version: Option<String>,
    /// Summary or brief description
    pub summary: Option<String>,
    /// Is this item selected for upgrade in UI?
    pub selected: bool,
}

impl OutdatedItem {
    pub fn new(target: TargetId, name: impl Into<String>) -> Self {
        let name_str = name.into();
        Self {
            id: format!("{}:{}", target.as_str(), name_str),
            target,
            name: name_str,
            current_version: None,
            latest_version: None,
            summary: None,
            selected: true,
        }
    }

    pub fn with_versions(mut self, current: impl Into<String>, latest: impl Into<String>) -> Self {
        self.current_version = Some(current.into());
        self.latest_version = Some(latest.into());
        self
    }
}

/// Result outcome after running an update on a target or package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateOutcome {
    pub target: TargetId,
    pub label: String,
    pub ok: bool,
    pub message: String,
    pub duration_ms: u64,
}

/// Registry search package item
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RegistryPackage {
    pub name: String,
    pub registry: TargetId,
    pub version: String,
    pub description: String,
    pub author: Option<String>,
    pub homepage: Option<String>,
    pub repository: Option<String>,
    pub downloads: Option<u64>,
}

/// Execution output mode
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecMode {
    Quiet,
    Verbose,
}
