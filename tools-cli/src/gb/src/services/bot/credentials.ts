import fs from 'fs';
import path from 'path';
import os from 'os';
import { getBotSettings, resolveFileRef } from '../../config/settings';

export interface GBBotCredentials {
  readonly appId: string;
  readonly installationId: string;
  readonly privateKey: string;
  readonly source: 'env' | 'settings' | 'file-ref';
}

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * Normalizes private key string or loads from referenced path.
 * Handles escaped newlines ("\n" string literals), PEM headers, and file paths.
 */
export function resolvePrivateKey(rawOrPath: string): string {
  const trimmed = rawOrPath.trim();
  if (!trimmed) {
    throw new Error('Private key GitHub App kosong.');
  }

  // If directly contains PEM header
  if (trimmed.includes('-----BEGIN')) {
    // Unescape literal \n if passed via single-line env var
    return trimmed.replace(/\\n/g, '\n');
  }

  // Treat as file path
  const targetPath = expandHome(trimmed);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File private key tidak ditemukan: ${targetPath}`);
  }

  const content = fs.readFileSync(targetPath, 'utf8').trim();
  if (!content.includes('-----BEGIN')) {
    throw new Error(`File ${targetPath} bukan file private key PEM yang valid.`);
  }

  return content.replace(/\\n/g, '\n');
}

/**
 * Load bot credentials following hierarchy:
 * 1. Env vars (GB_BOT_APP_ID, GB_BOT_INSTALLATION_ID, GB_BOT_PRIVATE_KEY)
 * 2. Settings file ~/.config/gb/settings.json (with {file:...} expansion)
 */
export function loadBotCredentials(): GBBotCredentials {
  const envAppId = process.env.GB_BOT_APP_ID?.trim();
  const envInstId = process.env.GB_BOT_INSTALLATION_ID?.trim();
  const envKey = process.env.GB_BOT_PRIVATE_KEY?.trim();

  if (envAppId && envInstId && envKey) {
    return {
      appId: envAppId,
      installationId: envInstId,
      privateKey: resolvePrivateKey(envKey),
      source: 'env',
    };
  }

  const rawBotSettings = getBotSettings();
  
  // Check if bot section itself is a {file:...} ref or has file key
  let resolvedBot = rawBotSettings;
  if (typeof rawBotSettings.file === 'string') {
    const fromFile = resolveFileRef(`{file:${rawBotSettings.file}}`);
    if (typeof fromFile === 'object' && fromFile !== null) {
      resolvedBot = { ...(fromFile as Record<string, unknown>), ...rawBotSettings };
    }
  }

  // Resolve potential {file:...} inside individual fields
  const appIdRaw = resolveFileRef(resolvedBot.app_id);
  const instIdRaw = resolveFileRef(resolvedBot.installation_id);
  const keyRaw = resolveFileRef(resolvedBot.private_key || resolvedBot.private_key_path);

  const appId = typeof appIdRaw === 'string' ? appIdRaw.trim() : (typeof appIdRaw === 'number' ? String(appIdRaw) : undefined);
  const installationId = typeof instIdRaw === 'string' ? instIdRaw.trim() : (typeof instIdRaw === 'number' ? String(instIdRaw) : undefined);
  const privateKeyRaw = typeof keyRaw === 'string' ? keyRaw.trim() : undefined;

  const finalAppId = envAppId || appId;
  const finalInstId = envInstId || installationId;
  const finalKeyRaw = envKey || privateKeyRaw;

  if (!finalAppId || !finalInstId || !finalKeyRaw) {
    const missing: string[] = [];
    if (!finalAppId) missing.push('App ID (GB_BOT_APP_ID atau bot.app_id)');
    if (!finalInstId) missing.push('Installation ID (GB_BOT_INSTALLATION_ID atau bot.installation_id)');
    if (!finalKeyRaw) missing.push('Private Key (GB_BOT_PRIVATE_KEY atau bot.private_key/private_key_path)');

    throw new Error(
      `Kredensial GitHub App Bot belum lengkap.\n` +
      `Kekurangan: ${missing.join(', ')}\n` +
      `Gunakan 'gb bot config' untuk setup interaktif, atau atur via env var / ~/.config/gb/settings.json.`
    );
  }

  return {
    appId: finalAppId,
    installationId: finalInstId,
    privateKey: resolvePrivateKey(finalKeyRaw),
    source: (envAppId || envInstId || envKey) ? 'env' : 'settings',
  };
}

/**
 * Check if bot credentials are available without throwing error.
 */
export function hasBotCredentials(): boolean {
  try {
    loadBotCredentials();
    return true;
  } catch {
    return false;
  }
}
