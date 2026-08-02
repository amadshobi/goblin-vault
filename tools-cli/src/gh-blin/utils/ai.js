/**
 * gh-blin AI helpers — LLM-backed PR review generation.
 *
 * callLLM fallback strategy:
 *   1. `opencode run` (CLI opencode)
 *   2. OPENAI_API_KEY via `curl --data-binary @-` (stdin pipe)
 *   3. Throw error + actionable hint
 *
 * Model dipilih via utils/config.js `resolveModel()` — hierarki:
 *   CLI flag `--model` > config file `model` > env `GH_BLIN_MODEL`/`OPENAI_MODEL`
 *   > null (provider default).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { resolveModel, resolveVariantModel, resolveBackendVariantModel } = require('./config');

/**
 * Build a review prompt for the LLM from PR data + diff.
 * @param {object} prData - { number, title, body, author, repo, ... }
 * @param {string} [diff] - The PR diff text.
 * @returns {string} Formatted prompt text.
 */
function buildReviewPrompt(prData, diff) {
  const repo = prData.repo || '';
  const number = prData.number != null ? `#${prData.number}` : '';
  const title = prData.title || '(no title)';
  const body = prData.body || '(no description)';
  const author = prData.author?.login || 'unknown';

  return [
    'You are a senior code reviewer. Review the GitHub PR below and produce a concise,',
    'actionable review in Bahasa Indonesia. Focus on correctness, security, performance,',
    'and maintainability. Be direct and practical — no fluff.',
    '',
    `PR ${number} — ${title}`,
    `Repo: ${repo} | Author: ${author}`,
    '',
    'DESCRIPTION:',
    body,
    '',
    'DIFF:',
    '```diff',
    diff || '(no diff provided)',
    '```',
    '',
    'OUTPUT FORMAT:',
    '- Ringkasan singkat (1-2 kalimat).',
    '- Daftar masalah/risiko dengan severity (🔴 blocker / 🟠 warning / 🟢 nitpick).',
    '- Saran perbaikan yang spesifik dan actionable.',
  ].join('\n');
}

/**
 * Estimasi jumlah token teks: ~4 karakter per token (approksimasi kasar,
 * cukup untuk logging biaya / pemantauan — bukan hitungan token presisi).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 4);
}

/**
 * Call an LLM with the given prompt and return the model's text response.
 * Falls back through strategies until one succeeds.
 * @param {string} prompt
 * @param {object} [options]
 * @param {string|null} [options.model] - Model override dari resolveModel().
 * @returns {{ text: string, backend: string, model: string|null }}
 * @throws {Error} If no LLM backend is available.
 */
function callLLM(prompt, options = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('callLLM: prompt wajib berupa string non-empty.');
  }

  let lastError = null;

  // Strategy 0: `omp` (prompt optimizer) — dipakai sebagai backend utama kalau
  // diminta via `useOmp: true` atau `backend === 'omp'`.
  const wantsOmp = options.useOmp === true || options.backend === 'omp';
  if (wantsOmp && hasCmd('omp')) {
    try {
      const r = callOmp(prompt, options);
      if (r) return r;
    } catch (err) {
      lastError = err.message;
    }
  }

  // Strategy 1: opencode CLI (spawnSync -> array argv, bebas masalah shell quoting).
  // Model memakai konfigurasi opencode sendiri; field `model` tetap di-return
  // sebagai nilai resolveModel agar user tahu model yang terpilih.
  if (hasCmd('opencode')) {
    try {
      const r = spawnSync('opencode', ['run'], {
        input: prompt,
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300000,
      });
      if (r.status === 0 && r.stdout && r.stdout.trim()) {
        const { model: fallbackModel } = resolveVariantModel('opencode', options.variant);
        return { text: r.stdout.trim(), backend: 'opencode', model: fallbackModel || options.model || null };
      }
      const exitReason = r.error ? r.error.message : (r.status === null ? 'timeout (>5m)' : `exit ${r.status}`);
      lastError = r.stderr?.trim()?.split('\n')[0] || `opencode ${exitReason}`;
    } catch (err) {
      lastError = err.message;
    }
  }

  // Strategy 2: OPENAI_API_KEY via curl (payload stdin pipe, tidak di-embed di argv)
  if (process.env.OPENAI_API_KEY) {
    try {
      const review = callOpenAIViaCurl(prompt, options.model);
      if (review) return { text: review, backend: 'openai', model: options.model || null };
    } catch (err) {
      lastError = err.message;
    }
  }

  // Strategy 3: clear error + actionable hint
  const hint =
    'Pasang CLI `opencode` (https://opencode.ai/docs/cli) ATAU export env OPENAI_API_KEY ' +
    '(opsional: OPENAI_MODEL, OPENAI_BASE_URL) lalu coba lagi.';
  const detail = lastError ? ` (detail: ${lastError})` : '';
  throw new Error(`gh-blin: tidak ada LLM backend yang berhasil. ${hint}${detail}`);
}

/**
 * OpenAI-compatible chat completion via curl. Payload dikirim via stdin
 * (`--data-binary @-`) supaya JSON dengan karakter khusus aman.
 * @param {string} prompt
 * @param {string|null} [modelOverride] - Model hasil resolveModel(); menang atas env.
 * @returns {string} Review text dari model.
 */
function callOpenAIViaCurl(prompt, modelOverride) {
  const key = process.env.OPENAI_API_KEY;
  const model = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });

  const r = spawnSync(
    'curl',
    [
      '-sS', '-X', 'POST', url,
      '-H', `Authorization: Bearer ${key}`,
      '-H', 'Content-Type: application/json',
      '--data-binary', '@-',
    ],
    { input: body, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 60000 }
  );

  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`curl exit ${r.status}: ${r.stderr?.trim() || 'unknown error'}`);
  }

  // JSON parse safety: response bisa berupa HTML error (502/cloudflare) atau
  // JSON malformed — jangan biarkan SyntaxError mentah meluap ke user.
  const raw = r.stdout || '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const preview = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(
      `OpenAI API mengembalikan response non-JSON (mungkin error 502/cloudflare). Preview: ${preview || '(stdout kosong)'}`
    );
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) {
    const apiErr = parsed.error?.message || 'unknown';
    throw new Error(`OpenAI API tidak mengembalikan konten: ${String(apiErr).slice(0, 200)}`);
  }
  return content.trim();
}

/**
 * Runner untuk CLI `omp` (prompt optimizer) sebagai Strategy 0.
 *
 * Argumen dibangun sebagai array argv (spawnSync) untuk menghindari masalah
 * shell quoting. `maxBuffer` & `timeout` diset cukup besar untuk diff besar.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.model] - Model override (jika diset → `--model=...`).
 * @param {string} [options.thinking] - Nilai thinking (jika diset → `--thinking=...`).
 * @returns {{ text: string, backend: string, model: string|null }|null} Hasil, atau null kalau gagal.
 */
// Nilai `--thinking` yang didukung CLI `omp`. Hanya nilai valid yang dikirim.
const OMP_THINKING_VALUES = new Set(['high', 'medium', 'low', 'auto', 'off']);

function callOmp(prompt, options = {}) {
  const tmpFile = path.join(os.tmpdir(), `gh-blin-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    fs.writeFileSync(tmpFile, prompt, 'utf8');
    const args = ['-p', `@${tmpFile}`, '--no-session', '--hide-thinking'];
    if (options.model) args.push(`--model=${options.model}`);
    if (options.thinking && OMP_THINKING_VALUES.has(options.thinking)) {
      args.push(`--thinking=${options.thinking}`);
    }

    const r = spawnSync('omp', args, {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    });

    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return { text: r.stdout.trim(), backend: 'omp', model: options.model || null };
    }

    if (r.error) {
      throw new Error(`omp spawn error: ${r.error.message}`);
    }
    if (r.status !== 0) {
      const first = r.stderr?.trim()?.split('\n')[0] || r.stdout?.trim()?.split('\n')[0] || 'unknown error';
      throw new Error(`omp exit ${r.status}: ${first}`);
    }
    throw new Error('omp exit 0 tapi menghasilkan stdout kosong');
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

/**
 * Generate a review for a PR. Model & variant di-resolve via hierarki config
 * (utils/config.js `resolveVariantModel`). Menghitung estimasi token prompt,
 * completion, dan total untuk logging/pemantauan.
 * @param {object} prData
 * @param {string} [diff]
 * @param {object} [options]
 * @param {string} [options.model] - Nilai dari CLI flag `--model`.
 * @param {string} [options.variant] - Nilai dari CLI flag `--variant`, `--high`, `--medium`, atau `--low`.
 * @param {boolean} [options.useOmp] - True kalau user memilih backend omp.
 * @param {string} [options.backend] - Nama backend eksplisit ('opencode'|'omp').
 * @returns {{ review: string, prompt: string, model: string|null, variant: string|null, backend: string,
 *            thinking: string, tokens: { prompt: number, completion: number, total: number } }}
 */
function generateReview(prData, diff, options = {}) {
  const requestedBackend = options.useOmp === true ? 'omp' : (options.backend || 'opencode');
  // Explicit `--model` SELALU meng-override preset variant model. Baru jika
  // model tidak diset, fallback ke variant (`options.variant`), lalu config.
  const resolved = resolveBackendVariantModel(requestedBackend, options.model || options.variant, options);
  const { model, variant, backend, thinking } = resolved;

  const prompt = buildReviewPrompt(prData, diff);
  const { text, backend: usedBackend, model: usedModel } = callLLM(prompt, {
    useOmp: backend === 'omp',
    backend,
    model,
    thinking,
  });

  const review = stripAnsi(text);
  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(review);
  return {
    review,
    prompt,
    model: usedModel || model,
    variant,
    backend: usedBackend,
    thinking,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
  };
}

/**
 * Cache in-memory per-process lifetime: hasil pengecekan kehadiran command
 * di-cache supaya spawnSync ['--version'] hanya jalan 1x per command per CLI.
 * Menghemat puluhan subprocess di batch mode (batch review / auto).
 */
const cmdCache = {};

/**
 * Cek apakah command tersedia di PATH. Hasil di-cache per-process.
 * @param {string} cmd - Nama command.
 * @returns {boolean} true kalau tersedia.
 */
function hasCmd(cmd) {
  if (Object.prototype.hasOwnProperty.call(cmdCache, cmd)) {
    return cmdCache[cmd];
  }
  let ok = false;
  try {
    ok = spawnSync(cmd, ['--version'], { stdio: 'ignore' }).status === 0;
  } catch (_) {
    ok = false;
  }
  cmdCache[cmd] = ok;
  return ok;
}

function stripAnsi(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, '');
}

module.exports = { buildReviewPrompt, estimateTokens, callOmp, callLLM, generateReview };
