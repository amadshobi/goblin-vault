/**
 * gh-blin config — persistent user config dalam JSON.
 *
 * Config file: ~/.config/goblin-vault/gh-blin-config.json
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

/** Config folder: $XDG_CONFIG_HOME/goblin-vault atau ~/.config/goblin-vault */
function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'goblin-vault');
}

function configFilePath() {
  return path.join(configDir(), 'gh-blin-config.json');
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
    throw new Error(`gh-blin: gagal membaca config ${file}: ${err.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('root config bukan object');
  } catch (err) {
    throw new Error(`gh-blin: config corrupt di ${file}: ${err.message}`);
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
    throw new Error('gh-blin: saveConfig membutuhkan plain object config.');
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
    throw new Error('gh-blin: getConfig membutuhkan key (string non-empty).');
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
    throw new Error('gh-blin: setConfig membutuhkan key (string non-empty).');
  }
  const current = loadConfig();
  const next = { ...current, [key]: value };
  return saveConfig(next);
}

/**
 * Resolve model LLM dengan hierarki prioritas:
 *   1. CLI flag `--model` (via cliFlag)
 *   2. Config file key `model`
 *   3. Env `GH_BLIN_MODEL` atau `OPENAI_MODEL`
 *   4. null → biarkan provider memakai default-nya sendiri.
 *
 * @param {string} [cliFlag] - Nilai dari CLI flag `--model` (boleh undefined).
 * @returns {string|null} Model terpilih, atau null kalau semuanya kosong.
 */
function resolveModel(cliFlag) {
  if (typeof cliFlag === 'string' && cliFlag.trim()) return cliFlag.trim();

  const fromConfig = loadConfig().model;
  if (typeof fromConfig === 'string' && fromConfig.trim()) return fromConfig.trim();

  const envModel = process.env.GH_BLIN_MODEL || process.env.OPENAI_MODEL;
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

module.exports = { loadConfig, saveConfig, getConfig, setConfig, resolveModel, DEFAULT_VARIANTS, resolveVariantModel };
