/**
 * llm.ts — Pure OMP LLM Provider service (TS)
 *
 * Menggunakan 100% `omp` CLI runner sebagai single-engine LLM backend.
 * Stateless, zero session-trash, real-time NDJSON stream parser.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MarkdownStreamFormatter, formatOpenCodeToolLabel } from "../core/renderer";
import type { GHPullRequest } from "../types";

// ───────────────────────────────────────────────────────────────────────────
// Inlined model/variant resolution (sumber: utils/config.js + utils/models.json)
// ───────────────────────────────────────────────────────────────────────────

const MODELS_JSON = {
  backends: {
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
  backend: "omp";
  thinking: string;
}

export interface LLMOptions {
  model?: string | null;
  variant?: string | null;
  backend?: "omp" | string;
  thinking?: string;
}

export interface LLMResult {
  text: string;
  backend: "omp";
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
  backend: "omp";
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

/** Port resolveBackendVariantModel — hierarki variant + override config. */
export function resolveBackendVariantModel(
  _backendName: string = "omp",
  variantOrModelName: string | null = null,
  _cliOptions: Record<string, unknown> = {}
): ResolvedModel {
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
    return { model: target, variant: null, backend: "omp", thinking: "off" };
  }

  const variantsCfg = (cfg.variants && typeof cfg.variants === "object" ? cfg.variants : {}) as Record<string, unknown>;
  const flatOverride = variantsCfg[cleanTarget];

  const customModel =
    typeof flatOverride === "string" && flatOverride.trim()
      ? flatOverride.trim()
      : null;

  const defaultMap = MODELS_JSON.backends.omp as Record<string, string>;
  const model = customModel || defaultMap[cleanTarget] || null;

  return { model, variant: cleanTarget, backend: "omp", thinking: THINKING_MAP[cleanTarget] || "off" };
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

/**
 * Call OMP LLM backend.
 * @throws {Error} Kalau OMP CLI gagal atau tidak tersedia.
 */
export function callLLM(prompt: string, options: LLMOptions = {}): LLMResult {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("callLLM: prompt wajib berupa string non-empty.");
  }

  if (!hasCmd("omp")) {
    throw new Error("gb: CLI `omp` tidak ditemukan di system PATH. Tolong pastikan `omp` terpasang!");
  }

  const r = callOmp(prompt, options);
  if (r) return r;

  throw new Error("gb: eksekusi `omp` gagal menghasilkan output.");
}

/**
 * Generate a review for a PR (sync). Resolves model/variant, builds
 * prompt, calls OMP LLM, computes token estimates.
 */
export function generateReview(
  prData: GHPullRequest & { repo?: string },
  diff: string,
  options: LLMOptions = {}
): GeneratedReview {
  const resolved = resolveBackendVariantModel("omp", options.variant || options.model);
  const prompt = buildReviewPrompt(prData, diff);
  const { text, model: usedModel } = callLLM(prompt, {
    model: resolved.model,
    variant: resolved.variant,
  });

  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(text);
  return {
    review: text,
    prompt,
    model: usedModel,
    variant: resolved.variant,
    backend: "omp",
    thinking: resolved.thinking,
    tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
  };
}

/**
 * Stream LLM response token-by-token via MarkdownStreamFormatter using OMP NDJSON stream.
 */
export async function streamLLM(prompt: string, options: LLMOptions = {}): Promise<string> {
  const startTime = Date.now();
  const formatter = new MarkdownStreamFormatter();
  const textChunks: string[] = [];
  let hasStreamedText = false;
  const modelStr = options.model || "default";
  const labelStr = "omp/assistant";
  console.log(`\x1b[90m┌─\x1b[0m \x1b[1;36m󰚩 ${labelStr}\x1b[0m \x1b[90m${"─".repeat(Math.max(10, 45 - labelStr.length))}\x1b[0m`);
  console.log(`\x1b[90m│\x1b[0m \x1b[90m󰅂 Model : ${modelStr}\x1b[0m`);
  console.log(`\x1b[90m└${"─".repeat(50)}\x1b[0m\n`);

  return new Promise<string>((resolvePromise, rejectPromise) => {
    let tmpFile: string | null = null;
    let child: ReturnType<typeof spawn>;

    try {
      tmpFile = path.join(os.tmpdir(), `gb-live-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
      fs.writeFileSync(tmpFile, prompt, "utf8");

      const ompArgs = [
        "-p", `@${tmpFile}`,
        "--mode=json",
        "--no-session",
        "--hide-thinking",
      ];
      if (options.model) {
        ompArgs.push(`--model=${options.model}`);
      }
      if (options.variant) {
        ompArgs.push(`--thinking=${options.variant}`);
      }
      child = spawn("omp", ompArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd(),
        env: process.env,
      });
    } catch (err) {
      if (tmpFile && fs.existsSync(tmpFile)) {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
      return rejectPromise(err);
    }

    const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const DOT_FRAMES = [".  ", ".. ", "...", "   "];

    const isEmbedded = Boolean(
      process.env.OPENCODE_SESSION ||
      process.env.OMP_SESSION_ID ||
      process.env.PI_SESSION ||
      process.env.TERM === "dummy" ||
      !process.stdout.isTTY
    );
    const isRealTTY = Boolean(process.stdout.isTTY) && !isEmbedded;

    let frameIdx = 0;
    let isSpinnerActive = true;
    let currentStatus = "Working";
    let stepStartTime = Date.now();
    let activeToolSummary = "";
    let activeToolId = "";
    let toolCount = 0;

    function clearSpinner() {
      if (isSpinnerActive && isRealTTY) {
        try {
          process.stdout.write("\r\x1b[K\x1b[?25h");
        } catch {
          process.stdout.write("\r\x1b[K\x1b[?25h");
        }
      }
      isSpinnerActive = false;
    }

    function startSpinner(status: string, label = "") {
      currentStatus = status;
      activeToolSummary = label;
      stepStartTime = Date.now();
      isSpinnerActive = true;
      if (isRealTTY) {
        process.stdout.write("\x1b[?25l");
      }
    }

    if (isRealTTY) {
      process.stdout.write("\x1b[?25l");
    }

    const spinInterval = setInterval(() => {
      if (isSpinnerActive && isRealTTY) {
        const frame = SPINNER_FRAMES[frameIdx];
        const elapsedSec = Math.floor((Date.now() - stepStartTime) / 1000);
        let displayText = "";

        if (currentStatus === "Working") {
          const dots = DOT_FRAMES[Math.floor(frameIdx / 3) % DOT_FRAMES.length];
          displayText = `\x1b[33mWorking${dots}\x1b[0m`;
        } else if (currentStatus === "tool") {
          displayText = `\x1b[1;33m${activeToolSummary}\x1b[0m`;
        } else {
          displayText = `\x1b[33m${currentStatus}\x1b[0m`;
        }

        const lineOutput = `\x1b[36m${frame}\x1b[0m ${displayText} \x1b[90m(${elapsedSec}s)\x1b[0m`;
        process.stdout.write(`\r\x1b[K${lineOutput}`);
        frameIdx = (frameIdx + 1) % SPINNER_FRAMES.length;
      }
    }, 120);
    spinInterval.unref();

    let lineBuffer = "";

    const processTextDelta = (delta: string) => {
      clearSpinner();
      hasStreamedText = true;
      textChunks.push(delta);
      const rendered = formatter.processChunk(delta);
      if (rendered) {
        process.stdout.write(rendered);
      }
    };

    child.stdout!.on("data", (d: Buffer) => {
      lineBuffer += d.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const eventType = data?.type;

          if (eventType === "tool_execution_start" || eventType === "tool_start") {
            clearSpinner();
            hasStreamedText = false;
            const toolName = data.toolName || data.name || data.tool || "tool";
            const toolId = data.toolCallId || data.id || `${toolName}_${Date.now()}`;
            if (activeToolId === toolId) continue;
            activeToolId = toolId;
            const toolArgs = data.args || data.arguments || {};
            const toolLabel = formatOpenCodeToolLabel(toolName, toolArgs);
            startSpinner("tool", toolLabel);
          } else if (eventType === "tool_execution_end" || eventType === "tool_end") {
            clearSpinner();
            toolCount++;
            const isErr = Boolean(data.isError || data.error);
            const icon = isErr ? "\x1b[31m󰅚\x1b[0m" : "\x1b[32m󰄬\x1b[0m";
            const durSec = ((Date.now() - stepStartTime) / 1000).toFixed(1);
            console.log(`${icon} \x1b[1m${activeToolSummary}\x1b[0m \x1b[32m(${durSec}s)\x1b[0m`);
            activeToolId = "";
            startSpinner("Working");
          } else if (eventType === "message_update") {
            const evt = data.assistantMessageEvent;
            if (evt?.type === "thinking_start") {
              clearSpinner();
              process.stdout.write("\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m");
            } else if (evt?.type === "thinking_delta" && evt.delta) {
              clearSpinner();
              process.stdout.write(evt.delta);
            } else if (evt?.type === "thinking_end") {
              process.stdout.write("\x1b[0m\n\n");
            } else if (evt?.type === "text_start") {
              clearSpinner();
              process.stdout.write("\x1b[0m\n");
              hasStreamedText = true;
            } else if (evt?.type === "text_delta" && evt.delta) {
              processTextDelta(evt.delta);
            }
          } else if (eventType === "message_end") {
            const msg = data.message;
            if (msg?.role === "assistant" && Array.isArray(msg.content)) {
              for (const item of msg.content) {
                if (item.type === "thinking" && item.thinking && !hasStreamedText) {
                  clearSpinner();
                  console.log(`\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m${item.thinking.trim()}\x1b[0m\n`);
                } else if (item.type === "text" && item.text && !hasStreamedText) {
                  processTextDelta(item.text);
                }
              }
            }
            hasStreamedText = true;
          } else if (eventType === "content_delta" && data.delta?.text) {
            processTextDelta(data.delta.text);
          } else if (eventType === "thought" || data.thought) {
            clearSpinner();
            const thoughtTxt = data.thought || data.text || "";
            if (thoughtTxt.trim()) {
              console.log(`\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m${thoughtTxt.trim()}\x1b[0m\n`);
            }
            startSpinner("Working");
          }
        } catch {
          if (!line.trim().startsWith("{") && !line.trim().startsWith("[")) {
            processTextDelta(line + "\n");
          }
        }
      }
    });

    child.stderr!.on("data", (data: Buffer) => {
      clearSpinner();
      process.stderr.write(data);
    });

    child.on("error", (err) => {
      clearSpinner();
      clearInterval(spinInterval);
      if (isRealTTY) process.stdout.write("\x1b[?25h");
      rejectPromise(err);
    });

    child.on("close", (code) => {
      clearSpinner();
      clearInterval(spinInterval);
      if (isRealTTY) process.stdout.write("\x1b[?25h");

      if (lineBuffer.trim() && !hasStreamedText) {
        try {
          const data = JSON.parse(lineBuffer);
          if (data?.type === "message_update" && data?.assistantMessageEvent?.delta) {
            processTextDelta(data.assistantMessageEvent.delta);
          } else if (data?.delta?.text) {
            processTextDelta(data.delta.text);
          }
        } catch {
          processTextDelta(lineBuffer + "\n");
        }
      }

      const flushed = formatter.flush();
      if (flushed) process.stdout.write(flushed);

      const totalDurSec = Math.max(0.1, Number(((Date.now() - startTime) / 1000).toFixed(1)));
      const toolsStr = toolCount > 0 ? ` \x1b[90m󰇙\x1b[0m 󰆧 ${toolCount} tool${toolCount === 1 ? "" : "s"}` : "";

      const raw = textChunks.join("").trim();
      if (raw || code === 0) {
        console.log(`\n\x1b[90m└─\x1b[0m \x1b[32m󰄬 assistant completed\x1b[0m \x1b[90m(${totalDurSec}s)${toolsStr} ${"─".repeat(20)}\x1b[0m\n`);
        resolvePromise(raw);
      } else {
        console.log(`\n\x1b[90m└─\x1b[0m \x1b[31m󰅚 assistant failed (${code})\x1b[0m \x1b[90m(${totalDurSec}s)${toolsStr} ${"─".repeat(20)}\x1b[0m\n`);
        rejectPromise(new Error(`LLM live backend exit ${code}`));
      }
    });
  });
}