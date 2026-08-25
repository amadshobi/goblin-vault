//! pm — Crates.io Registry API Client

use serde::Deserialize;
use std::time::Duration;

use crate::core::error::{PmError, Result};
use crate::core::types::{RegistryPackage, TargetId};

const CRATES_API: &str = "https://crates.io/api/v1/crates";
const USER_AGENT: &str = concat!("pm/", env!("CARGO_PKG_VERSION"), " (goblin-vault)");

#[derive(Deserialize, Debug)]
struct CratesSearchResponse {
    crates: Vec<CrateItem>,
}

#[derive(Deserialize, Debug)]
struct CrateItem {
    name: String,
    max_version: Option<String>,
    newest_version: Option<String>,
    description: Option<String>,
    homepage: Option<String>,
    repository: Option<String>,
    downloads: Option<u64>,
}

pub async fn search_crates_io(query: &str, limit: usize) -> Result<Vec<RegistryPackage>> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| PmError::RegistryHttp {
            url: CRATES_API.to_string(),
            source: e,
        })?;

    let url = format!("{}?q={}&per_page={}", CRATES_API, query, limit);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| PmError::RegistryHttp {
            url: url.clone(),
            source: e,
        })?;

    if !resp.status().is_success() {
        return Err(PmError::RegistryParse {
            registry: "crates.io".to_string(),
            detail: format!("HTTP {}", resp.status()),
        });
    }

    let parsed: CratesSearchResponse = resp.json().await.map_err(|e| PmError::RegistryParse {
        registry: "crates.io".to_string(),
        detail: e.to_string(),
    })?;

    let results = parsed
        .crates
        .into_iter()
        .map(|c| {
            let version = c
                .max_version
                .or(c.newest_version)
                .unwrap_or_else(|| "unknown".to_string());
            let description = c.description.unwrap_or_default();
            RegistryPackage {
                name: c.name,
                registry: TargetId::Cargo,
                version,
                description,
                author: None,
                homepage: c.homepage,
                repository: c.repository,
                downloads: c.downloads,
            }
        })
        .collect();

    Ok(results)
}
