//! pm — APT Package Manager Adapter (Debian / Ubuntu)

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::{exec_cmd, exec_sudo};
use crate::sudo::SudoManager;

pub struct AptManager;

#[async_trait]
impl PackageManager for AptManager {
    fn id(&self) -> TargetId {
        TargetId::Apt
    }

    fn hint(&self) -> &'static str {
        "Debian/Ubuntu system packages (apt-get / dpkg)"
    }

    async fn detect(&self) -> bool {
        has_command("apt").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("apt", &["list", "--upgradable"], ExecMode::Quiet).await?;
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
            // Sample line: "ripgrep/noble 14.1.0-1 amd64 [upgradable from: 13.0.0-1]"
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }
            let name_full = parts[0].split('/').next().unwrap_or(parts[0]);
            let latest = parts.get(1).copied().unwrap_or("latest");
            let current = line
                .split("upgradable from:")
                .nth(1)
                .map(|s| s.trim_matches(|c: char| c == ' ' || c == ']').trim())
                .unwrap_or("installed");

            let item = OutdatedItem::new(TargetId::Apt, name_full).with_versions(current, latest);
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

        // 1. apt update
        let r1 = exec_sudo("apt", &["update"], sudo, mode).await?;
        // 2. apt upgrade -y
        let r2 = exec_sudo("apt", &["upgrade", "-y"], sudo, mode).await?;
        // 3. apt autoremove -y
        let r3 = exec_sudo("apt", &["autoremove", "-y"], sudo, mode).await?;
        // 4. apt autoclean -y
        let r4 = exec_sudo("apt", &["autoclean", "-y"], sudo, mode).await?;

        let ok = r1.ok && r2.ok && r3.ok && r4.ok;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if ok {
            "APT packages updated successfully".to_string()
        } else {
            format!("APT update failed (exit code {})", r2.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Apt,
            label: self.label().to_string(),
            ok,
            message,
            duration_ms,
        })
    }

    async fn install(&self, packages: &[String], sudo: &SudoManager, mode: ExecMode) -> Result<()> {
        if packages.is_empty() {
            return Ok(());
        }

        let mut args = vec!["install", "-y"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_sudo("apt", &args, sudo, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("apt install -y {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd(
            "dpkg-query",
            &["-f", "${Package} ${Version}\n", "-W"],
            ExecMode::Quiet,
        )
        .await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
