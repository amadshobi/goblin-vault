//! pm — Homebrew Package Manager Adapter (macOS / Linuxbrew)

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct BrewManager;

#[async_trait]
impl PackageManager for BrewManager {
    fn id(&self) -> TargetId {
        TargetId::Brew
    }

    fn hint(&self) -> &'static str {
        "Homebrew package manager (macOS / Linuxbrew)"
    }

    async fn detect(&self) -> bool {
        has_command("brew").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("brew", &["outdated"], ExecMode::Quiet).await?;
        let lines: Vec<&str> = res
            .stdout
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect();
        if lines.is_empty() {
            return Ok(vec![]);
        }

        let mut items = Vec::new();
        for line in lines {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }
            let name = parts[0];
            let item = OutdatedItem::new(TargetId::Brew, name).with_versions("installed", "latest");
            items.push(item);
        }

        Ok(items)
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let r1 = exec_cmd("brew", &["update"], mode).await?;
        let r2 = exec_cmd("brew", &["upgrade"], mode).await?;
        let ok = r1.ok && r2.ok;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if ok {
            "Homebrew packages updated successfully".to_string()
        } else {
            format!("brew upgrade failed (exit code {})", r2.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Brew,
            label: self.label().to_string(),
            ok,
            message,
            duration_ms,
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

        let res = exec_cmd("brew", &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("brew install {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("brew", &["list", "--versions"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
