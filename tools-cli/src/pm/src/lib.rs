//! pm — Universal Package & Registry Manager Library Core

pub mod core;
pub mod managers;
pub mod registry;
pub mod sudo;
pub mod tui;

#[cfg(test)]
mod tests {
    use super::core::types::{OutdatedItem, TargetId};
    use super::managers::all_managers;
    use super::managers::detect::has_command;
    use super::registry::search_all_registries;
    use super::sudo::SudoManager;

    #[tokio::test]
    async fn test_target_id_parsing() {
        assert_eq!(TargetId::from_str_loose("apt"), Some(TargetId::Apt));
        assert_eq!(TargetId::from_str_loose("npm"), Some(TargetId::Npm));
        assert_eq!(TargetId::from_str_loose("pip3"), Some(TargetId::Pip));
        assert_eq!(TargetId::from_str_loose("cargo"), Some(TargetId::Cargo));
        assert_eq!(TargetId::from_str_loose("unknown_foo"), None);
    }

    #[tokio::test]
    async fn test_outdated_item_creation() {
        let item = OutdatedItem::new(TargetId::Npm, "opencode").with_versions("0.4.0", "0.4.5");
        assert_eq!(item.id, "npm:opencode");
        assert_eq!(item.name, "opencode");
        assert_eq!(item.current_version.as_deref(), Some("0.4.0"));
        assert_eq!(item.latest_version.as_deref(), Some("0.4.5"));
        assert!(item.selected);
    }

    #[tokio::test]
    async fn test_has_command_detection() {
        assert!(has_command("sh").await);
        assert!(!has_command("non_existent_binary_xyz_123").await);
    }

    #[test]
    fn test_sudo_manager_memory_zeroize() {
        let sudo = SudoManager::new();
        assert!(!sudo.has_password());
        sudo.set_password("secret123".to_string());
        assert!(sudo.has_password());
        assert_eq!(sudo.get_password().unwrap().as_str(), "secret123");
        sudo.clear();
        assert!(!sudo.has_password());
    }

    #[tokio::test]
    async fn test_all_managers_registration() {
        let list = all_managers();
        assert_eq!(list.len(), 10);
        let ids: Vec<TargetId> = list.iter().map(|m| m.id()).collect();
        assert!(ids.contains(&TargetId::Apt));
        assert!(ids.contains(&TargetId::Npm));
        assert!(ids.contains(&TargetId::Cargo));
        assert!(ids.contains(&TargetId::Pip));
        assert!(ids.contains(&TargetId::Bun));
    }

    #[tokio::test]
    async fn test_crates_io_search_integration() {
        let results = search_all_registries("tokio", 3).await;
        assert!(!results.is_empty());
        let has_tokio = results.iter().any(|p| p.name.contains("tokio"));
        assert!(has_tokio);
    }
}
