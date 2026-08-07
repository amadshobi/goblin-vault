import fs from 'fs';
import path from 'path';
import os from 'os';
import { getModelsConfig, type GBModelsConfig } from '../../config/models';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'gb');
const MODELS_PATH = path.join(CONFIG_DIR, 'models.json');

export interface GBConfigRecord extends Record<string, unknown> {
  default?: string;
  high?: string;
  medium?: string;
  low?: string;
  variant?: string;
}

/**
 * Memuat konfigurasi dari ~/.config/gb/models.json
 */
export function loadConfig(): GBConfigRecord {
  const modelsCfg = getModelsConfig();
  return {
    default: modelsCfg.models.default.id,
    variant: modelsCfg.models.default.variant || 'medium',
    high: modelsCfg.models.high,
    medium: modelsCfg.models.medium,
    low: modelsCfg.models.low,
  };
}

export function getConfig(): GBConfigRecord {
  return loadConfig();
}

/**
 * Menyimpan pembaruan kunci-nilai ke ~/.config/gb/models.json secara atomic
 */
export function setConfig(key: string, value: unknown): GBConfigRecord {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const currentModelsCfg = getModelsConfig();
    const updatedModels = { ...currentModelsCfg.models };

    if (key === 'default') {
      updatedModels.default = {
        ...updatedModels.default,
        id: String(value),
      };
    } else if (key === 'variant') {
      updatedModels.default = {
        ...updatedModels.default,
        variant: String(value),
      };
    } else if (key === 'high' || key === 'medium' || key === 'low') {
      updatedModels[key] = String(value);
    }

    const newConfigObj = {
      models: updatedModels,
    };

    const tmpPath = `${MODELS_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(newConfigObj, null, 2), 'utf8');
    fs.renameSync(tmpPath, MODELS_PATH);
  } catch (err) {
    console.error(`[gb-config] Gagal menyimpan config ke models.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  return loadConfig();
}
