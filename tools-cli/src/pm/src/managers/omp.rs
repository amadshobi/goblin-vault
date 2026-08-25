//! pm — Oh My Pi (omp) CLI Adapter

use async_trait::async_trait;
use std::time::Instant;

use crate::core::error::{PmError, Result};
use crate::core::types::{ExecMode, OutdatedItem, TargetId, UpdateOutcome};
use crate::managers::PackageManager;
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;
use crate::sudo::SudoManager;

pub struct OmpManager;

#[async_trait]
impl PackageManager for OmpManager {
    fn id(&self) -> TargetId {
        TargetId::Omp
    }

    fn hint(&self) -> &'static str {
        "Oh My Pi multi-model AI coding assistant"
    }

    async fn detect(&self) -> bool {
        has_command("omp").await
    }

    async fn scan(&self) -> Result<Vec<OutdatedItem>> {
        // Return single target upgrade item for omp
        Ok(vec![
            OutdatedItem::new(TargetId::Omp, "omp").with_versions("installed", "latest"),
        ])
    }

    async fn update(
        &self,
        _selected_ids: Option<&[String]>,
        _sudo: &SudoManager,
        mode: ExecMode,
    ) -> Result<UpdateOutcome> {
        let start = Instant::now();
        let res = exec_cmd("omp", &["update"], mode).await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        let message = if res.ok {
            "Oh My Pi updated successfully".to_string()
        } else {
            format!("omp update failed (exit code {})", res.exit_code)
        };

        Ok(UpdateOutcome {
            target: TargetId::Omp,
            label: self.label().to_string(),
            ok: res.ok,
            message,
            duration_ms,
        })
    }

    async fn install(
        &self,
        _packages: &[String],
        _sudo: &SudoManager,
        _mode: ExecMode,
    ) -> Result<()> {
        Err(PmError::Other(
            "omp does not support package installations; use 'omp' command directly.".to_string(),
        ))
    }

    async fn list_installed(&self) -> Result<Vec<String>> {
        let res = exec_cmd("omp", &["--version"], ExecMode::Quiet).await?;
        Ok(vec![res.stdout])
    }
}
