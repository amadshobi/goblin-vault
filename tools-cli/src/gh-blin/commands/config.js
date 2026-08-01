/**
 * gh-blin config command — kelola persistent config (utils/config.js).
 *
 * Subcommand CLI:
 *   gh-blin config set <key> <value>   — simpan key/value
 *   gh-blin config get [key]           — tampilkan value key, atau seluruh config
 *   gh-blin config list                — tampilkan seluruh config sebagai daftar
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
const { loadConfig, setConfig } = require('../utils/config');
const { clearLastLines } = require('../utils/display');
const { continuePrompt } = require('../utils/prompt');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Format satu value config untuk ditampilkan (string polos, lain JSON). */
function formatConfigValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Simpan satu key config.
 * @param {string} key
 * @param {*} value
 * @returns {{ ok: true, key: string, value: * } | { ok: false, error: string }}
 */
function configSet(key, value) {
  if (typeof key !== 'string' || !key.trim()) {
    return { ok: false, error: 'gh-blin: key config harus string non-empty.' };
  }
  if (value === undefined) {
    return { ok: false, error: 'gh-blin: value config wajib diisi.' };
  }
  try {
    setConfig(key, value);
    return { ok: true, key, value };
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
      return { ok: false, error: 'gh-blin: key config harus string.' };
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

/**
 * Menu interaktif Config untuk dipanggil dari TUI.
 */
async function configMenu() {
  while (true) {
    const action = await p.select({
      message: 'Config',
      options: [
        { value: 'view', label: 'Lihat Semua Config', hint: 'list' },
        { value: 'get', label: 'Lihat Key Tertentu', hint: 'get <key>' },
        { value: 'set', label: 'Set Key', hint: 'set <key> <value>' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    switch (action) {
      case 'view': await showAllConfig(); break;
      case 'get': await getKeyInteractive(); break;
      case 'set': await setKeyInteractive(); break;
    }
    await continuePrompt();
  }
}

module.exports = { configSet, configGet, configList, configMenu, formatConfigValue };
