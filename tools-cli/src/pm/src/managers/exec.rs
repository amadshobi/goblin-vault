//! pm — Command execution engine with Sudo-S injection & stream piping

use std::process::Stdio;
use std::time::Instant;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::core::error::{PmError, Result};
use crate::core::types::ExecMode;
use crate::sudo::SudoManager;

#[derive(Debug, Clone)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub ok: bool,
}

/// Execute a normal (non-root) command asynchronously
pub async fn exec_cmd(program: &str, args: &[&str], mode: ExecMode) -> Result<ExecResult> {
    let start = Instant::now();
    let mut cmd = Command::new(program);
    cmd.args(args);

    match mode {
        ExecMode::Quiet => {
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
        }
        ExecMode::Verbose => {
            cmd.stdout(Stdio::inherit());
            cmd.stderr(Stdio::inherit());
        }
    }

    let output = cmd.output().await.map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            PmError::CommandNotFound(program.to_string())
        } else {
            PmError::Io(e)
        }
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    let ok = output.status.success();
    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(ExecResult {
        stdout,
        stderr,
        exit_code,
        duration_ms,
        ok,
    })
}

/// Execute a command requiring root privileges using SudoManager stdin injection
pub async fn exec_sudo(
    program: &str,
    args: &[&str],
    sudo: &SudoManager,
    mode: ExecMode,
) -> Result<ExecResult> {
    // If already root, execute normally without sudo wrapping
    if SudoManager::is_root() {
        return exec_cmd(program, args, mode).await;
    }

    let start = Instant::now();
    let maybe_password = sudo.get_password();

    let mut cmd = Command::new("sudo");
    if maybe_password.is_some() {
        cmd.arg("-S").arg("-p").arg("");
    }
    cmd.arg(program).args(args);

    if maybe_password.is_some() {
        cmd.stdin(Stdio::piped());
    } else {
        cmd.stdin(Stdio::inherit());
    }

    match mode {
        ExecMode::Quiet => {
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());
        }
        ExecMode::Verbose => {
            cmd.stdout(Stdio::inherit());
            cmd.stderr(Stdio::inherit());
        }
    }

    let mut child = cmd.spawn().map_err(PmError::Io)?;

    if let (Some(pw), Some(mut stdin)) = (maybe_password, child.stdin.take()) {
        let _ = stdin
            .write_all(format!("{}\n", pw.as_str()).as_bytes())
            .await;
        let _ = stdin.flush().await;
    }

    let output = child.wait_with_output().await.map_err(PmError::Io)?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let exit_code = output.status.code().unwrap_or(-1);
    let ok = output.status.success();
    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(ExecResult {
        stdout,
        stderr,
        exit_code,
        duration_ms,
        ok,
    })
}
