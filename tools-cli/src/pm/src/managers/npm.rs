//! pm — NPM Global Package Manager Adapter

use async_trait::async_trait;
use serde_json::Value;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct NpmManager;

#[async_trait]
impl PackageManager for NpmManager {
    fn id(&self) -> TargetId {
        TargetId::Npm
    }

    fn hint(&self) -> &'static str {
        "Node.js NPM global package repository"
    }

    async fn detect(&self) -> bool {
        has_command("npm").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("npm", &["outdated", "-g", "--json"], ExecMode::Quiet).await?;
        if res.stdout.trim().is_empty() || res.stdout == "{}" || res.stdout == "[]" {
            return Ok(vec![]);
        }

        let parsed: Value = match serde_json::from_str(&res.stdout) {
            Ok(v) => v,
            Err(_) => return Ok(vec![]),
        };

        let mut items = Vec::new();
        if let Some(obj) = parsed.as_object() {
            for (pkg_name, info) in obj {
                let current = info
                    .get("current")
                    .and_then(|v| v.as_str())
                    .unwrap_or("installed");
                let latest = info
                    .get("latest")
                    .and_then(|v| v.as_str())
                    .unwrap_or("latest");

                let item =
                    OutdatedItem::new(TargetId::Npm, pkg_name).with_versions(current, latest);
                items.push(item);
            }
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
        let all_items = self.scan().await?;

        let target_pkgs: Vec<String> = match selected_ids {
            Some(ids) => {
                let prefix = "npm:";
                ids.iter()
                    .filter(|id| id.starts_with(prefix))
                    .map(|id| id[prefix.len()..].to_string())
                    .collect()
            }
            None => all_items.into_iter().map(|it| it.name).collect(),
        };

        if target_pkgs.is_empty() {
            return Ok(UpdateOutcome {
                target: TargetId::Npm,
                label: self.label().to_string(),
                ok: true,
                message: "No NPM global packages selected / outdated".to_string(),
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        let mut install_targets: Vec<String> = Vec::new();
        for p in &target_pkgs {
            install_targets.push(format!("{}@latest", p));
        }

        let mut args = vec!["install", "-g"];
        for it in &install_targets {
            args.push(it.as_str());
        }

        let res = exec_cmd("npm", &args, mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            format!("{} NPM package(s) upgraded successfully", target_pkgs.len())
        } else {
            format!("NPM upgrade failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Npm,
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

        let mut args = vec!["install", "-g"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_cmd("npm", &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("npm install -g {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("npm", &["list", "-g", "--depth=0"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().skip(1).map(|s| s.to_string()).collect())
    }
}
