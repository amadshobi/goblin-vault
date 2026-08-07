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

/**
 * Default fallback minimal tanpa hardcoded vendor model name.
 * 100% dikendalikan dari user config ~/.config/gb/models.json atau OMP CLI default.
 */
const DEFAULT_MODELS_CONFIG: GBModelsConfig = {
  models: {
    default: {
      id: 'default',
      variant: 'medium'
    },
    high: 'high',
    medium: 'medium',
    low: 'low'
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
  model?: string | null;
  variant?: string | null;
  high?: boolean;
  medium?: boolean;
  low?: boolean;
}

/**
 * Menyelesaikan model ID dan variant (thinking level) berdasarkan CLI flags (--high, --medium, --low, --variant, --model)
 * Tanpa hardcoded vendor model — murni mengikuti user config (~/.config/gb/models.json) atau OMP default.
 */
export function resolveModel(flags: ModelResolutionFlags = {}): ModelPreset {
  const config = getModelsConfig();

  const isHigh = Boolean(flags.high || flags.variant === 'high');
  const isMedium = Boolean(flags.medium || flags.variant === 'medium');
  const isLow = Boolean(flags.low || flags.variant === 'low');

  // Prioritas 1: Explicit --model flag override selalu menang
  if (flags.model && flags.model.trim()) {
    const selectedVariant = isHigh ? 'high' : isLow ? 'low' : isMedium ? 'medium' : flags.variant || config.models.default.variant || 'medium';
    return {
      id: flags.model.trim(),
      variant: selectedVariant
    };
  }

  // Prioritas 2: Preset flags (--high, --medium, --low) atau --variant <name>
  if (isHigh) {
    return {
      id: config.models.high || 'high',
      variant: 'high'
    };
  }

  if (isMedium) {
    return {
      id: config.models.medium || 'medium',
      variant: 'medium'
    };
  }

  if (isLow) {
    return {
      id: config.models.low || 'low',
      variant: 'low'
    };
  }

  // Prioritas 3: Fallback ke default config user / minimal default
  return config.models.default;
}
