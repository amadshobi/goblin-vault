//! pm — Cargo / Crates.io Package Manager Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct CargoManager;

#[async_trait]
impl PackageManager for CargoManager {
    fn id(&self) -> TargetId {
        TargetId::Cargo
    }

    fn hint(&self) -> &'static str {
        "Rust Cargo binaries & crates.io packages"
    }

    async fn detect(&self) -> bool {
        has_command("cargo").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        // If cargo-install-update (cargo-update crate) is present, we can check outdated
        if has_command("cargo-install-update").await {
            let res = exec_cmd("cargo", &["install-update", "-c"], ExecMode::Quiet).await;
            if let Ok(r) = res {
                let lines: Vec<&str> = r.stdout.lines().filter(|l| !l.trim().is_empty()).collect();
                let mut items = Vec::new();
                for line in lines {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 3 {
                        let name = parts[0];
                        let cur = parts[1];
                        let lat = parts[2];
                        items
                            .push(OutdatedItem::new(TargetId::Cargo, name).with_versions(cur, lat));
                    }
                }
                return Ok(items);
            }
        }

        // Return empty list if no outdated scanner extension is installed
        Ok(vec![])
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();

        if has_command("cargo-install-update").await {
            let res = exec_cmd("cargo", &["install-update", "-a"], mode).await?;
            let duration_ms = start.elapsed().as_millis() as u64;
            let message = if res.ok {
                "Cargo binaries updated successfully".to_string()
            } else {
                format!("cargo install-update failed (exit code {})", res.exit_code)
            };

            return Ok(UpdateOutcome {
                target: TargetId::Cargo,
                label: self.label().to_string(),
                ok: res.ok,
                message,
                duration_ms,
            });
        }

        Ok(UpdateOutcome {
            target: TargetId::Cargo,
            label: self.label().to_string(),
            ok: true,
            message: "cargo-install-update not installed; skip batch auto-update".to_string(),
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    async fn install(
        &self,
        packages: &[String],
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<()> {
        if packages.is_empty() {
            return Ok(());
        }

        let mut args = vec!["install"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_cmd("cargo", &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("cargo install {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("cargo", &["install", "--list"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
