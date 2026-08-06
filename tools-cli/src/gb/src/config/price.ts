import fs from 'fs';
import path from 'path';
import os from 'os';

export interface TokenPrice {
  input: number;  // Price per 1,000,000 input tokens in USD
  output: number; // Price per 1,000,000 output tokens in USD
}

export interface PriceConfig {
  prices: Record<string, TokenPrice>;
}

/**
 * Memuat konfigurasi harga token dari ~/.config/gb/price.json
 * Jika tidak ditemukan atau model tidak terdaftar, fallback rate adalah 0 USD.
 */
export function getPriceConfig(): PriceConfig {
  const configPath = path.join(os.homedir(), '.config', 'gb', 'price.json');

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        prices: parsed.prices || {}
      };
    } catch {
      return { prices: {} };
    }
  }

  return { prices: {} };
}

/**
 * Menghitung estimasi biaya dalam USD berdasarkan model, token input, dan token output.
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const config = getPriceConfig();
  const price = config.prices[model] || { input: 0, output: 0 };

  const inputCost = (inputTokens / 1_000_000) * (price.input || 0);
  const outputCost = (outputTokens / 1_000_000) * (price.output || 0);

  return Number((inputCost + outputCost).toFixed(6));
}
