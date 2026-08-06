/**
 * llm.ts — LLM Provider service (TS)
 *
 * Port dari `utils/ai.js` + sebagian `utils/config.js` (resolusi model/variant/
 * backend) yang di-inline agar service ini self-contained dan re-usable.
 *
 * Strategi callLLM (fallback):
 *   1. `omp`     (jika useOmp / backend=omp)
 *   2. `opencode` CLI (spawnSync -> array argv)
 *   3. `OPENAI_API_KEY` via `curl --data-binary @-` (payload stdin)
 *   4. Pelemparan error + Goblin Roast Hint yang actionable.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GHPullRequest } from "../types";

// ───────────────────────────────────────────────────────────────────────────
// Inlined model/variant resolution (sumber: utils/config.js + utils/models.json)
// ───────────────────────────────────────────────────────────────────────────

const MODELS_JSON = {
  backends: {
    opencode: {
      high: "anthropic/claude-3.5-sonnet",
      medium: "goblin-nexus/gemini-3.5-flash",
      low: "gemini-2.5-flash",
      auto: "google/gemini-2.0-flash-001",
      none: "deepseek/deepseek-chat",
    },
    omp: {
      high: "google-antigravity/gemini-3.6-flash",
      medium: "google-antigravity/gemini-3.6-flash",
      low: "google-antigravity/gemini-3.6-flash",
      auto: "google-antigravity/gemini-3.6-flash",
      none: "peezy/deepseek-v4-flash-0731",
    },
  },
} as const;

const VALID_VARIANTS = ["high", "medium", "low", "auto", "none"];
const THINKING_MAP: Record<string, string> = {
  high: "high",
  medium: "medium",
  low: "low",
  auto: "auto",
  none: "off",
};

export interface ResolvedModel {
  model: string | null;
  variant: string | null;
  backend: "opencode" | "omp";
  thinking: string;
}

export interface LLMOptions {
  model?: string | null;
  variant?: string | null;
  useOmp?: boolean;
  backend?: "opencode" | "omp" | string;
  thinking?: string;
}

export interface LLMResult {
  text: string;
  backend: string;
  model: string | null;
}

export interface ReviewTokens {
  prompt: number;
  completion: number;
  total: number;
}

export interface GeneratedReview {
  review: string;
  prompt: string;
  model: string | null;
  variant: string | null;
  backend: string;
  thinking: string;
  tokens: ReviewTokens;
}

function loadConfig(): Record<string, unknown> {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const file = path.join(base, "goblin-vault", "gb-config.json");
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Port resolveVariantModel — untuk fallback model reporting opencode. */
function resolveVariantModel(
  variantOrModelName: string | null | undefined,
  _cliOptions: Record<string, unknown> = {}
): { model: string; variant: string | null } {
  const cfg = loadConfig();
  const targetRaw =
    typeof variantOrModelName === "string" && variantOrModelName.trim()
      ? variantOrModelName.trim()
      : typeof cfg.variant === "string" && cfg.variant.trim()
        ? cfg.variant.trim()
        : "high";
  const vKey = targetRaw.toLowerCase();
  const defaultMap: Record<string, string> = MODELS_JSON.backends.opencode;
  if (Object.prototype.hasOwnProperty.call(defaultMap, vKey)) {
    return { model: defaultMap[vKey], variant: vKey };
  }
  return { model: targetRaw, variant: null };
}

/** Port resolveBackendVariantModel — hierarki variant + override config. */
export function resolveBackendVariantModel(
  backendName: string = "opencode",
  variantOrModelName: string | null = null,
  _cliOptions: Record<string, unknown> = {}
): ResolvedModel {
  const backend = backendName === "omp" || backendName === "opencode" ? (backendName as "opencode" | "omp") : "opencode";
  const cfg = loadConfig();

  const rawArg =
    typeof variantOrModelName === "string" && variantOrModelName.trim() ? variantOrModelName.trim() : null;

  let target = rawArg;
  if (!target) {
    target = typeof cfg.variant === "string" && cfg.variant.trim() ? cfg.variant.trim() : "high";
  }

  const cleanTarget = target.toLowerCase();
  const isValidVariant = VALID_VARIANTS.includes(cleanTarget);

  // Bukan variant → explicit model override name.
  if (!isValidVariant) {
    return { model: target, variant: null, backend, thinking: "off" };
  }

  const variantsCfg = (cfg.variants && typeof cfg.variants === "object" ? cfg.variants : {}) as Record<string, unknown>;
  const backendObj = variantsCfg[backend] as Record<string, unknown> | undefined;
  const backendOverride = backendObj && typeof backendObj === "object" ? backendObj[cleanTarget] : undefined;
  const flatOverride = variantsCfg[cleanTarget];

  const customModel =
    typeof backendOverride === "string" && backendOverride.trim()
      ? backendOverride.trim()
      : typeof flatOverride === "string" && flatOverride.trim()
        ? flatOverride.trim()
        : null;

  const defaultMap = MODELS_JSON.backends[backend] as Record<string, string>;
  const model = customModel || defaultMap[cleanTarget] || null;

  return { model, variant: cleanTarget, backend, thinking: THINKING_MAP[cleanTarget] || "off" };
}

// ───────────────────────────────────────────────────────────────────────────
// Prompt & token helpers
// ───────────────────────────────────────────────────────────────────────────

/** Build a review prompt for the LLM from PR data + diff. */
export function buildReviewPrompt(prData: GHPullRequest & { repo?: string }, diff?: string): string {
  const repo = prData.repo || "";
  const number = prData.number != null ? `#${prData.number}` : "";
  const title = prData.title || "(no title)";
  const body = prData.body || "(no description)";
  const author = prData.author?.login || "unknown";

  return [
    "You are a senior code reviewer. Review the GitHub PR below and produce a concise,",
    "actionable review in Bahasa Indonesia. Focus on correctness, security, performance,",
    "and maintainability. Be direct and practical — no fluff.",
    "",
    `PR ${number} — ${title}`,
    `Repo: ${repo} | Author: ${author}`,
    "",
    "DESCRIPTION:",
    body,
    "",
    "DIFF:",
    "```diff",
    diff || "(no diff provided)",
    "```",
    "",
    "OUTPUT FORMAT:",
    "- Ringkasan singkat (1-2 kalimat).",
    "- Daftar masalah/risiko dengan severity (🔴 blocker / 🟠 warning / 🟢 nitpick).",
    "- Saran perbaikan yang spesifik dan actionable.",
  ].join("\n");
}

/** Rough token estimate: ~4 chars/token (for cost logging, not precision). */
export function estimateTokens(text: string | null | undefined): number {
  return Math.ceil(String(text ?? "").length / 4);
}

// ───────────────────────────────────────────────────────────────────────────
// LLM runners
// ───────────────────────────────────────────────────────────────────────────

/** Cached cmd availability (avoids repeated spawnSync --version in batch mode). */
const cmdCache: Record<string, boolean> = {};

export function hasCmd(cmd: string): boolean {
  if (Object.prototype.hasOwnProperty.call(cmdCache, cmd)) return cmdCache[cmd];
  try {
    cmdCache[cmd] = spawnSync(cmd, ["--version"], { stdio: "ignore" }).status === 0;
  } catch {
    cmdCache[cmd] = false;
  }
  return cmdCache[cmd];
}

export function stripAnsi(str: string | null | undefined): string {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

const OMP_THINKING_VALUES = new Set(["high", "medium", "low", "auto", "off"]);

/** Run `omp` (prompt optimizer) via spawnSync argv. */
export function callOmp(prompt: string, options: LLMOptions = {}): LLMResult | null {
  const tmpFile = path.join(os.tmpdir(), `gb-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    fs.writeFileSync(tmpFile, prompt, "utf8");
    const args = ["-p", `@${tmpFile}`, "--no-session", "--hide-thinking"];
    if (options.model) args.push(`--model=${options.model}`);
    if (options.thinking && OMP_THINKING_VALUES.has(options.thinking)) {
      args.push(`--thinking=${options.thinking}`);
    }
    const r = spawnSync("omp", args, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
    });
    if (r.status === 0 && r.stdout && r.stdout.trim()) {
      return { text: r.stdout.trim(), backend: "omp", model: options.model || null };
    }
    if (r.error) throw new Error(`omp spawn error: ${r.error.message}`);
    if (r.status !== 0) {
      const first = r.stderr?.trim()?.split("\n")[0] || r.stdout?.trim()?.split("\n")[0] || "unknown error";
      throw new Error(`omp exit ${r.status}: ${first}`);
    }
    throw new Error("omp exit 0 tapi menghasilkan stdout kosong");
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup failure
    }
  }
}

/** OpenAI-compatible chat completion via curl (payload via stdin). */
export function callOpenAIViaCurl(prompt: string, modelOverride?: string | null): string {
  const key = process.env.OPENAI_API_KEY;
  const model = modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const r = spawnSync(
    "curl",
    [
      "-sS", "-X", "POST", url,
      "-H", `Authorization: Bearer ${key}`,
      "-H", "Content-Type: application/json",
      "--data-binary", "@-",
    ],
    { input: body, encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 60_000 }
  );

  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`curl exit ${r.status}: ${r.stderr?.trim() || "unknown error"}`);
  }

  const raw = r.stdout || "";
  let parsed: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const preview = raw.replace(/\s+/g, " ").trim().slice(0, 200);
    throw new Error(
      `OpenAI API mengembalikan response non-JSON (mungkin error 502/cloudflare). Preview: ${preview || "(stdout kosong)"}`
    );
  }

  const content = parsed.choices?.[0]?.message?.content;
  if (!content) {
    const apiErr = parsed.error?.message || "unknown";
    throw new Error(`OpenAI API tidak mengembalikan konten: ${String(apiErr).slice(0, 200)}`);
  }
  return content.trim();
}

/**
 * Call an LLM with fallback strategies.
 * @throws {Error} Kalau seluruh backend gagal.
 */
export function callLLM(prompt: string, options: LLMOptions = {}): LLMResult {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("callLLM: prompt wajib berupa string non-empty.");
  }

  let lastError: string | null = null;

  // Strategy 0: `omp`
  const wantsOmp = options.useOmp === true || options.backend === "omp";
  if (wantsOmp && hasCmd("omp")) {
    try {
      const r = callOmp(prompt, options);
      if (r) return r;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Strategy 1: opencode CLI
  if (hasCmd("opencode")) {
    try {
      const r = spawnSync("opencode", ["run"], {
        input: prompt,
        encoding: "utf8",
        maxBuffer: 50 * 1024 * 1024,
        timeout: 300_000,
      });
      if (r.status === 0 && r.stdout && r.stdout.trim()) {
        const { model: fallbackModel } = resolveVariantModel("opencode", { variant: options.variant ?? undefined });
        return { text: r.stdout.trim(), backend: "opencode", model: fallbackModel || options.model || null };
      }
      const exitReason = r.error ? r.error.message : r.status === null ? "timeout (>5m)" : `exit ${r.status}`;
      lastError = r.stderr?.trim()?.split("\n")[0] || `opencode ${exitReason}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Strategy 2: OPENAI_API_KEY via curl
  if (process.env.OPENAI_API_KEY) {
    try {
      const review = callOpenAIViaCurl(prompt, options.model);
      return { text: review, backend: "openai", model: options.model || null };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Strategy 3: clear error + actionable hint
  const hint =
    "Pasang CLI `opencode` (https://opencode.ai/docs/cli) ATAU export env OPENAI_API_KEY " +
    "(opsional: OPENAI_MODEL, OPENAI_BASE_URL) lalu coba lagi.";
  const detail = lastError ? ` (detail: ${lastError})` : "";
  throw new Error(`gb: tidak ada LLM backend yang berhasil. ${hint}${detail}`);
}

/**
 * Generate a review for a PR (sync). Resolves model/variant/backend, builds
 * prompt, calls LLM, computes token estimates.
 */
export function generateReview(
  prData: GHPullRequest & { repo?: string },
  diff: string,
  options: LLMOptions = {}
): GeneratedReview {
  const requestedBackend = options.useOmp === true ? "omp" : options.backend || "opencode";
  const resolved = resolveBackendVariantModel(requestedBackend, options.model || options.variant, {
    ...options,
  } as unknown as Record<string, unknown>);

  const prompt = buildReviewPrompt(prData, diff);
  const { text, backend: usedBackend, model: usedModel } = callLLM(prompt, {
    useOmp: resolved.backend === "omp",
    backend: resolved.backend,
    model: resolved.model,
    thinking: resolved.thinking,
  });

  const review = stripAnsi(text);
  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(review);
  return {
    review,
    prompt,
    model: usedModel || resolved.model,
    variant: resolved.variant,
    backend: usedBackend,
    thinking: resolved.thinking,
    tokens: {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    },
  };
}