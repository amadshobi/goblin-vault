/**
 * gb config command — kelola persistent config (utils/config.js).
 *
 * Subcommand CLI:
 *   gb config set <key> <value>   — simpan key/value
 *   gb config get [key]           — tampilkan value key, atau seluruh config
 *   gb config list                — tampilkan seluruh config sebagai daftar
 *
 * Public API:
 *   configSet(key, value)  — simpan satu key
 *   configGet(key?)        — ambil value key; tanpa key → seluruh config
 *   configList()           — ambil seluruh config
 *   configMenu()           — interactive TUI menu
 *
 * Semua handler return { ok, ... } (tidak throw) supaya CLI & menu bisa
 * menampilkan error tanpa crash.
 */
const p = require('@clack/prompts');
const color = require('picocolors');
const { loadConfig, setConfig, getConfig } = require('../utils/config');
const { clearLastLines } = require('../utils/display');
const { continuePrompt } = require('../utils/prompt');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Format satu value config untuk ditampilkan (string polos, lain JSON). */
function formatConfigValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Simpan satu key config. Mendukung validasi khusus key `variant` (high|medium|low)
 * dan `variants.<high|medium|low>` untuk custom model variant.
 * @param {string} key
 * @param {*} value
 * @returns {{ ok: true, key: string, value: * } | { ok: false, error: string }}
 */
function configSet(key, value) {
  if (typeof key !== 'string' || !key.trim()) {
    return { ok: false, error: 'gb: key config harus string non-empty.' };
  }
  if (value === undefined) {
    return { ok: false, error: 'gb: value config wajib diisi.' };
  }

  const k = key.trim();
  const kLower = k.toLowerCase();

  if (kLower === 'variant') {
    const valStr = String(value).trim().toLowerCase();
    if (!['high', 'medium', 'low'].includes(valStr)) {
      return { ok: false, error: 'gb: variant tidak valid. Gunakan high, medium, atau low.' };
    }
    value = valStr;
  } else if (kLower.startsWith('variants.')) {
    const vKey = kLower.slice(9);
    if (!['high', 'medium', 'low'].includes(vKey)) {
      return { ok: false, error: 'gb: variant key tidak valid. Gunakan variants.high, variants.medium, atau variants.low.' };
    }
  }

  try {
    setConfig(k, value);
    return { ok: true, key: k, value };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Ambil value satu key; tanpa key → seluruh config.
 * @param {string} [key]
 * @returns {{ ok: true, config: object } | { ok: true, found: boolean, value?: * } | { ok: false, error: string }}
 */
function configGet(key) {
  try {
    if (key == null || key === '') {
      return { ok: true, config: loadConfig() };
    }
    if (typeof key !== 'string') {
      return { ok: false, error: 'gb: key config harus string.' };
    }
    const cfg = loadConfig();
    return { ok: true, found: hasOwn(cfg, key), value: cfg[key] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Ambil seluruh config (untuk list).
 * @returns {{ ok: true, config: object } | { ok: false, error: string }}
 */
function configList() {
  try {
    return { ok: true, config: loadConfig() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Format seluruh config sebagai daftar manusiawi "key = value". */
function formatConfigLines(cfg) {
  return Object.entries(cfg)
    .map(([k, v]) => `${color.cyan(k)} = ${formatConfigValue(v)}`)
    .join('\n');
}

/** Tampilkan seluruh config (interaktif). */
async function showAllConfig() {
  const res = configList();
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  const keys = Object.keys(res.config);
  if (!keys.length) {
    p.note(color.dim('Config kosong. Belum ada key yang di-set.'), 'Config');
    return;
  }
  p.note(formatConfigLines(res.config), 'Config');
}

/** Lihat value key tertentu (interaktif). */
async function getKeyInteractive() {
  const key = await p.text({ message: 'Nama key:', placeholder: 'e.g. model' });
  if (p.isCancel(key)) { clearLastLines(2); return; }
  if (!key.trim()) {
    await showAllConfig();
    return;
  }
  const res = configGet(key.trim());
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  if (res.config) {
    p.note(formatConfigLines(res.config), 'Config');
    return;
  }
  if (!res.found) {
    p.note(color.yellow(`Config key "${key.trim()}" tidak di-set.`), 'Config');
    return;
  }
  p.note(color.green(formatConfigValue(res.value)), `config.${key.trim()}`);
}

/** Set key/value (interaktif). */
async function setKeyInteractive() {
  const key = await p.text({ message: 'Nama key:', placeholder: 'e.g. model' });
  if (p.isCancel(key)) { clearLastLines(2); return; }
  if (!key.trim()) {
    p.note(color.yellow('Key tidak boleh kosong.'), 'Config');
    return;
  }
  const value = await p.text({
    message: `Value untuk "${key.trim()}":`,
    placeholder: 'e.g. gemini-2.5-flash',
  });
  if (p.isCancel(value)) { clearLastLines(2); return; }
  const res = configSet(key.trim(), value);
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  p.note(color.green(`Config di-set: ${res.key} = ${res.value}`), 'Config');
}

/** Set active variant (high | medium | low) interaktif. */
async function setVariantInteractive() {
  const cfg = loadConfig();
  const currentVariant = cfg.variant || 'high';
  const vChoice = await p.select({
    message: `Set Active Model Variant (Current: ${color.cyan(currentVariant)}):`,
    options: [
      { value: 'high', label: 'High (Default Utama)', hint: 'claude-3-5-sonnet' },
      { value: 'medium', label: 'Medium', hint: 'goblin-nexus/gemini-3.5-flash' },
      { value: 'low', label: 'Low', hint: 'gemini-2.5-flash' },
    ],
  });
  if (p.isCancel(vChoice)) { clearLastLines(2); return; }
  const res = configSet('variant', vChoice);
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  p.note(color.green(`Active variant di-set ke: ${res.value}`), 'Config');
}

/** Set custom model per variant (variants.high | medium | low) interaktif. */
async function setCustomVariantInteractive() {
  const vKeyChoice = await p.select({
    message: 'Pilih Variant yang ingin di-set custom model-nya:',
    options: [
      { value: 'high', label: 'variants.high', hint: 'Custom model untuk variant high' },
      { value: 'medium', label: 'variants.medium', hint: 'Custom model untuk variant medium' },
      { value: 'low', label: 'variants.low', hint: 'Custom model untuk variant low' },
    ],
  });
  if (p.isCancel(vKeyChoice)) { clearLastLines(2); return; }

  const key = `variants.${vKeyChoice}`;
  let currentVal = '';
  try { currentVal = getConfig(key) || ''; } catch (_) {}

  const modelName = await p.text({
    message: `Nama custom model untuk ${color.cyan(key)}:`,
    placeholder: 'e.g. claude-3-7-sonnet',
    initialValue: typeof currentVal === 'string' ? currentVal : '',
  });
  if (p.isCancel(modelName)) { clearLastLines(2); return; }
  if (!modelName.trim()) {
    p.note(color.yellow('Nama model tidak boleh kosong.'), 'Config');
    return;
  }
  const res = configSet(key, modelName.trim());
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  p.note(color.green(`Config di-set: ${res.key} = ${res.value}`), 'Config');
}

/**
 * Menu interaktif Config untuk dipanggil dari TUI.
 */
async function configMenu() {
  while (true) {
    const action = await p.select({
      message: 'Config',
      options: [
        { value: 'view', label: 'Lihat Semua Config', hint: 'list' },
        { value: 'variant', label: 'Set Active Variant', hint: 'high | medium | low' },
        { value: 'customVariant', label: 'Set Custom Model Variant', hint: 'variants.<high|medium|low>' },
        { value: 'get', label: 'Lihat Key Tertentu', hint: 'get <key>' },
        { value: 'set', label: 'Set Key Sembarang', hint: 'set <key> <value>' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    switch (action) {
      case 'view': await showAllConfig(); break;
      case 'variant': await setVariantInteractive(); break;
      case 'customVariant': await setCustomVariantInteractive(); break;
      case 'get': await getKeyInteractive(); break;
      case 'set': await setKeyInteractive(); break;
    }
    await continuePrompt();
  }
}

module.exports = { configSet, configGet, configList, configMenu, formatConfigValue };
