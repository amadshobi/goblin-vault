//! pm — NPM Registry Search Client

use serde::Deserialize;
use std::time::Duration;

use crate::core::error::{PmError, Result};
use crate::core::types::{RegistryPackage, TargetId};

const NPM_SEARCH_API: &str = "https://registry.npmjs.org/-/v1/search";

#[derive(Deserialize, Debug)]
struct NpmSearchResponse {
    objects: Vec<NpmObject>,
}

#[derive(Deserialize, Debug)]
struct NpmObject {
    package: NpmPackageInfo,
}

#[derive(Deserialize, Debug)]
struct NpmPackageInfo {
    name: String,
    version: Option<String>,
    description: Option<String>,
    publisher: Option<NpmPublisher>,
    links: Option<NpmLinks>,
}

#[derive(Deserialize, Debug)]
struct NpmPublisher {
    username: Option<String>,
}

#[derive(Deserialize, Debug)]
struct NpmLinks {
    npm: Option<String>,
    homepage: Option<String>,
    repository: Option<String>,
}

pub async fn search_npm(query: &str, limit: usize) -> Result<Vec<RegistryPackage>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| PmError::RegistryHttp {
            url: NPM_SEARCH_API.to_string(),
            source: e,
        })?;

    let url = format!("{}?text={}&size={}", NPM_SEARCH_API, query, limit);
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
            registry: "npm".to_string(),
            detail: format!("HTTP {}", resp.status()),
        });
    }

    let parsed: NpmSearchResponse = resp.json().await.map_err(|e| PmError::RegistryParse {
        registry: "npm".to_string(),
        detail: e.to_string(),
    })?;

    let results = parsed
        .objects
        .into_iter()
        .map(|obj| {
            let pkg = obj.package;
            let version = pkg.version.unwrap_or_else(|| "latest".to_string());
            let description = pkg.description.unwrap_or_default();
            let author = pkg.publisher.and_then(|p| p.username);
            let (homepage, repository) = match pkg.links {
                Some(l) => (l.homepage.or(l.npm), l.repository),
                None => (None, None),
            };

            RegistryPackage {
                name: pkg.name,
                registry: TargetId::Npm,
                version,
                description,
                author,
                homepage,
                repository,
                downloads: None,
            }
        })
        .collect();

    Ok(results)
}
