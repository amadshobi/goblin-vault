/**
 * llm.ts — Pure OMP LLM Provider service (TS)
 *
 * Menggunakan 100% `omp` CLI runner sebagai single-engine LLM backend.
 * Isolated System Prompt (--system-prompt), clean tool-call status spinner,
 * zero-leak Non-JSON streamer, real-time NDJSON stream parser, & Contextual Header/Footer.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MarkdownStreamFormatter, formatOpenCodeToolLabel } from "../core/renderer";
import { resolveModel, type ModelPreset, type ModelResolutionFlags } from "../config/models";
import { calculateCost } from "../config/price";

export interface LLMStreamOptions extends ModelResolutionFlags {
  systemPrompt?: string;
  model?: string | null;
  variant?: string | null;
  tools?: string;
  label?: string;    // e.g. "omp/issue-summarize", "omp/pr-review"
  taskName?: string; // e.g. "summarizer", "reviewer", "analyzer"
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

export function estimateTokens(text: string | null | undefined): number {
  return Math.ceil(String(text ?? "").length / 4);
}

export function stripAnsi(str: string | null | undefined): string {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "");
}

function formatTokens(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
  return String(num);
}

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
    const args = [
      "-p", `@${tmpFile}`,
      "--mode=json",
      "--no-session",
      "--tools=read,glob,grep,bash",
      "--approval-mode=yolo",
      "--auto-approve",
    ];
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

/**
 * Stream LLM response token-by-token via MarkdownStreamFormatter using OMP NDJSON stream.
 */
export async function streamLLM(userPrompt: string, options: LLMStreamOptions = {}): Promise<string> {
  if (!hasCmd("omp")) {
    throw new Error("gb: CLI `omp` tidak ditemukan di system PATH. Pastikan `omp` terpasang!");
  }

  const preset: ModelPreset = resolveModel(options);
  const selectedModel = options.model || preset.id;
  const selectedVariant = options.variant || preset.variant || "medium";
  const toolsParam = options.tools || "read,glob,grep,bash";
  const labelStr = options.label || "omp/assistant";
  const taskName = options.taskName || "assistant";

  const startTime = Date.now();
  const formatter = new MarkdownStreamFormatter();
  const textChunks: string[] = [];
  let hasStreamedText = false;
  let inputTokens = estimateTokens(userPrompt);
  let outputTokens = 0;

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
        `--tools=${toolsParam}`,
        "--approval-mode=yolo",
        "--auto-approve",
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
    let activeToolSummary = "";
    let activeToolId = "";
    let toolCount = 0;

    const activeToolMap = new Map<string, { summary: string }>();

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
        let displayText = "";

        if (currentStatus === "Working") {
          const dots = DOT_FRAMES[Math.floor(frameIdx / 3) % DOT_FRAMES.length];
          displayText = `\x1b[33mWorking${dots}\x1b[0m`;
        } else if (currentStatus === "tool") {
          displayText = `\x1b[1;33m${activeToolSummary}\x1b[0m`;
        } else {
          displayText = `\x1b[33m${currentStatus}\x1b[0m`;
        }

        const lineOutput = `\x1b[36m${frame}\x1b[0m ${displayText}`;
        process.stdout.write(`\r\x1b[K${lineOutput}`);
        frameIdx = (frameIdx + 1) % SPINNER_FRAMES.length;
      }
    }, 120);
    spinInterval.unref();

    let lineBuffer = "";

    const processTextDelta = (delta: string) => {
      if (delta.includes("<tool_call>") || delta.includes("<tool_response>") || delta.includes("<shell_metadata>")) {
        return;
      }

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

          const usage = data?.usage || data?.message?.usage;
          if (usage) {
            if (typeof usage.input === "number") inputTokens = usage.input;
            if (typeof usage.output === "number") outputTokens = usage.output;
          }

          if (eventType === "tool_execution_start" || eventType === "tool_start") {
            clearSpinner();
            hasStreamedText = false;
            const toolName = data.toolName || data.name || data.tool || "tool";
            const toolId = String(data.toolCallId || data.id || `${toolName}_${Date.now()}`);
            if (activeToolMap.has(toolId)) continue;

            const toolArgs = data.args || data.arguments || {};
            const toolLabel = formatOpenCodeToolLabel(toolName, toolArgs);

            activeToolId = toolId;
            activeToolMap.set(toolId, { summary: toolLabel });

            startSpinner("tool", toolLabel);
          } else if (eventType === "tool_execution_end" || eventType === "tool_end") {
            clearSpinner();
            const toolName = data.toolName || data.name || data.tool || "tool";
            const toolId = String(data.toolCallId || data.id || activeToolId);
            const toolMeta = activeToolMap.get(toolId);

            const summary = toolMeta?.summary || activeToolSummary;
            if (summary && summary.trim()) {
              toolCount++;
              const isErr = Boolean(data.isError || data.error);
              const icon = isErr ? "\x1b[31mx\x1b[0m" : "•";

              console.log(`\x1b[90m│\x1b[0m  ${icon} ${summary}`);
            }

            activeToolMap.delete(toolId);
            if (activeToolId === toolId) activeToolId = "";
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
          const rawTrim = line.trim();
          if (
            rawTrim.startsWith("<tool_call>") ||
            rawTrim.startsWith("<tool_response>") ||
            rawTrim.startsWith("<shell_metadata>") ||
            rawTrim.includes("</tool_call>") ||
            rawTrim.includes("</tool_response>")
          ) {
            continue;
          }
          if (!rawTrim.startsWith("{") && !rawTrim.startsWith("[")) {
            processTextDelta(line + "\n");
          }
        }
      }
    });

    child.stderr!.on("data", (data: Buffer) => {
      clearSpinner();
      const errStr = data.toString();
      if (!errStr.includes("<tool_call>") && !errStr.includes("No API key found")) {
        process.stderr.write(data);
      }
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
          const rawTrim = lineBuffer.trim();
          if (
            !rawTrim.startsWith("<tool_call>") &&
            !rawTrim.startsWith("<tool_response>")
          ) {
            processTextDelta(lineBuffer + "\n");
          }
        }
      }

      const flushed = formatter.flush();
      if (flushed) process.stdout.write(flushed);

      const totalDurSec = Math.max(0.1, Number(((Date.now() - startTime) / 1000).toFixed(1)));
      const raw = textChunks.join("").trim();
      if (outputTokens === 0) outputTokens = estimateTokens(raw);
      const totalTok = inputTokens + outputTokens;
      const costUSD = calculateCost(selectedModel, inputTokens, outputTokens);
      const costStr = costUSD > 0 ? ` ($${costUSD.toFixed(4)})` : "";

      const toolsStr = toolCount > 0 ? ` \x1b[90m󰇙\x1b[0m 󰆧 ${toolCount} tool${toolCount === 1 ? "" : "s"}` : "";
      const tokensStr = ` \x1b[90m󰇙\x1b[0m 🪙 ${formatTokens(totalTok)} tokens${costStr}`;

      if (raw || code === 0) {
        console.log(`\n\x1b[90m└─\x1b[0m \x1b[32m󰄬 ${taskName} completed\x1b[0m \x1b[90m(${totalDurSec}s)${toolsStr}${tokensStr} ${"─".repeat(15)}\x1b[0m\n`);
        resolvePromise(raw);
      } else {
        console.log(`\n\x1b[90m└─\x1b[0m \x1b[31m󰅚 ${taskName} failed (${code})\x1b[0m \x1b[90m(${totalDurSec}s)${toolsStr}${tokensStr} ${"─".repeat(15)}\x1b[0m\n`);
        rejectPromise(new Error(`LLM live backend exit ${code}`));
      }
    });
  });
}
