//! pm — Bun Runtime & Package Manager Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct BunManager;

#[async_trait]
impl PackageManager for BunManager {
    fn id(&self) -> TargetId {
        TargetId::Bun
    }

    fn hint(&self) -> &'static str {
        "Bun ultra-fast JavaScript/TypeScript runtime & package manager"
    }

    async fn detect(&self) -> bool {
        has_command("bun").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        // Bun check upgrade dry/info
        let res = exec_cmd("bun", &["upgrade", "--dry-run"], ExecMode::Quiet).await;
        if let Ok(r) = res {
            let output = format!("{}\n{}", r.stdout, r.stderr);
            if output.contains("already on the latest") || output.contains("is up to date") {
                return Ok(vec![]);
            }
        }

        // Return single target upgrade option if bun is available
        Ok(vec![
            OutdatedItem::new(TargetId::Bun, "bun").with_versions("installed", "latest"),
        ])
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let res = exec_cmd("bun", &["upgrade"], mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            "Bun runtime upgraded successfully".to_string()
        } else {
            format!("Bun upgrade failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Bun,
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

        let mut args = vec!["add", "-g"];
        for p in packages {
            args.push(p.as_str());
        }

        let res = exec_cmd("bun", &args, mode).await?;
        if res.ok {
            Ok(())
        } else {
            Err(PmError::ExecFailed {
                command: format!("bun add -g {}", packages.join(" ")),
                exit_code: res.exit_code,
                stderr: res.stderr,
            })
        }
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("bun", &["pm", "ls", "-g"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
