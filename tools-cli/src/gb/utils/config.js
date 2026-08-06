/**
 * gb config — persistent user config dalam JSON.
 *
 * Config file: ~/.config/goblin-vault/gb-config.json
 * (lokasi bisa di-override via env XDG_CONFIG_HOME).
 *
 * Shape config:
 * {
 *   "model": "gpt-4o-mini",
 *   ...key lain yang dipakai fitur lain
 * }
 *
 * Semua penulisan memakai strategi ATOMIK (tmp file + renameSync) agar file
 * tidak korup kalau proses crash / diinterupsi di tengah penulisan.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

/** Mapping default model per backend & variant (dari models.json). */
const MODELS_JSON = require('./models.json');

/** Config folder: $XDG_CONFIG_HOME/goblin-vault atau ~/.config/goblin-vault */
function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'goblin-vault');
}

function configFilePath() {
  return path.join(configDir(), 'gb-config.json');
}

/**
 * Load config dari disk. Return {} kalau file belum pernah dibuat.
 * @returns {object} Config object.
 * @throws {Error} Kalau file ada tapi tidak bisa dibaca/di-parsed (corrupt).
 */
function loadConfig() {
  const file = configFilePath();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`gb: gagal membaca config ${file}: ${err.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('root config bukan object');
  } catch (err) {
    throw new Error(`gb: config corrupt di ${file}: ${err.message}`);
  }
}

/**
 * Persist config ke disk. Membuat folder otomatis jika belum ada, dan menulis
 * secara atomik (tmp file + rename) agar tidak korup saat crash.
 * @param {object} config - Config object lengkap yang mau disimpan.
 * @returns {object} Config yang baru saja disimpan (immutable — bukan referensi input).
 * @throws {Error} Kalau config bukan plain object.
 */
function saveConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('gb: saveConfig membutuhkan plain object config.');
  }
  const file = configFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { ...config };
}

/**
 * Ambil satu key dari config.
 * @param {string} key - Nama key top-level.
 * @returns {*} Value config, atau undefined kalau key belum ada.
 * @throws {Error} Kalau key bukan string non-empty.
 */
function getConfig(key) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('gb: getConfig membutuhkan key (string non-empty).');
  }
  return loadConfig()[key];
}

/**
 * Set satu key di config dan simpan ke disk. Tidak pernah memutasi object
 * config yang sudah ada — selalu bikin object baru (immutability).
 * @param {string} key - Nama key top-level.
 * @param {*} value - Value yang mau disimpan.
 * @returns {object} Config baru setelah update.
 * @throws {Error} Kalau key tidak valid, atau config existing corrupt.
 */
function setConfig(key, value) {
  if (typeof key !== 'string' || !key.trim()) {
    throw new Error('gb: setConfig membutuhkan key (string non-empty).');
  }
  const current = loadConfig();
  const next = { ...current, [key]: value };
  return saveConfig(next);
}

/**
 * Resolve model LLM dengan hierarki prioritas:
 *   1. CLI flag `--model` (via cliFlag)
 *   2. Config file key `model`
 *   3. Env `GB_MODEL` atau `OPENAI_MODEL`
 *   4. null → biarkan provider memakai default-nya sendiri.
 *
 * @param {string} [cliFlag] - Nilai dari CLI flag `--model` (boleh undefined).
 * @returns {string|null} Model terpilih, atau null kalau semuanya kosong.
 */
function resolveModel(cliFlag) {
  if (typeof cliFlag === 'string' && cliFlag.trim()) return cliFlag.trim();

  const fromConfig = loadConfig().model;
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();

  const envModel = process.env.GB_MODEL || process.env.OPENAI_MODEL;
  if (typeof envModel === 'string' && envModel.trim()) return envModel.trim();

  return null;
}

const DEFAULT_VARIANTS = {
  high: 'claude-3-5-sonnet',
  medium: 'goblin-nexus/gemini-3.5-flash',
  low: 'gemini-2.5-flash',
};

/**
 * Resolve variant name ('high', 'medium', 'low') atau model name ke object { model, variant }.
 * Jika input variant/model kosong: mengambil active variant dari config (`config.variant`)
 * atau fallback ke 'high'.
 * Jika variant diset kustom di config (`variants.high`, `variants.medium`, `variants.low`
 * atau `variants[v]`), menggunakan custom model tersebut.
 *
 * @param {string|null} [variantOrModelName] - Variant name ('high'|'medium'|'low') atau nama model langsung.
 * @param {object} [cliOptions] - Options tambahan (future-proofing).
 * @returns {{ model: string, variant: string|null }}
 */
function resolveVariantModel(variantOrModelName, cliOptions = {}) {
  const cfg = loadConfig();
  let target = (typeof variantOrModelName === 'string' && variantOrModelName.trim())
    ? variantOrModelName.trim()
    : (typeof cfg.variant === 'string' && cfg.variant.trim())
      ? cfg.variant.trim()
      : 'high';

  const vKey = target.toLowerCase();

  if (Object.prototype.hasOwnProperty.call(DEFAULT_VARIANTS, vKey)) {
    const customFromObj = cfg.variants && typeof cfg.variants === 'object' ? cfg.variants[vKey] : undefined;
    const customFromDot = cfg[`variants.${vKey}`];
    const customModel = (typeof customFromObj === 'string' && customFromObj.trim())
      ? customFromObj.trim()
      : (typeof customFromDot === 'string' && customFromDot.trim())
        ? customFromDot.trim()
        : null;

    const resolvedModel = customModel || DEFAULT_VARIANTS[vKey];
    return { model: resolvedModel, variant: vKey };
  }

  return { model: target, variant: null };
}

/** Daftar variant name yang dikenali system. */
const VALID_VARIANTS = ['high', 'medium', 'low', 'auto', 'none'];

/** Mapping nilai `thinking` per variant. */
const THINKING_MAP = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  auto: 'auto',
  none: 'off',
};

/**
 * Resolve model untuk backend tertentu ('opencode' | 'omp') berbasis variant.
 *
 * Hierarki penentuan target variant:
 *   1. Argumen `variantOrModelName` (kalau string non-empty).
 *   2. `config.variant` dari disk.
 *   3. Default `'high'`.
 *
 * Hierarki resolusi model:
 *   1. Jika `variantOrModelName` diset tapi BUKAN salah satu dari 5 variant
 *      name ('high'|'medium'|'low'|'auto'|'none'), ia dianggap explicit model
 *      override name dan langsung dipakai tanpa lookup.
 *   2. Jika valid variant: custom override dari config user diprioritaskan:
 *        - `config.variants[backend][variant]`
 *        - `config.variants[variant]`
 *   3. Fallback ke default di `MODELS_JSON.backends[backend][variant]`.
 *
 * @param {string} [backendName='opencode'] - Nama backend: 'opencode' atau 'omp'.
 * @param {string|null} [variantOrModelName] - Variant name (5 opsi) atau nama model langsung.
 * @param {object} [cliOptions] - Options tambahan (future-proofing).
 * @returns {{ model: string, variant: string|null, backend: string, thinking: string }}
 */
function resolveBackendVariantModel(backendName = 'opencode', variantOrModelName = null, cliOptions = {}) {
  const backend = (backendName === 'omp' || backendName === 'opencode') ? backendName : 'opencode';
  const cfg = loadConfig();

  const rawArg = (typeof variantOrModelName === 'string' && variantOrModelName.trim())
    ? variantOrModelName.trim()
    : null;

  let target = rawArg;
  if (!target) {
    target = (typeof cfg.variant === 'string' && cfg.variant.trim())
      ? cfg.variant.trim()
      : 'high';
  }

  const cleanTarget = target.toLowerCase();
  const isValidVariant = VALID_VARIANTS.includes(cleanTarget);

  // Bukan variant → explicit model override name.
  if (!isValidVariant) {
    return { model: target, variant: null, backend, thinking: 'off' };
  }

  const variantsCfg = cfg.variants && typeof cfg.variants === 'object' ? cfg.variants : {};
  const backendOverride =
    variantsCfg[backend] && typeof variantsCfg[backend] === 'object'
      ? variantsCfg[backend][cleanTarget]
      : undefined;
  const flatOverride = variantsCfg[cleanTarget];

  const customModel = (typeof backendOverride === 'string' && backendOverride.trim())
    ? backendOverride.trim()
    : (typeof flatOverride === 'string' && flatOverride.trim())
      ? flatOverride.trim()
      : null;

  const model = customModel || MODELS_JSON.backends[backend][cleanTarget] || null;

  return { model, variant: cleanTarget, backend, thinking: THINKING_MAP[cleanTarget] };
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  setConfig,
  resolveModel,
  DEFAULT_VARIANTS,
  resolveVariantModel,
  resolveBackendVariantModel,
  VALID_VARIANTS,
  THINKING_MAP,
};
