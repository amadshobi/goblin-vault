//! pm — Flatpak Universal Package Manager Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct FlatpakManager;

#[async_trait]
impl PackageManager for FlatpakManager {
    fn id(&self) -> TargetId {
        TargetId::Flatpak
    }

    fn hint(&self) -> &'static str {
        "Flatpak desktop application sandbox"
    }

    async fn detect(&self) -> bool {
        has_command("flatpak").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("flatpak", &["remote-ls", "--updates"], ExecMode::Quiet).await;
        let stdout = match res {
            Ok(r) => r.stdout,
            Err(_) => return Ok(vec![]),
        };

        let lines: Vec<&str> = stdout.lines().filter(|l| !l.trim().is_empty()).collect();
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
            let item =
                OutdatedItem::new(TargetId::Flatpak, name).with_versions("installed", "latest");
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
        let res = exec_cmd("flatpak", &["update", "-y", "--noninteractive"], mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            "Flatpak apps updated successfully".to_string()
        } else {
            format!("Flatpak update failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Flatpak,
            label: self.label().to_string(),
            ok: res.ok,
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

        let mut args = vec!["install", "-y", "flathub"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_cmd("flatpak", &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("flatpak install -y flathub {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd(
            "flatpak",
            &["list", "--app", "--columns=application,version"],
            ExecMode::Quiet,
        )
        .await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
