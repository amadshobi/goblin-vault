//! pm — Sudo credential & safe memory manager
//!
//! Sudo credentials are kept ONLY in-memory wrapped inside Zeroizing<String>.
//! When dropped or explicitly cleared, memory buffers are overwritten with zeroes.
//! Password injection uses `sudo -S -p ""` to read from child process stdin,
//! preventing TTY collisions with Ratatui or interactive prompts.

use std::sync::Mutex;
use zeroize::Zeroizing;

use crate::core::error::{PmError, Result};

pub struct SudoManager {
    password: Mutex<Option<Zeroizing<String>>>,
}

impl Default for SudoManager {
    fn default() -> Self {
        Self::new()
    }
}

impl SudoManager {
    pub fn new() -> Self {
        Self {
            password: Mutex::new(None),
        }
    }

    /// Check if current process is running as root (UID 0)
    pub fn is_root() -> bool {
        unsafe { libc::geteuid() == 0 }
    }

    /// Check if a valid password is stored in memory
    pub fn has_password(&self) -> bool {
        if let Ok(guard) = self.password.lock() {
            guard.is_some()
        } else {
            false
        }
    }

    /// Get a clone of the in-memory password (wrapped in Zeroizing)
    pub fn get_password(&self) -> Option<Zeroizing<String>> {
        self.password.lock().ok()?.as_ref().cloned()
    }

    /// Store password securely in memory
    pub fn set_password(&self, pw: String) {
        if let Ok(mut guard) = self.password.lock() {
            *guard = Some(Zeroizing::new(pw));
        }
    }

    /// Explicitly clear password from memory and zero out buffer
    pub fn clear(&self) {
        if let Ok(mut guard) = self.password.lock()
            && guard.take().is_some()
        {
            // Dim notice for safety log
            eprintln!("\x1b[2m🔒 Sudo credential securely wiped from session memory.\x1b[0m");
        }
    }

    /// Prompt user for sudo password in Headless CLI mode using /dev/tty
    pub fn prompt_cli(&self, message: &str) -> Result<()> {
        if Self::is_root() || self.has_password() {
            return Ok(());
        }

        eprintln!("\n🔑 {}", message);
        let pass = rpassword::prompt_password("Password: ").map_err(|_| PmError::SudoCancelled)?;

        if pass.trim().is_empty() {
            return Err(PmError::SudoCancelled);
        }

        self.set_password(pass);
        Ok(())
    }
}
