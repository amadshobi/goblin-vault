import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface GnConfigFile {
  aliases?: Record<string, string>;
  [key: string]: any;
}

/**
 * Path to ~/.config/gn/config.json
 */
export function getGnConfigJsonPath(): string {
  return path.join(os.homedir(), ".config", "gn", "config.json");
}

/**
 * Reads GN config strictly from ~/.config/gn/config.json.
 * Returns empty aliases {} if file does not exist.
 * ZERO sample file generation and ZERO hardcoded provider aliases in code.
 */
export function loadGnConfig(): GnConfigFile {
  const configPath = getGnConfigJsonPath();
  if (!fs.existsSync(configPath)) {
    return { aliases: {} };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as GnConfigFile;
  } catch {
    return { aliases: {} };
  }
}

/**
 * Resolves provider alias dynamically from ~/.config/gn/config.json.
 * Alias is used ONLY for CLI input command convenience.
 * If alias is not configured in config.json, defaults strictly to input string verbatim.
 */
export function resolveProviderAlias(input: string): { provider: string; alias: string } {
  const cleanInput = input.trim().toLowerCase();
  const config = loadGnConfig();
  const aliases = config.aliases || {};

  // 1. Match alias key in ~/.config/gn/config.json (e.g. "agy" -> "google-antigravity")
  if (aliases[cleanInput]) {
    return { provider: aliases[cleanInput], alias: cleanInput };
  }

  // 2. Reverse match: input is full provider name registered in config.json
  for (const [key, target] of Object.entries(aliases)) {
    if (target.toLowerCase() === cleanInput) {
      return { provider: target, alias: key };
    }
  }

  // 3. Fallback: use clean input verbatim
  return { provider: cleanInput, alias: cleanInput };
}

/**
 * Format model ID for display.
 * Guarantees provider prefix format (e.g. "openai/gpt-5.4" or "google-antigravity/gemini-3.6-flash").
 */
export function formatModelDisplayId(modelId: string, provider: string): string {
  let clean = modelId.trim().replace(/^\s*(?:[^\s]+\s+)?\[[^\]]+\]\s*/, "").trim();

  if (clean.toLowerCase().startsWith(provider.toLowerCase() + "/")) {
    return clean;
  }

  return `${provider}/${clean}`;
}
