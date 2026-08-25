//! pm — Universal Package & Registry Manager
//! Goblin Vault Command Center (Rust + Ratatui + Tokio)

use clap::{Parser, Subcommand};
use colored::*;
use std::sync::Arc;

use pm::core::types::{ExecMode, TargetId};
use pm::managers::{all_managers, find_manager};
use pm::registry::{search_all_registries, search_single_registry};
use pm::sudo::SudoManager;
use pm::tui::run_tui;

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn render_banner() {
    println!();
    println!("{}", " ██████╗ ███╗   ███╗".bold().white());
    println!("{}", " ██╔══██╗████╗ ████║".bold().white());
    println!("{}", " ██████╔╝██╔████╔██║".bold().white());
    println!("{}", " ██╔═══╝ ██║╚██╔╝██║".bold().white());
    println!("{}", " ██║     ██║ ╚═╝ ██║".bold().white());
    println!("{}", " ╚═╝     ╚═╝     ╚═╝".bold().white());
    println!(
        "   {} {} — {}",
        "pm".bold().white(),
        format!("v{}", VERSION).dimmed(),
        "Universal Package & Registry Manager".dimmed()
    );
    println!();
}

#[derive(Parser, Debug)]
#[command(
    name = "pm",
    author = "amadshobi",
    version,
    about = "Universal Package & Registry Manager for Goblin Vault",
    long_about = "pm unites system-wide package updates (APT, Snap, Flatpak, Bun, OMP, Rustup, Brew, PIP, NPM, Cargo) and live multi-registry package search & installation in one high-performance Ratatui TUI and headless CLI."
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// Run non-interactive full update for all outdated packages (alias to `pm update --all`)
    #[arg(short = 'y', long = "yes", global = true)]
    yes: bool,

    /// Show verbose live output during execution
    #[arg(short = 'v', long = "verbose", global = true)]
    verbose: bool,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Launch interactive Ratatui TUI (Default if no args given in TTY)
    Tui,

    /// Search package across live registries (NPM, Crates.io, PyPI, APT, Brew)
    Search {
        /// Search keyword
        query: String,
        /// Filter search by specific registry (npm, crates, pypi, apt, brew)
        #[arg(short, long)]
        registry: Option<String>,
    },

    /// Install package directly from specified or detected ecosystem
    Install {
        /// Package name(s) to install
        packages: Vec<String>,
        /// Target package manager / registry (apt, npm, bun, pip, cargo, brew)
        #[arg(short, long)]
        target: Option<String>,
    },

    /// Scan and update outdated packages
    Update {
        /// Specific target to update (apt, snap, bun, omp, rustup, brew, pip, npm, cargo, or all)
        target: Option<String>,
        /// Update all outdated packages without confirmation
        #[arg(short = 'a', long = "all")]
        all: bool,
    },

    /// List installed packages per ecosystem
    List {
        /// Target ecosystem to inspect
        target: Option<String>,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let sudo = Arc::new(SudoManager::new());
    let mode = if cli.verbose {
        ExecMode::Verbose
    } else {
        ExecMode::Quiet
    };

    match cli.command {
        Some(Commands::Search { query, registry }) => {
            render_banner();
            println!(
                "🔍 {} '{}' across registries...",
                "Searching".cyan(),
                query.bold()
            );

            let results = if let Some(reg_str) = registry {
                if let Some(target_id) = TargetId::from_str_loose(&reg_str) {
                    search_single_registry(target_id, &query, 10).await?
                } else {
                    eprintln!("❌ Target registry '{}' is unknown.", reg_str);
                    return Ok(());
                }
            } else {
                search_all_registries(&query, 5).await
            };

            if results.is_empty() {
                println!("{}", "❌ No matching packages found.".yellow());
                return Ok(());
            }

            println!(
                "\n{:<25} {:<12} {:<12} {}",
                "PACKAGE".bold(),
                "VERSION".bold(),
                "REGISTRY".bold(),
                "DESCRIPTION".bold()
            );
            println!("{}", "─".repeat(75).dimmed());
            for r in results {
                let desc = if r.description.len() > 35 {
                    format!("{}...", &r.description[..32])
                } else {
                    r.description
                };
                println!(
                    "{:<25} {:<12} {:<12} {}",
                    r.name.cyan(),
                    r.version.green(),
                    r.registry.as_str().yellow(),
                    desc.dimmed()
                );
            }
            println!();
        }

        Some(Commands::Install { packages, target }) => {
            render_banner();
            let target_id = target
                .as_deref()
                .and_then(TargetId::from_str_loose)
                .unwrap_or(TargetId::Apt);

            if let Some(mgr) = find_manager(target_id) {
                if target_id.requires_sudo() {
                    let _ =
                        sudo.prompt_cli("Sudo authentication required for package installation");
                }
                println!("📦 Installing {:?} via {}...", packages, mgr.label().cyan());
                mgr.install(&packages, &sudo, mode).await?;
                println!("{}", "✅ Package installation completed!".green());
            } else {
                eprintln!("❌ Package manager not found.");
            }
        }

        Some(Commands::Update { target, all }) => {
            render_banner();
            let update_all = all || cli.yes || target.as_deref() == Some("all");

            if update_all {
                println!("{}", "🔄 Starting system-wide update scan...".cyan());
                let managers = all_managers();
                for m in managers {
                    if m.detect().await {
                        if m.id().requires_sudo() {
                            let _ =
                                sudo.prompt_cli(&format!("Sudo required to update {}", m.label()));
                        }
                        println!("▶ Updating {}...", m.label().cyan());
                        let outcome = m.update(None, &sudo, mode).await?;
                        if outcome.ok {
                            println!(
                                "  {} {} {}",
                                "✔".green(),
                                outcome.label,
                                outcome.message.dimmed()
                            );
                        } else {
                            println!(
                                "  {} {} {}",
                                "✖".red(),
                                outcome.label,
                                outcome.message.yellow()
                            );
                        }
                    }
                }
                println!("{}", "🎉 System-wide update completed!".green());
            } else if let Some(target_str) = target
                && let Some(target_id) = TargetId::from_str_loose(&target_str)
                && let Some(mgr) = find_manager(target_id)
            {
                if target_id.requires_sudo() {
                    let _ = sudo.prompt_cli(&format!("Sudo required to update {}", mgr.label()));
                }
                println!("▶ Updating {}...", mgr.label().cyan());
                let outcome = mgr.update(None, &sudo, mode).await?;
                if outcome.ok {
                    println!("  {} {}", "✔".green(), outcome.message);
                } else {
                    println!("  {} {}", "✖".red(), outcome.message);
                }
            }
        }

        Some(Commands::List { target }) => {
            render_banner();
            let managers = all_managers();
            for m in managers {
                if let Some(t_str) = &target
                    && m.id().as_str() != t_str.to_lowercase()
                {
                    continue;
                }
                if m.detect().await {
                    println!(
                        "\n{} ({})",
                        m.label().bold().cyan(),
                        m.id().as_str().dimmed()
                    );
                    println!("{}", "─".repeat(40).dimmed());
                    if let Ok(pkgs) = m.list_installed().await {
                        for p in pkgs.iter().take(10) {
                            println!("  • {}", p);
                        }
                        if pkgs.len() > 10 {
                            println!(
                                "  {}",
                                format!("... and {} more packages.", pkgs.len() - 10).dimmed()
                            );
                        }
                    }
                }
            }
        }

        Some(Commands::Tui) | None => {
            // Check if stdin / stdout is TTY via safe Rust standard library
            use std::io::IsTerminal;
            if !std::io::stdin().is_terminal() || !std::io::stdout().is_terminal() {
                println!(
                    "{}",
                    "ℹ️ Non-TTY environment detected — fallback to headless auto-update.".dimmed()
                );
                let managers = all_managers();
                for m in managers {
                    if m.detect().await {
                        let outcome = m.update(None, &sudo, mode).await?;
                        println!(
                            "  {} {}",
                            if outcome.ok { "✔" } else { "✖" },
                            outcome.message
                        );
                    }
                }
            } else {
                run_tui(sudo).await?;
            }
        }
    }

    Ok(())
}
