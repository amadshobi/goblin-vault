import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { cursorTo, clearLine } from "node:readline";
import type { AgentInfo } from "../types";
import { formatMarkdownTerminal, formatOpenCodeToolLabel, renderGitDiff, MarkdownStreamFormatter } from "./renderer";
import { recordSessionEntry } from "./session";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const DOT_FRAMES = [".  ", ".. ", "...", "   "];

export async function executeOmp(
  agent: AgentInfo,
  prompt: string,
  modelParam: string | null,
  variantParam: string | null,
  overrideTools: string | null,
  cwd: string,
  isStream: boolean,
  showDiff: boolean = false,
  fallbackModelParam?: string | null,
  sessionInfo?: { title: string; sessionId?: string; isResume: boolean },
  passthroughFlags?: string[]
) {
  const subagentStartTime = Date.now();
  let toolsParam = overrideTools || agent.tools.join(",");
  if (!toolsParam) {
    toolsParam = agent.name.includes("review")
      ? "read,bash,grep,glob,todo"
      : "read,edit,write,bash,grep,glob,todo";
  }

  const fullPromptContent = readFileSync(agent.path, "utf-8");

  const ompArgs = [
    "-p", prompt,
    `--system-prompt=${fullPromptContent}`,
    `--tools=${toolsParam}`,
    "--auto-approve",
    "--approval-mode=yolo",
    `--cwd=${cwd}`
  ];

  if (sessionInfo?.sessionId) {
    ompArgs.push(`--resume=${sessionInfo.sessionId}`);
  } else if (sessionInfo?.isResume) {
    ompArgs.push("-c");
  }

  if (passthroughFlags && passthroughFlags.length > 0) {
    ompArgs.push(...passthroughFlags);
  }

  if (isStream) {
    ompArgs.push("--mode=json");
    ompArgs.push("--print-thoughts");
  }

  if (modelParam) {
    ompArgs.push(`--model=${modelParam}`);
  }

  if (variantParam) {
    ompArgs.push(`--thinking=${variantParam}`);
  }

  // LIVE STREAMING MODE
  if (isStream) {
    const modelStr = modelParam || agent.model || "default";
    console.log(`\x1b[90m┌─\x1b[0m \x1b[1;36m󰚩 ${agent.name}\x1b[0m \x1b[90m${"─".repeat(Math.max(10, 45 - agent.name.length))}\x1b[0m`);
    console.log(`\x1b[90m│\x1b[0m \x1b[90m󰅂 Model : ${modelStr}\x1b[0m`);
    console.log(`\x1b[90m└${"─".repeat(50)}\x1b[0m\n`);

    const proc = spawn("omp", ompArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd,
      env: process.env
    });

    const isEmbedded = Boolean(
      process.env.OPENCODE_SESSION ||
      process.env.OMP_SESSION_ID ||
      process.env.PI_SESSION ||
      process.env.TERM === "dummy" ||
      !process.stdout.isTTY
    );
    const isRealTTY = Boolean(process.stdout.isTTY) && !isEmbedded;

    const spinnerFrames = SPINNER_FRAMES;
    const dotFrames = DOT_FRAMES;
    let frameIdx = 0;
    let isSpinnerActive = true;
    let currentStatus = "Working";
    let stepStartTime = Date.now();
    let activeToolSummary = "";
    let activeToolId = "";

    function clearSpinner() {
      if (isSpinnerActive && isRealTTY) {
        try {
          cursorTo(process.stdout, 0);
          clearLine(process.stdout, 0);
          process.stdout.write("\x1b[?25h");
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
      } else {
        if (status === "Working") {
          console.log(`\x1b[33mWorking...\x1b[0m`);
        } else if (status === "tool") {
          console.log(`\x1b[33m⠋ ${label}\x1b[0m`);
        }
      }
    }

    if (isRealTTY) {
      process.stdout.write("\x1b[?25l");
    } else {
      console.log(`\x1b[33mWorking...\x1b[0m`);
    }

    const spinInterval = setInterval(() => {
      if (isSpinnerActive && isRealTTY) {
        const frame = spinnerFrames[frameIdx];
        const elapsedSec = Math.floor((Date.now() - stepStartTime) / 1000);
        let displayText = "";

        if (currentStatus === "Working") {
          const dots = dotFrames[Math.floor(frameIdx / 3) % dotFrames.length];
          displayText = `\x1b[33mWorking${dots}\x1b[0m`;
        } else if (currentStatus === "tool") {
          displayText = `\x1b[1;33m${activeToolSummary}\x1b[0m`;
        } else {
          displayText = `\x1b[33m${currentStatus}\x1b[0m`;
        }

        const lineOutput = `\x1b[36m${frame}\x1b[0m ${displayText} \x1b[90m(${elapsedSec}s)\x1b[0m`;
        try {
          cursorTo(process.stdout, 0);
          clearLine(process.stdout, 0);
          process.stdout.write(lineOutput);
        } catch {
          process.stdout.write(`\r\x1b[K${lineOutput}`);
        }
        frameIdx = (frameIdx + 1) % spinnerFrames.length;
      }
    }, 120);
    spinInterval.unref();
    let lineBuffer = "";
    let hasStreamedText = false;
    let totalTokens = 0;
    let outputTokens = 0;
    let toolCount = 0;
    let capturedSessionId = sessionInfo?.sessionId || "";
    const editedFiles = new Set<string>();
    const mdFormatter = new MarkdownStreamFormatter();
    function formatTokenCount(num: number): string {
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + "k";
      }
      return num.toString();
    }
    function renderJsonEvent(data: Record<string, unknown>) {
      const eventType = data?.type;

      if (eventType === "session" && data?.id) {
        capturedSessionId = String(data.id);
        if (sessionInfo?.title) {
          recordSessionEntry(cwd, agent.name, sessionInfo.title, capturedSessionId);
        }
      }

      const usage = (data?.usage || (data?.message as Record<string, unknown> | undefined)?.usage) as Record<string, unknown> | undefined;
      if (usage) {
        if (typeof usage.totalTokens === "number") totalTokens = usage.totalTokens;
        if (typeof usage.output === "number") outputTokens = usage.output;
      }
      if (eventType === "tool_execution_start" || eventType === "tool_start") {
        clearSpinner();
        hasStreamedText = false;
        const toolName = String(data.toolName || data.name || data.tool || "tool");
        const toolId = String(data.toolCallId || data.id || `${toolName}_${Date.now()}`);
        if (activeToolId === toolId) return;
        activeToolId = toolId;
        const toolArgs = (data.args || data.arguments || {}) as Record<string, unknown>;
        if (toolName === "write" || toolName === "edit" || toolName === "ast_edit") {
          const filePath = toolArgs.path || toolArgs.filePath;
          if (filePath) editedFiles.add(String(filePath));
        }
        const toolLabel = formatOpenCodeToolLabel(toolName, toolArgs);

        startSpinner("tool", toolLabel);
      } else if (eventType === "tool_execution_end" || eventType === "tool_end") {
        clearSpinner();
        toolCount++;
        const toolName = String(data.toolName || data.name || data.tool || "tool");
        const isErr = Boolean(data.isError || data.error);
        const icon = isErr ? "\x1b[31m󰅚\x1b[0m" : "\x1b[32m󰄬\x1b[0m";
        const durSec = ((Date.now() - stepStartTime) / 1000).toFixed(1);
        console.log(`${icon} \x1b[1m${activeToolSummary}\x1b[0m \x1b[32m(${durSec}s)\x1b[0m`);
        activeToolId = "";
        startSpinner("Working");
      } else if (eventType === "message_update") {
        const evt = data.assistantMessageEvent as Record<string, unknown> | undefined;
        if (evt?.type === "thinking_start") {
          clearSpinner();
          process.stdout.write("\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m");
        } else if (evt?.type === "thinking_delta" && evt.delta) {
          clearSpinner();
          process.stdout.write(String(evt.delta));
        } else if (evt?.type === "thinking_end") {
          process.stdout.write("\x1b[0m\n\n");
        } else if (evt?.type === "text_start") {
          clearSpinner();
          process.stdout.write("\x1b[0m");
          hasStreamedText = true;
          process.stdout.write("\n");
        } else if (evt?.type === "text_delta" && evt.delta) {
          clearSpinner();
          hasStreamedText = true;
          const formatted = mdFormatter.processChunk(String(evt.delta));
          if (formatted) process.stdout.write(formatted);
        }
      } else if (eventType === "message_end") {
        const msg = data.message as Record<string, unknown> | undefined;
        if (msg?.role === "assistant" && Array.isArray(msg.content)) {
          for (const item of msg.content as Array<Record<string, unknown>>) {
            if (item.type === "thinking" && item.thinking && !hasStreamedText) {
              clearSpinner();
              console.log(`\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m${String(item.thinking).trim()}\x1b[0m\n`);
            } else if (item.type === "text" && item.text) {
              clearSpinner();
              const flushed = mdFormatter.flush();
              if (flushed) process.stdout.write(flushed);
              process.stdout.write("\n");
            }
          }
        }
        hasStreamedText = true;
      } else if (eventType === "content_delta" && (data.delta as Record<string, unknown> | undefined)?.text) {
        clearSpinner();
        hasStreamedText = true;
        const formatted = mdFormatter.processChunk(String((data.delta as Record<string, unknown>).text));
        if (formatted) process.stdout.write(formatted);
      } else if (eventType === "thought" || data.thought) {
        clearSpinner();
        const thoughtTxt = String(data.thought || data.text || "");
        if (thoughtTxt.trim()) {
          console.log(`\x1b[35m󰘦 Thinking\x1b[0m\n\x1b[3;90m${thoughtTxt.trim()}\x1b[0m\n`);
        }
        startSpinner("Working");
      }
    }
    proc.stdout?.on("data", (chunk) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() || "";

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          renderJsonEvent(data);
        } catch {
          if (!line.trim().startsWith("{") && !line.trim().startsWith("[")) {
            clearSpinner();
            process.stdout.write(line + "\n");
          }
        }
      }
    });

    proc.stderr?.on("data", (data) => {
      clearSpinner();
      process.stderr.write(data);
    });

    proc.on("close", (code) => {
      clearSpinner();
      clearInterval(spinInterval);
      if (isRealTTY) process.stdout.write("\x1b[?25h");

      if (lineBuffer.trim()) {
        try {
          const data = JSON.parse(lineBuffer);
          renderJsonEvent(data);
        } catch {
          process.stdout.write(lineBuffer + "\n");
        }
      }

      const flushed = mdFormatter.flush();
      if (flushed) {
        process.stdout.write(flushed);
      }
      const totalDurSec = Math.max(0.1, Number(((Date.now() - subagentStartTime) / 1000).toFixed(1)));
      const tokPerSec = outputTokens > 0 ? (outputTokens / totalDurSec).toFixed(1) : "0.0";

      let sessionStr = "";
      if (sessionInfo?.title) {
        const idPrefix = capturedSessionId ? ` (${capturedSessionId.slice(0, 8)})` : "";
        sessionStr = ` \x1b[90m󰇙\x1b[0m \x1b[33m󰈩 ${sessionInfo.title}${idPrefix}\x1b[0m`;
      }
      const statsStr = totalTokens > 0
        ? ` \x1b[90m󰇙\x1b[0m 󰍛 ${formatTokenCount(totalTokens)} tokens \x1b[90m󰇙\x1b[0m ⚡ ${tokPerSec} tok/s`
        : "";
      const toolsStr = toolCount > 0 ? ` \x1b[90m󰇙\x1b[0m 󰆧 ${toolCount} tool${toolCount === 1 ? "" : "s"}` : "";

      if (showDiff) {
        const diffText = renderGitDiff(cwd, Array.from(editedFiles));
        if (diffText) {
          console.log("\n" + diffText + "\n");
        }
      }
      if (code === 0) {
        console.log(`\x1b[90m└─\x1b[0m \x1b[32m󰄬 ${agent.name} completed\x1b[0m \x1b[90m(${totalDurSec}s)\x1b[0m${sessionStr}${statsStr}${toolsStr} \x1b[90m${"─".repeat(20)}\x1b[0m\n`);
        process.exit(0);
      } else if (fallbackModelParam && fallbackModelParam !== modelParam) {
        console.log(`\x1b[33m󰁯 [FALLBACK]\x1b[0m Primary model \x1b[1m${modelParam || "default"}\x1b[0m failed. Retrying with fallback \x1b[1;36m${fallbackModelParam}\x1b[0m...\n`);
        // Fire-and-forget the retry; the inner proc.on("close") will call process.exit.
        // Wrap in async IIFE so the inner promise is actually observable (avoids dangling promise).
        (async () => {
          await executeOmp(
            agent,
            prompt,
            fallbackModelParam,
            variantParam,
            overrideTools,
            cwd,
            isStream,
            showDiff,
            null,
            sessionInfo,
            passthroughFlags
          );
        })();
        return;
      } else {
        console.log(`\x1b[90m└─\x1b[0m \x1b[31m󰅚 ${agent.name} failed (${code})\x1b[0m \x1b[90m(${totalDurSec}s)${statsStr}${toolsStr} ${"─".repeat(20)}\x1b[0m\n`);
        process.exit(code ?? 1);
      }
    });
    return;
  }

  let frameIdx = 0;
  let dotIdx = 0;

  process.stdout.write("\x1b[?25l");

  const spinInterval = setInterval(() => {
    const frame = SPINNER_FRAMES[frameIdx];
    const dots = DOT_FRAMES[dotIdx];
    process.stdout.write(`\r\x1b[K\x1b[36m${frame}\x1b[0m Working\x1b[33m${dots}\x1b[0m`);
    frameIdx = (frameIdx + 1) % SPINNER_FRAMES.length;
    if (frameIdx === 0) {
      dotIdx = (dotIdx + 1) % DOT_FRAMES.length;
    }
  }, 80);
  spinInterval.unref();

  const proc = spawn("omp", ompArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd,
    env: process.env
  });
  let outputBuffer = "";
  let errorBuffer = "";
  proc.stdout?.on("data", (data) => {
    outputBuffer += data.toString();
  });

  proc.stderr?.on("data", (data) => {
    errorBuffer += data.toString();
  });

  proc.on("close", (code) => {
    clearInterval(spinInterval);
    process.stdout.write("\r\x1b[K");
    process.stdout.write("\x1b[?25h");

    if (code === 0) {
      console.log(`\x1b[32m󰄬\x1b[0m Subagent \x1b[1m${agent.name}\x1b[0m completed!`);
      if (outputBuffer.trim()) {
        console.log(`\n\x1b[32m[OUTPUT]\x1b[0m\n${outputBuffer.trim()}\n`);
      }
      process.exit(0);
    } else {
      console.log(`\x1b[31m󰅚\x1b[0m Subagent \x1b[1m${agent.name}\x1b[0m failed with code ${code}.`);
      if (errorBuffer.trim()) {
        console.error(`\n\x1b[31m[ERROR LOGS]\x1b[0m\n${errorBuffer.trim()}\n`);
      }
      process.exit(code ?? 1);
    }
  });
}
