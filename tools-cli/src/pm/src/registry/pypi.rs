//! pm — Python PyPI Search & Lookup Client

use serde::Deserialize;
use std::time::Duration;

use crate::core::error::{PmError, Result};
use crate::core::types::{RegistryPackage, TargetId};

const PYPI_JSON_API: &str = "https://pypi.org/pypi";

#[derive(Deserialize, Debug)]
struct PyPiInfoResponse {
    info: PyPiInfo,
}

#[derive(Deserialize, Debug)]
struct PyPiInfo {
    name: String,
    version: Option<String>,
    summary: Option<String>,
    author: Option<String>,
    home_page: Option<String>,
    project_url: Option<String>,
}

/// Lookup single package metadata directly via official PyPI JSON endpoint
pub async fn lookup_pypi_package(name: &str) -> Result<RegistryPackage> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| PmError::RegistryHttp {
            url: format!("{}/{}/json", PYPI_JSON_API, name),
            source: e,
        })?;

    let url = format!("{}/{}/json", PYPI_JSON_API, name);
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
            registry: "pypi".to_string(),
            detail: format!("Package '{}' not found (HTTP {})", name, resp.status()),
        });
    }

    let parsed: PyPiInfoResponse = resp.json().await.map_err(|e| PmError::RegistryParse {
        registry: "pypi".to_string(),
        detail: e.to_string(),
    })?;

    let info = parsed.info;
    let version = info.version.unwrap_or_else(|| "latest".to_string());
    let description = info.summary.unwrap_or_default();
    let homepage = info.home_page.or(info.project_url);

    Ok(RegistryPackage {
        name: info.name,
        registry: TargetId::Pip,
        version,
        description,
        author: info.author,
        homepage,
        repository: None,
        downloads: None,
    })
}

/// Multi-search query on PyPI
pub async fn search_pypi(query: &str, _limit: usize) -> Result<Vec<RegistryPackage>> {
    // 1. Direct package exact lookup
    if let Ok(pkg) = lookup_pypi_package(query).await {
        return Ok(vec![pkg]);
    }

    // 2. PyPI search scrape fallback
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| PmError::RegistryHttp {
            url: format!("https://pypi.org/search/?q={}", query),
            source: e,
        })?;

    let url = format!("https://pypi.org/search/?q={}", query);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| PmError::RegistryHttp {
            url: url.clone(),
            source: e,
        })?;

    if !resp.status().is_success() {
        return Ok(vec![]);
    }

    let html = resp.text().await.unwrap_or_default();
    let mut names = Vec::new();

    for part in html.split("class=\"package-snippet__name\">") {
        if let Some(end_idx) = part.find('<') {
            let name = part[..end_idx].trim();
            if !name.is_empty() && !names.contains(&name.to_string()) {
                names.push(name.to_string());
            }
        }
    }

    let mut results = Vec::new();
    for name in names.into_iter().take(5) {
        if let Ok(pkg) = lookup_pypi_package(&name).await {
            results.push(pkg);
        }
    }

    Ok(results)
}
