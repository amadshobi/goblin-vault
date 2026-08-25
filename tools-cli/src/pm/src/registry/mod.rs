//! pm — Multi-Registry Search Engine & Router

use crate::core::error::Result;
use crate::core::types::{RegistryPackage, TargetId};

pub mod apt_search;
pub mod brew_search;
pub mod crates_io;
pub mod npm;
pub mod pypi;

/// Search a specific registry by TargetId
pub async fn search_single_registry(
    registry: TargetId,
    query: &str,
    limit: usize,
) -> Result<Vec<RegistryPackage>> {
    match registry {
        TargetId::Cargo => crates_io::search_crates_io(query, limit).await,
        TargetId::Npm => npm::search_npm(query, limit).await,
        TargetId::Pip => pypi::search_pypi(query, limit).await,
        TargetId::Apt => apt_search::search_apt(query, limit).await,
        TargetId::Brew => brew_search::search_brew(query, limit).await,
        _ => Ok(vec![]),
    }
}

/// Search all available registries concurrently
pub async fn search_all_registries(query: &str, per_registry_limit: usize) -> Vec<RegistryPackage> {
    let (crates_res, npm_res, pypi_res, apt_res, brew_res) = tokio::join!(
        crates_io::search_crates_io(query, per_registry_limit),
        npm::search_npm(query, per_registry_limit),
        pypi::search_pypi(query, per_registry_limit),
        apt_search::search_apt(query, per_registry_limit),
        brew_search::search_brew(query, per_registry_limit),
    );

    let mut all_packages = Vec::new();
    if let Ok(list) = crates_res {
        all_packages.extend(list);
    }
    if let Ok(list) = npm_res {
        all_packages.extend(list);
    }
    if let Ok(list) = pypi_res {
        all_packages.extend(list);
    }
    if let Ok(list) = apt_res {
        all_packages.extend(list);
    }
    if let Ok(list) = brew_res {
        all_packages.extend(list);
    }

    all_packages
}
