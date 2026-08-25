//! pm — Error domain definitions

use thiserror::Error;

/// Result alias for PM operations
pub type Result<T> = std::result::Result<T, PmError>;

#[derive(Error, Debug)]
pub enum PmError {
    #[error("Command executable not found in PATH: {0}")]
    CommandNotFound(String),

    #[error("Command execution failed [{command}] with exit code {exit_code}: {stderr}")]
    ExecFailed {
        command: String,
        exit_code: i32,
        stderr: String,
    },

    #[error("Command timed out after {timeout_ms}ms: {command}")]
    Timeout { command: String, timeout_ms: u64 },

    #[error("Registry HTTP request failed for {url}: {source}")]
    RegistryHttp {
        url: String,
        #[source]
        source: reqwest::Error,
    },

    #[error("Failed to parse registry response from {registry}: {detail}")]
    RegistryParse { registry: String, detail: String },

    #[error("Sudo authentication cancelled by user")]
    SudoCancelled,

    #[error("Invalid sudo password provided")]
    SudoWrongPassword,

    #[error("Target package manager '{0}' is not supported or recognized")]
    UnknownTarget(String),

    #[error("No packages or targets selected for operation")]
    NoTargetSelected,

    #[error("IO Error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON Serialization / Parsing Error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Unexpected error: {0}")]
    Other(String),
}
