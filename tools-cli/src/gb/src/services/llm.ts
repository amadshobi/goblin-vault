/**
 * llm.ts — Pure OMP LLM Provider service (TS)
 *
 * Menggunakan 100% `omp` CLI runner sebagai single-engine LLM backend.
 * Isolated System Prompt (--system-prompt), stateless, zero session-trash, real-time NDJSON stream parser.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MarkdownStreamFormatter, formatOpenCodeToolLabel } from "../core/renderer";
import { resolveModel, type ModelPreset, type ModelResolutionFlags } from "../config/models";

export interface LLMStreamOptions extends ModelResolutionFlags {
  systemPrompt?: string;
  model?: string | null;
  variant?: string | null;
}

export interface LLMResult {
  text: string;
  backend: "omp";
  model: string;
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

/** Estimate tokens (~4 chars per token). */
export function estimateTokens(text: string | null | undefined): number {
  return Math.ceil(String(text ?? "").length / 4);
}

export function stripAnsi(str: string | null | undefined): string {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

/** Build review prompt fallback */
export function buildReviewPrompt(prData: any, diff?: string): string {
  const repo = prData.repo || "";
  const number = prData.number != null ? `#${prData.number}` : "";
  const title = prData.title || "(no title)";
  const body = prData.body || "(no description)";

  return [
    `PR ${number} — ${title}`,
    `Repo: ${repo}`,
    "",
    "DESCRIPTION:",
    body,
    "",
    "DIFF:",
    "```diff",
    diff || "(no diff provided)",
    "```",
  ].join("\n");
}

export function callLLM(prompt: string, options: LLMStreamOptions = {}): LLMResult {
  const tmpFile = path.join(os.tmpdir(), `gb-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  try {
    fs.writeFileSync(tmpFile, prompt, "utf8");
    const args = ["-p", `@${tmpFile}`, "--mode=json", "--no-session", "--no-tools", "--no-rules", "--no-skills"];
    if (options.systemPrompt) args.push(`--system-prompt=${options.systemPrompt}`);
    if (options.model) args.push(`--model=${options.model}`);
    const r = spawnSync("omp", args, { encoding: "utf8", timeout: 120_000 });
    if (r.status === 0 && r.stdout) {
      return { text: r.stdout.trim(), backend: "omp", model: options.model || "default" };
    }
    throw new Error(`omp exit ${r.status}`);
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}

export function generateReview(prData: any, diff: string, options: LLMStreamOptions = {}): GeneratedReview {
  const prompt = buildReviewPrompt(prData, diff);
  const res = callLLM(prompt, options);
  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(res.text);
  return {
    review: res.text,
    prompt,
    model: res.model,
    variant: options.variant || null,
    backend: "omp",
    thinking: "",
    tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
  };
}

const OMP_THINKING_VALUES = new Set(["high", "medium", "low", "auto", "off"]);

/** Cached cmd availability. */
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

/**
 * Stream LLM response token-by-token via MarkdownStreamFormatter using OMP NDJSON stream.
 * Isolates system prompt with `--system-prompt` and disables OMP global rules/skills/tools.
 */
export async function streamLLM(userPrompt: string, options: LLMStreamOptions = {}): Promise<string> {
  if (!hasCmd("omp")) {
    throw new Error("gb: CLI `omp` tidak ditemukan di system PATH. Pastikan `omp` terpasang!");
  }

  const preset: ModelPreset = resolveModel(options);
  const selectedModel = options.model || preset.id;
  const selectedVariant = options.variant || preset.variant || "medium";

  const startTime = Date.now();
  const formatter = new MarkdownStreamFormatter();
  const textChunks: string[] = [];
  let hasStreamedText = false;
  const labelStr = "omp/assistant";

  console.log(`\x1b[90m┌─\x1b[0m \x1b[1;36m󰚩 ${labelStr}\x1b[0m \x1b[90m${"─".repeat(Math.max(10, 45 - labelStr.length))}\x1b[0m`);
  console.log(`\x1b[90m│\x1b[0m \x1b[90m󰅂 Model   : ${selectedModel}\x1b[0m`);
  console.log(`\x1b[90m│\x1b[0m \x1b[90m󰅂 Variant : ${selectedVariant}\x1b[0m`);
  console.log(`\x1b[90m└${"─".repeat(50)}\x1b[0m\n`);

  return new Promise<string>((resolvePromise, rejectPromise) => {
    let tmpFile: string | null = null;
    let child: ReturnType<typeof spawn>;

    try {
      tmpFile = path.join(os.tmpdir(), `gb-live-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
      fs.writeFileSync(tmpFile, userPrompt, "utf8");

      const ompArgs = [
        "-p", `@${tmpFile}`,
        "--mode=json",
        "--no-session",
        "--no-tools",
        "--no-rules",
        "--no-skills",
        `--model=${selectedModel}`,
      ];

      if (options.systemPrompt && options.systemPrompt.trim()) {
        ompArgs.push(`--system-prompt=${options.systemPrompt.trim()}`);
      }

      if (selectedVariant && OMP_THINKING_VALUES.has(selectedVariant)) {
        ompArgs.push(`--thinking=${selectedVariant}`);
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
