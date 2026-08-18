//! pm — Detection utilities for host executables

use std::process::Stdio;
use tokio::process::Command;

/// Check if a binary command is available in system PATH
pub async fn has_command(bin: &str) -> bool {
    let output = Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {}", bin))
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await;

    match output {
        Ok(out) => out.status.success() && !out.stdout.is_empty(),
        Err(_) => false,
    }
}
