const { spawnSync } = require('child_process');
const p = require('@clack/prompts');
const color = require('picocolors');
const { clearLastLines } = require('./display');

const GH_TIMEOUT = 30000;

/**
 * Low-level: jalankan `gh` via spawnSync dengan array argv — TANPA shell,
 * sehingga aman dari shell injection (argumen dikirim verbatim).
 * @param {string[]} args - Argumen untuk binary `gh` (e.g. ['pr', 'list', ...]).
 * @param {object} [opts]
 * @param {string} [opts.input] - Data yang dikirim ke stdin (untuk --input -).
 * @param {number} [opts.timeout] - Timeout ms (default 30000).
 * @param {boolean} [opts.silent] - Suppress error → return null.
 * @returns {string|null} stdout (atau null kalau silent && gagal).
 * @throws {Error} Kalau gh error dan tidak silent.
 */
function ghSpawn(args, opts = {}) {
  if (!Array.isArray(args) || args.some(a => typeof a !== 'string' && typeof a !== 'number')) {
    throw new Error('ghExec/ghRaw/ghApi: args harus berupa array argv (string/number), bukan string command.');
  }
  const r = spawnSync('gh', args.map(String), {
    input: opts.input,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: opts.timeout || GH_TIMEOUT,
  });
  if (r.error) {
    if (opts.silent) return null;
    throw new Error(`gh error: ${r.error.message}`);
  }
  if (r.status !== 0) {
    if (opts.silent) return null;
    const msg = (r.stderr || r.stdout || '').trim() || `exit ${r.status}`;
    throw new Error(`gh error: ${msg}`);
  }
  return r.stdout || '';
}

/**
 * Execute gh command (array argv) dan parse output JSON.
 * @param {string[]} args - e.g. ['pr', 'list', '--repo', repo, '--json', 'number,title']
 * @param {object} [opts]
 * @param {boolean} [opts.raw] - Return raw string instead of JSON
 * @param {boolean} [opts.silent] - Suppress errors
 * @returns {any} Parsed JSON, raw string, atau null
 */
function ghExec(args, opts = {}) {
  const out = ghSpawn(args, opts);
  if (opts.raw) return out;
  if (out == null) return null;
  try {
    const trimmed = out.trim();
    return trimmed ? JSON.parse(trimmed) : null;
  } catch (err) {
    throw new Error(`gh error: gagal parse output: ${err.message}`);
  }
}

/**
 * Run gh command (array argv) dan return raw output (untuk display, diffs, dll).
 */
function ghRaw(args, opts = {}) {
  return ghExec(args, { ...opts, raw: true });
}

const SUPPORTED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'];

/**
 * Call GitHub REST API via `gh api`. Semua argumen dikirim sebagai array argv
 * (aman); payload body dikirim via stdin (`--input -`).
 * @param {string} endpoint - API endpoint (e.g. '/repos/{owner}/{repo}/issues')
 * @param {object} [opts]
 * @param {string} [opts.method] - GET (default), POST, PATCH, DELETE
 * @param {object|string} [opts.body] - JSON payload via stdin
 * @param {object} [opts.fields] - Key-value fields sebagai `--field` flags
 * @param {boolean} [opts.raw] - Return raw string instead of JSON
 * @param {boolean} [opts.silent] - Suppress errors
 * @returns {any} Parsed JSON, raw string, atau null
 */
function ghApi(endpoint, opts = {}) {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('ghApi: endpoint wajib diisi (e.g. /repos/{owner}/{repo}/issues)');
  }
  const method = (opts.method || 'GET').toUpperCase();
  if (!SUPPORTED_METHODS.includes(method)) {
    throw new Error(`ghApi: method "${opts.method}" tidak didukung. Gunakan GET, POST, PATCH, atau DELETE.`);
  }

  const args = ['api', endpoint];
  if (method !== 'GET') args.push('-X', method);

  const execOpts = {};
  if (opts.body != null) {
    args.push('--input', '-');
    execOpts.input = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
  } else if (opts.fields) {
    for (const [key, value] of Object.entries(opts.fields)) {
      args.push('--field', `${key}=${value}`);
    }
  }

  const out = ghSpawn(args, { ...execOpts, silent: opts.silent, timeout: opts.timeout });
  if (opts.raw) return out;
  if (out == null) return null;
  try {
    const trimmed = out.trim();
    return trimmed ? JSON.parse(trimmed) : null;
  } catch (err) {
    throw new Error(`gh api error: gagal parse output: ${err.message}`);
  }
}

/**
 * Get the current repository (owner/name) from the working directory.
 * Falls back to prompting the user.
 */
function getCurrentRepo() {
  const out = ghRaw(['repo', 'view', '--json', 'nameWithOwner'], { silent: true });
  if (out) {
    try {
      const parsed = JSON.parse(out);
      if (parsed?.nameWithOwner) return parsed.nameWithOwner;
    } catch (_) {}
  }
  return null;
}

async function selectRepo(message = 'Pilih repository:') {
  const s = p.spinner();
  s.start('Fetching repos...');
  try {
    const repos = ghExec(['repo', 'list', '--limit', '50', '--json', 'nameWithOwner']);
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

module.exports = { ghExec, ghRaw, getCurrentRepo, selectRepo, ghApi };
