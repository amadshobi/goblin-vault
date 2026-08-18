//! pm — APT Cache Local Search Client

use crate::core::error::Result;
use crate::core::types::{ExecMode, RegistryPackage, TargetId};
use crate::managers::detect::has_command;
use crate::managers::exec::exec_cmd;

pub async fn search_apt(query: &str, limit: usize) -> Result<Vec<RegistryPackage>> {
    if !has_command("apt-cache").await {
        return Ok(vec![]);
    }

    let res = exec_cmd("apt-cache", &["search", query], ExecMode::Quiet).await?;
    let mut results = Vec::new();

    for line in res.stdout.lines().take(limit) {
        let parts: Vec<&str> = line.split(" - ").collect();
        if parts.is_empty() {
            continue;
        }
        let name = parts[0].trim();
        let description = parts.get(1).copied().unwrap_or_default().trim();

        results.push(RegistryPackage {
            name: name.to_string(),
            registry: TargetId::Apt,
            version: "system".to_string(),
            description: description.to_string(),
            author: None,
            homepage: None,
            repository: None,
            downloads: None,
        });
    }

    Ok(results)
}
