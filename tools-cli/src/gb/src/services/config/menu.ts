/**
 * config/menu.ts — Config CLI + TUI menu (TS)
 *
 * Port dari `commands/config.js`. Domain ini handle persistent config:
 *   configSet, configGet, configList, configMenu.
 *
 * Validasi khusus:
 *   - key `variant` harus salah satu dari high|medium|low
 *   - key `variants.<high|medium|low>` untuk custom model variant
 *
 * Backed by: ./store (loadConfig/setConfig/getConfig)
 */
import { cancel, confirm, isCancel, note, select, spinner, text } from "@clack/prompts";
import color from "picocolors";
import { clearLastLines } from "../../utils/format";
import { continuePrompt } from "../issue/view";
import { getConfig, loadConfig, setConfig } from "./store";

const VALID_VARIANTS = ["high", "medium", "low"] as const;
type ValidVariant = (typeof VALID_VARIANTS)[number];

function isValidVariant(v: string): v is ValidVariant {
  return (VALID_VARIANTS as readonly string[]).includes(v);
}

export type ConfigSetResult =
  | { ok: true; key: string; value: unknown }
  | { ok: false; error: string };

export type ConfigGetResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: true; found: boolean; value?: unknown }
  | { ok: false; error: string };

export type ConfigListResult =
  | { ok: true; config: Record<string, unknown> }
  | { ok: false; error: string };

/** Format satu value config untuk ditampilkan (string polos, lain JSON). */
export function formatConfigValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Simpan satu key config. Validasi khusus untuk `variant` & `variants.*`.
 */
export function configSet(key: string, value: unknown): ConfigSetResult {
  if (typeof key !== "string" || !key.trim()) {
    return { ok: false, error: "gb: key config harus string non-empty." };
  }
  if (value === undefined) {
    return { ok: false, error: "gb: value config wajib diisi." };
  }

  const k = key.trim();
  const kLower = k.toLowerCase();

  let normalizedValue: unknown = value;
  if (kLower === "variant") {
    const valStr = String(value).trim().toLowerCase();
    if (!isValidVariant(valStr)) {
      return { ok: false, error: "gb: variant tidak valid. Gunakan high, medium, atau low." };
    }
    normalizedValue = valStr;
  } else if (kLower.startsWith("variants.")) {
    const vKey = kLower.slice("variants.".length);
    if (!isValidVariant(vKey)) {
      return { ok: false, error: "gb: variant key tidak valid. Gunakan variants.high, variants.medium, atau variants.low." };
    }
  }

  try {
    setConfig(k, normalizedValue);
    return { ok: true, key: k, value: normalizedValue };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ambil value satu key; tanpa key → seluruh config.
 */
export function configGet(key?: string): ConfigGetResult {
  try {
    if (key == null || key === "") {
      return { ok: true, config: loadConfig() };
    }
    if (typeof key !== "string") {
      return { ok: false, error: "gb: key config harus string." };
    }
    const cfg = loadConfig();
    return { ok: true, found: Object.prototype.hasOwnProperty.call(cfg, key), value: cfg[key] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Ambil seluruh config. */
export function configList(): ConfigListResult {
  try {
    return { ok: true, config: loadConfig() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Format seluruh config sebagai daftar "key = value". */
function formatConfigLines(cfg: Record<string, unknown>): string {
  return Object.entries(cfg)
    .map(([k, v]) => `${color.cyan(k)} = ${formatConfigValue(v)}`)
    .join("\n");
}

/** Tampilkan seluruh config (interaktif). */
async function showAllConfig(): Promise<void> {
  const res = configList();
  if (!res.ok) {
    cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  const keys = Object.keys(res.config);
  if (!keys.length) {
    note(color.dim("Config kosong. Belum ada key yang di-set."), "Config");
    return;
  }
  note(formatConfigLines(res.config), "Config");
}

/** Lihat value key tertentu (interaktif). */
async function getKeyInteractive(): Promise<void> {
  const key = await text({ message: "Nama key:", placeholder: "e.g. model" });
  if (isCancel(key)) {
    clearLastLines(2);
    return;
  }
  const keyStr = String(key).trim();
  if (!keyStr) {
    await showAllConfig();
    return;
  }
  const res = configGet(keyStr);
  if (!res.ok) {
    cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  if ("config" in res) {
    note(formatConfigLines(res.config), "Config");
    return;
  }
  if (!res.found) {
    note(color.yellow(`Config key "${keyStr}" tidak di-set.`), "Config");
    return;
  }
  note(color.green(formatConfigValue(res.value)), `config.${keyStr}`);
}

/** Set key/value (interaktif). */
async function setKeyInteractive(): Promise<void> {
  const key = await text({ message: "Nama key:", placeholder: "e.g. model" });
  if (isCancel(key)) {
    clearLastLines(2);
    return;
  }
  const keyStr = String(key).trim();
  if (!keyStr) {
    note(color.yellow("Key tidak boleh kosong."), "Config");
    return;
  }
  const value = await text({
    message: `Value untuk "${keyStr}":`,
    placeholder: "e.g. gemini-2.5-flash",
  });
  if (isCancel(value)) {
    clearLastLines(2);
    return;
  }
  const res = configSet(keyStr, String(value));
  if (!res.ok) {
    cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  note(color.green(`Config di-set: ${res.key} = ${String(res.value)}`), "Config");
}

/** Set active variant (high | medium | low) interaktif. */
async function setVariantInteractive(): Promise<void> {
  const cfg = loadConfig();
  const currentVariant = typeof cfg.variant === "string" ? cfg.variant : "high";
  const vChoice = await select<{ value: string; label: string; hint?: string }[], string>({
    message: `Set Active Model Variant (Current: ${color.cyan(currentVariant)}):`,
    options: [
      { value: "high", label: "High (Default Utama)", hint: "claude-3-5-sonnet" },
      { value: "medium", label: "Medium", hint: "goblin-nexus/gemini-3.5-flash" },
      { value: "low", label: "Low", hint: "gemini-2.5-flash" },
    ],
  });
  if (isCancel(vChoice)) {
    clearLastLines(2);
    return;
  }
  const res = configSet("variant", String(vChoice));
  if (!res.ok) {
    cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  note(color.green(`Active variant di-set ke: ${String(res.value)}`), "Config");
}

/** Set custom model per variant (variants.high | medium | low) interaktif. */
async function setCustomVariantInteractive(): Promise<void> {
  const vKeyChoice = await select<{ value: string; label: string; hint?: string }[], string>({
    message: "Pilih Variant yang ingin di-set custom model-nya:",
    options: [
      { value: "high", label: "variants.high", hint: "Custom model untuk variant high" },
      { value: "medium", label: "variants.medium", hint: "Custom model untuk variant medium" },
      { value: "low", label: "variants.low", hint: "Custom model untuk variant low" },
    ],
  });
  if (isCancel(vKeyChoice)) {
    clearLastLines(2);
    return;
  }

  const key = `variants.${String(vKeyChoice)}`;
  let currentVal = "";
  try {
    const v = getConfig(key);
    if (typeof v === "string") currentVal = v;
  } catch {
    // ignore
  }

  const modelName = await text({
    message: `Nama custom model untuk ${color.cyan(key)}:`,
    placeholder: "e.g. claude-3-7-sonnet",
    initialValue: currentVal,
  });
  if (isCancel(modelName)) {
    clearLastLines(2);
    return;
  }
  const modelStr = String(modelName).trim();
  if (!modelStr) {
    note(color.yellow("Nama model tidak boleh kosong."), "Config");
    return;
  }
  const res = configSet(key, modelStr);
  if (!res.ok) {
    cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  note(color.green(`Config di-set: ${res.key} = ${String(res.value)}`), "Config");
}

/** TUI menu utama untuk domain config. */
export async function configMenu(): Promise<void> {
  // Reference `confirm` & `spinner` to keep import parity (sesuai legacy
  // module yang punya deps meskipun tidak selalu dipakai).
  void confirm;
  void spinner;

  while (true) {
    const action = await select<{ value: string; label: string; hint?: string }[], string>({
      message: "Config",
      options: [
        { value: "view", label: "Lihat Semua Config", hint: "list" },
        { value: "variant", label: "Set Active Variant", hint: "high | medium | low" },
        { value: "customVariant", label: "Set Custom Model Variant", hint: "variants.<high|medium|low>" },
        { value: "get", label: "Lihat Key Tertentu", hint: "get <key>" },
        { value: "set", label: "Set Key Sembarang", hint: "set <key> <value>" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    switch (action) {
      case "view":
        await showAllConfig();
        break;
      case "variant":
        await setVariantInteractive();
        break;
      case "customVariant":
        await setCustomVariantInteractive();
        break;
      case "get":
        await getKeyInteractive();
        break;
      case "set":
        await setKeyInteractive();
        break;
    }
    await continuePrompt();
  }
}