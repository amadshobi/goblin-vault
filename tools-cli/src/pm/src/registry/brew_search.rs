//! pm — Homebrew Local Search Client

use crate::core::error::Result;
use crate::core::types::{ExecMode, RegistryPackage, TargetId};
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;

pub async fn search_brew(query: &str, limit: usize) -> Result<Vec<RegistryPackage>> {
    if !has_command("brew").await {
        return Ok(vec![]);
    }

    let res = exec_cmd("brew", &["search", query], ExecMode::Quiet).await?;
    let mut results = Vec::new();

    for line in res
        .stdout
        .lines()
        .filter(|l| !l.starts_with("==>"))
        .take(limit)
    {
        let name = line.trim();
        if name.is_empty() {
            continue;
        }

        results.push(RegistryPackage {
            name: name.to_string(),
            registry: TargetId::Brew,
            version: "formula".to_string(),
            description: "Homebrew formula".to_string(),
            author: None,
            homepage: None,
            repository: None,
            downloads: None,
        });
    }

    Ok(results)
}
