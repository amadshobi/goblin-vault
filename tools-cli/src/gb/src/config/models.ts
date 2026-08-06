import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ModelPreset {
  id: string;
  variant?: string; // e.g. "low" | "medium" | "high" | "off"
}

export interface GBModelsConfig {
  models: {
    default: ModelPreset;
    high: string;
    medium: string;
    low: string;
  };
}

const DEFAULT_MODELS_CONFIG: GBModelsConfig = {
  models: {
    default: {
      id: 'gemini-3.6-flash',
      variant: 'medium'
    },
    high: 'claude-3-7-sonnet',
    medium: 'gemini-3.6-flash',
    low: 'gemini-2.5-flash'
  }
};

/**
 * Memuat konfigurasi model dari ~/.config/gb/models.json (Hybrid: fallback ke default jika file tidak ditemukan)
 */
export function getModelsConfig(): GBModelsConfig {
  const configPath = path.join(os.homedir(), '.config', 'gb', 'models.json');

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        models: {
          ...DEFAULT_MODELS_CONFIG.models,
          ...(parsed.models || {})
        }
      };
    } catch {
      return DEFAULT_MODELS_CONFIG;
    }
  }

  return DEFAULT_MODELS_CONFIG;
}

export interface ModelResolutionFlags {
  high?: boolean;
  medium?: boolean;
  low?: boolean;
}

/**
 * Menyelesaikan model ID dan variant (thinking level) berdasarkan CLI flags (--high, --medium, --low)
 */
export function resolveModel(flags: ModelResolutionFlags = {}): ModelPreset {
  const config = getModelsConfig();

  if (flags.high) {
    return {
      id: config.models.high || 'claude-3-7-sonnet',
      variant: 'high'
    };
  }

  if (flags.medium) {
    return {
      id: config.models.medium || 'gemini-3.6-flash',
      variant: 'medium'
    };
  }

  if (flags.low) {
    return {
      id: config.models.low || 'gemini-2.5-flash',
      variant: 'low'
    };
  }

  // Fallback to default
  return config.models.default;
}
