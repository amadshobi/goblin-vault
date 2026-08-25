//! pm — Python PIP Package Manager Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct PipManager;

#[async_trait]
impl PackageManager for PipManager {
    fn id(&self) -> TargetId {
        TargetId::Pip
    }

    fn hint(&self) -> &'static str {
        "Python PyPI packages (pip3 user / environment)"
    }

    async fn detect(&self) -> bool {
        has_command("pip3").await || has_command("pip").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let pip_bin = if has_command("pip3").await {
            "pip3"
        } else {
            "pip"
        };
        let res = exec_cmd(
            pip_bin,
            &["list", "--outdated", "--format=freeze"],
            ExecMode::Quiet,
        )
        .await?;

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
            // Line format: "requests==2.31.0" or similar
            let parts: Vec<&str> = line.split("==").collect();
            let name = parts[0].trim();
            let current = parts.get(1).copied().unwrap_or("installed");

            let item = OutdatedItem::new(TargetId::Pip, name).with_versions(current, "latest");
            items.push(item);
        }

        Ok(items)
    }

    async fn update(
        &self,
        selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let pip_bin = if has_command("pip3").await {
            "pip3"
        } else {
            "pip"
        };

        let all_items = self.scan().await?;
        let target_pkgs: Vec<String> = match selected_ids {
            Some(ids) => {
                let prefix = "pip:";
                ids.iter()
                    .filter(|id| id.starts_with(prefix))
                    .map(|id| id[prefix.len()..].to_string())
                    .collect()
            }
            None => all_items.into_iter().map(|it| it.name).collect(),
        };

        if target_pkgs.is_empty() {
            return Ok(UpdateOutcome {
                target: TargetId::Pip,
                label: self.label().to_string(),
                ok: true,
                message: "No pip packages selected / outdated".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        let mut args = vec!["install", "-U", "--break-system-packages", "--user"];
        for p in &target_pkgs {
            args.push(p.as_str());
        }

        let res = exec_cmd(pip_bin, &args, mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            format!("{} pip package(s) upgraded successfully", target_pkgs.len())
        } else {
            format!("pip upgrade failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Pip,
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

        let pip_bin = if has_command("pip3").await {
            "pip3"
        } else {
            "pip"
        };
        let mut args = vec!["install", "--break-system-packages", "--user"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_cmd(pip_bin, &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("{} install {}", pip_bin, packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let pip_bin = if has_command("pip3").await {
            "pip3"
        } else {
            "pip"
        };
        let res = exec_cmd(pip_bin, &["list", "--format=freeze"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
