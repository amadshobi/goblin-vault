//! pm — Rust Toolchain (rustup) Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct RustupManager;

#[async_trait]
impl PackageManager for RustupManager {
    fn id(&self) -> TargetId {
        TargetId::Rustup
    }

    fn hint(&self) -> &'static str {
        "Rust official toolchain installer & manager"
    }

    async fn detect(&self) -> bool {
        has_command("rustup").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        let res = exec_cmd("rustup", &["check"], ExecMode::Quiet).await;
        if let Ok(r) = res {
            let output = format!("{}\n{}", r.stdout, r.stderr);
            if output.to_lowercase().contains("update available") {
                return Ok(vec![
                    OutdatedItem::new(TargetId::Rustup, "rust-toolchain")
                        .with_versions("stable", "latest"),
                ]);
            }
        }
        Ok(vec![])
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let res = exec_cmd("rustup", &["update"], mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            "Rust toolchain updated successfully".to_string()
        } else {
            format!("rustup update failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Rustup,
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
        for toolchain in packages {
            let res = exec_cmd(
                "rustup",
                &["toolchain", "install", toolchain.as_str()],
                mode,
            )
            .await?;
            if !res.ok {
                return Err(PmError::ExecFailed {
                    command: format!("rustup toolchain install {}", toolchain),
                    exit_code: res.exit_code,
                    stderr: res.stderr,
                });
            }
        }
        Ok(())
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("rustup", &["toolchain", "list"], ExecMode::Quiet).await?;
        Ok(res.stdout.lines().map(|s| s.to_string()).collect())
    }
}
