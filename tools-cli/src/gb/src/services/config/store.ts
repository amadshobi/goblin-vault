/**
 * config/store.ts — Persistent config store (TS)
 *
 * Port dari `utils/config.js`. Config file: ~/.config/goblin-vault/gb-config.json
 * (override via env XDG_CONFIG_HOME). Atomic write (tmp + rename) untuk
 * menjamin tidak ada file korup saat crash.
 *
 * Layer ini adalah single source of truth untuk config persistence di gb.
 * Domain lain (LLM, auth, dll.) cukup import dari sini.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "goblin-vault");
}

function configFilePath(): string {
  return path.join(configDir(), "gb-config.json");
}

/** Load config dari disk. Return {} kalau file belum pernah dibuat. */
export function loadConfig(): Record<string, unknown> {
  const file = configFilePath();
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new Error(`gb: gagal membaca config ${file}: ${(err as Error).message}`);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("root config bukan object");
  } catch (err) {
    throw new Error(`gb: config corrupt di ${file}: ${(err as Error).message}`);
  }
}

/** Persist config ke disk secara atomik (tmp + rename). */
export function saveConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("gb: saveConfig membutuhkan plain object config.");
  }
  const file = configFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tmp, file);
  return { ...config };
}

/** Ambil satu key dari config (top-level). */
export function getConfig(key: string): unknown {
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("gb: getConfig membutuhkan key (string non-empty).");
  }
  return loadConfig()[key];
}

/** Set satu key (immutable — selalu bikin object baru, tidak mutate input). */
export function setConfig(key: string, value: unknown): Record<string, unknown> {
  if (typeof key !== "string" || !key.trim()) {
    throw new Error("gb: setConfig membutuhkan key (string non-empty).");
  }
  const current = loadConfig();
  const next = { ...current, [key]: value };
  return saveConfig(next);
}