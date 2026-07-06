const { execSync } = require('child_process');
const p = require('@clack/prompts');
const color = require('picocolors');
const { clearLastLines } = require('./display');

/**
 * Execute a gh command and return parsed JSON output.
 * @param {string} cmd - The gh subcommand (e.g. 'pr list --json number,title,state')
 * @param {object} [opts]
 * @param {boolean} [opts.raw] - Return raw string instead of JSON
 * @param {boolean} [opts.silent] - Suppress errors
 * @returns {any} Parsed JSON or raw string
 */
function ghExec(cmd, opts = {}) {
  const fullCmd = `gh ${cmd}`;
  try {
    const out = execSync(fullCmd, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: opts.silent ? 'pipe' : 'pipe',
      timeout: 30000,
    }).trim();
    if (opts.raw) return out;
    return out ? JSON.parse(out) : null;
  } catch (err) {
    if (opts.silent) return null;
    const msg = err.stderr?.trim() || err.message;
    throw new Error(`gh error: ${msg}`);
  }
}

/**
 * Run gh command and return raw output (for display, diffs, etc.)
 */
function ghRaw(cmd, opts = {}) {
  return ghExec(cmd, { ...opts, raw: true });
}

/**
 * Get the current repository (owner/name) from the working directory.
 * Falls back to prompting the user.
 */
function getCurrentRepo() {
  try {
    const out = ghRaw('repo view --json nameWithOwner 2>/dev/null', { silent: true });
    if (out) {
      const parsed = JSON.parse(out);
      if (parsed?.nameWithOwner) return parsed.nameWithOwner;
    }
  } catch (_) {}
  return null;
}

async function selectRepo(message = 'Pilih repository:') {
  const s = p.spinner();
  s.start('Fetching repos...');
  try {
    const repos = ghExec('repo list --limit 50 --json nameWithOwner');
    s.stop('Repos fetched');
    if (!repos || repos.length === 0) {
      p.cancel(color.red('Tidak ada repository ditemukan.'));
      clearLastLines(2);
      return null;
    }
    const choices = repos.map(r => ({
      value: r.nameWithOwner,
      label: r.nameWithOwner,
    }));
    const selected = await p.select({
      message,
      options: choices,
    });
    if (p.isCancel(selected)) { clearLastLines(2); return null; }
    return selected;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(`Gagal fetch repos: ${err.message}`));
    clearLastLines(2);
    return null;
  }
}

module.exports = { ghExec, ghRaw, getCurrentRepo, selectRepo };
