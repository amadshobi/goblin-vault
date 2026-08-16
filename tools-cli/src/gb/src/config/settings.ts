import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gb');
const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');

export interface BotSettings {
  app_id?: string;
  installation_id?: string;
  private_key?: string;
  private_key_path?: string;
  file?: string;
  [key: string]: unknown;
}

export interface GBSettings extends Record<string, unknown> {
  bot?: BotSettings;
}

/**
 * Expand tilde (~) prefix in file path to user's home directory.
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Resolves {file:/path/to/file} or {file:~/path/to/file} reference strings.
 * If value matches `{file:...}`, reads the target file and attempts JSON parse.
 * If not JSON, returns trimmed raw content. Otherwise returns value unchanged.
 */
export function resolveFileRef(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = value.match(/^\{file:(.+)\}$/);
  if (!match) return value;

  const targetPath = expandHome(match[1].trim());
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Referenced file tidak ditemukan: ${targetPath}`);
  }

  const raw = fs.readFileSync(targetPath, 'utf8').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Load raw settings from ~/.config/gb/settings.json.
 * Returns empty object if file does not exist.
 */
export function loadSettings(): GBSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {};
    }
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Atomically save settings to ~/.config/gb/settings.json with 0600 permissions.
 */
export function saveSettings(settings: GBSettings): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const tmpPath = `${SETTINGS_PATH}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.chmodSync(tmpPath, 0o600);
  fs.renameSync(tmpPath, SETTINGS_PATH);
}

/**
 * Retrieve bot settings section from settings.json.
 */
export function getBotSettings(): BotSettings {
  const settings = loadSettings();
  if (settings.bot && typeof settings.bot === 'object') {
    return { ...settings.bot };
  }
  return {};
}

/**
 * Immutable update to bot settings in ~/.config/gb/settings.json.
 */
export function setBotSettings(partial: Partial<BotSettings>): GBSettings {
  const current = loadSettings();
  const currentBot = current.bot && typeof current.bot === 'object' ? current.bot : {};
  
  const mergedBot: BotSettings = { ...currentBot, ...partial };

  // Strip keys explicitly set to undefined or null to support key cleanup
  for (const key of Object.keys(mergedBot)) {
    if (mergedBot[key] === undefined || mergedBot[key] === null) {
      delete mergedBot[key];
    }
  }

  const updatedSettings: GBSettings = {
    ...current,
    bot: mergedBot,
  };

  saveSettings(updatedSettings);
  return updatedSettings;
}
