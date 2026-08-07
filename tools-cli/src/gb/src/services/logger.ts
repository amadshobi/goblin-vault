import fs from 'fs';
import path from 'path';
import os from 'os';
import { calculateCost } from '../config/price';
import { resolveModel } from '../config/models';

export type LogType = 'pr-review' | 'issue-summarize' | 'issue-analyze';

export interface LogEntryInput {
  type: LogType;
  number: number;
  model: string;
  variant: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LogEntryRecord {
  timestamp: string;
  number: number;
  model: string;
  variant: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  costUSD: number;
}

/**
 * Mencatat statistik pemanggilan LLM ke file log di ~/.config/gb/logs/<type>.json
 */
export function recordLLMLog(input: LogEntryInput): void {
  try {
    const logsDir = path.join(os.homedir(), '.config', 'gb', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFilePath = path.join(logsDir, `${input.type}.json`);
    let records: LogEntryRecord[] = [];

    if (fs.existsSync(logFilePath)) {
      try {
        const raw = fs.readFileSync(logFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          records = parsed;
        }
      } catch {
        records = [];
      }
    }

    // Resolve actual model ID jika input.model masih "default"
    let actualModel = input.model;
    if (!actualModel || actualModel === 'default') {
      const flags: Record<string, boolean> = {};
      if (input.variant === 'high') flags.high = true;
      else if (input.variant === 'medium') flags.medium = true;
      else if (input.variant === 'low') flags.low = true;

      const resolved = resolveModel(flags);
      actualModel = resolved.id;
    }

    const totalTokens = input.inputTokens + input.outputTokens;
    const costUSD = calculateCost(actualModel, input.inputTokens, input.outputTokens);

    const newRecord: LogEntryRecord = {
      timestamp: new Date().toISOString(),
      number: input.number,
      model: actualModel,
      variant: input.variant,
      tokens: {
        input: input.inputTokens,
        output: input.outputTokens,
        total: totalTokens,
      },
      costUSD,
    };

    records.push(newRecord);

    const tmpPath = `${logFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf8');
    fs.renameSync(tmpPath, logFilePath);
  } catch (err) {
    // Non-blocking log failures
    console.error(`[gb-logger] Gagal mencatat log: ${err instanceof Error ? err.message : String(err)}`);
  }
}
