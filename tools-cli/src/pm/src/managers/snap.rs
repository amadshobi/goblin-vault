//! pm — Snap Universal Package Manager Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::{exec_cmd, exec_sudo};
use crate::sudo::SudoManager;

pub struct SnapManager;

#[async_trait]
impl PackageManager for SnapManager {
    fn id(&self) -> TargetId {
        TargetId::Snap
    }

    fn hint(&self) -> &'static str {
        "Canonical Snap universal container packages"
    }

    async fn detect(&self) -> bool {
        has_command("snap").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("snap", &["refresh", "--list"], ExecMode::Quiet).await?;
        let lines: Vec<&str> = res
            .stdout
            .lines()
            .skip(1)
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
            let latest = parts.get(1).copied().unwrap_or("latest");

            let item = OutdatedItem::new(TargetId::Snap, name).with_versions("installed", latest);
            items.push(item);
        }

        Ok(items)
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let res = exec_sudo("snap", &["refresh"], sudo, mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            "SNAP packages refreshed successfully".to_string()
        } else {
            format!("SNAP refresh failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Snap,
            label: self.label().to_string(),
            ok: res.ok,
            message,
            duration_ms,
        })
    }

    async fn install(&self, packages: &[String], sudo: &SudoManager, mode: ExecMode) -> Result<()> {
        if packages.is_empty() {
            return Ok(());
        }

        let mut args = vec!["install"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_sudo("snap", &args, sudo, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("snap install {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("snap", &["list"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().skip(1).map(|s| s.to_string()).collect())
    }
}
