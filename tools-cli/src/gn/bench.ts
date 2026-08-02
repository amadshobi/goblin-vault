#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus Benchmark & Health Ping Engine v3.0
// Simple & honest: TTFT, tok/s, latency — no role specialization
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const action = args[0] || "ping";

let target = "config";
let forceRefresh = false;
let selectMode = false;
let filterProvider: string | null = null;
let customTimeoutSec: number | null = null;

for (let i = 1; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--force" || arg === "-f") {
    forceRefresh = true;
  } else if (arg === "--select" || arg === "-s") {
    selectMode = true;
  } else if (arg.startsWith("--timeout=")) {
    customTimeoutSec = parseInt(arg.split("=")[1], 10);
  } else if (arg === "--timeout" && i + 1 < args.length) {
    customTimeoutSec = parseInt(args[++i], 10);
  } else if (arg.startsWith("--provider=")) {
    filterProvider = arg.split("=")[1];
  } else if (arg === "--provider" && i + 1 < args.length) {
    filterProvider = args[++i];
  } else if (!arg.startsWith("-")) {
    target = arg;
  }
}

const CACHE_DIR = `${process.env.HOME}/.cache/goblin-nexus`;
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000;
const PING_TIMEOUT_MS = customTimeoutSec ? customTimeoutSec * 1000 : 10_000;
const BENCH_TIMEOUT_MS = customTimeoutSec ? customTimeoutSec * 1000 : 60_000;
const DEFAULT_GATEWAY_BASE_URL = "http://127.0.0.1:4000/v1";
const BENCH_PROMPT = "Write a concise explanation of what a closure is in JavaScript, with a short code example.";

interface ModelItem {
  name: string;
  id: string;
  provider: string;
  rawId?: string;
  customEndpoint?: string;
  customApiKey?: string;
  apiType?: string;
}

interface AvailableModel {
  provider: string;
  id: string;
  name: string;
  latency: number;
  speed?: string;
}

function normalizeGatewayBaseUrl(rawUrl: string | undefined | null): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return DEFAULT_GATEWAY_BASE_URL;
  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch (_) {
    console.log(`⚠️  GN_GATEWAY_BASE_URL invalid: ${trimmed}. Fallback ke ${DEFAULT_GATEWAY_BASE_URL}`);
    return DEFAULT_GATEWAY_BASE_URL;
  }
}

function readGatewayBaseUrlFromConfig(): string | null {
  const configPath = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const json = JSON.parse(raw);
    return json.provider?.["goblin-nexus"]?.options?.baseURL || null;
  } catch (e: any) {
    console.log(`⚠️  Gagal membaca baseURL dari opencode.jsonc: ${e.message}`);
    return null;
  }
}

function resolveGatewayBaseUrl(): string {
  return normalizeGatewayBaseUrl(process.env.GN_GATEWAY_BASE_URL || readGatewayBaseUrlFromConfig());
}

const GATEWAY_BASE_URL = resolveGatewayBaseUrl();

function gatewayUrl(pathname: string): string {
  return `${GATEWAY_BASE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function loadCache(act: string, tgt: string): any | null {
  if (forceRefresh) return null;
  const cacheFile = path.join(CACHE_DIR, `gn-${act}-${tgt.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  if (!fs.existsSync(cacheFile)) return null;
  try {
    const raw = fs.readFileSync(cacheFile, "utf8");
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp < CACHE_TTL_MS) return data;
  } catch (_) {}
  return null;
}

function saveCache(act: string, tgt: string, available: AvailableModel[]) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `gn-${act}-${tgt.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify({ timestamp: Date.now(), results: { available } }, null, 2));
}

async function getModels(targetFilter: string): Promise<ModelItem[]> {
  let allModels: ModelItem[] = [];

  const configPath = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8").replace(/^\s*\/\/.*/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const json = JSON.parse(raw);
      const providersObj = json.provider || {};
      for (const [pKey, pVal] of Object.entries(providersObj) as [string, any][]) {
        if (pKey === "goblin-nexus") {
          const modelsObj = pVal?.models || {};
          for (const [key, val] of Object.entries(modelsObj) as [string, any][]) {
            const fullId = val.id || key;
            const provName = fullId.includes("/") ? fullId.split("/")[0] : "goblin-nexus";
            allModels.push({
              name: val.name || key,
              id: fullId,
              provider: provName,
            });
          }
        } else if (pVal && typeof pVal === "object" && pVal.models) {
          const baseURL = pVal.options?.baseURL;
          const apiKey = pVal.options?.apiKey;
          for (const [mKey, mVal] of Object.entries(pVal.models) as [string, any][]) {
            const realId = mVal.id || mKey;
            const fullId = `${pKey}/${realId}`;
            allModels.push({
              name: mVal.name || realId,
              id: fullId,
              rawId: realId,
              provider: pKey,
              customEndpoint: baseURL,
              customApiKey: apiKey,
              apiType: "openai-completions",
            });
          }
        }
      }
    } catch (_) {}
  }

  const modelsYmlPath = `${process.env.HOME}/.omp/agent/models.yml`;
  if (fs.existsSync(modelsYmlPath)) {
    try {
      const content = fs.readFileSync(modelsYmlPath, "utf8");
      const providerBlocks = content.matchAll(/([a-zA-Z0-9_-]+):\s*\n\s+name:\s*"([^"]+)"[\s\S]*?baseUrl:\s*"([^"]+)"[\s\S]*?apiKey:\s*"([^"]+)"[\s\S]*?api:\s*"([^"]+)"[\s\S]*?models:\s*\n([\s\S]*?)(?=\n\S|\n$)/g);
      for (const match of providerBlocks) {
        const pKey = match[1];
        const baseUrl = match[3];
        const apiKey = match[4];
        const apiType = match[5];
        const modelsSection = match[6];
        const modelMatches = modelsSection.matchAll(/-\s+id:\s*"([^"]+)"/g);
        for (const mMatch of modelMatches) {
          const realId = mMatch[1];
          const fullId = `${pKey}/${realId}`;
          if (!allModels.some((m) => m.id === fullId)) {
            allModels.push({
              name: realId,
              id: fullId,
              rawId: realId,
              provider: pKey,
              customEndpoint: baseUrl,
              customApiKey: apiKey,
              apiType: apiType,
            });
          }
        }
      }
    } catch (_) {}
  }

  if (targetFilter !== "config" && targetFilter !== "cfg") {
    try {
      const res = await fetch(gatewayUrl("/models"));
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        for (const m of data.data || []) {
          if (!allModels.some((item) => item.id === m.id)) {
            allModels.push({
              name: m.id.split("/").pop() || m.id,
              id: m.id,
              provider: m.id.split("/")[0] || "gateway",
            });
          }
        }
      }
    } catch (e: any) {}
  }

  if (targetFilter && targetFilter !== "config" && targetFilter !== "cfg" && targetFilter !== "all") {
    const filterLower = targetFilter.toLowerCase();
    if (filterLower.includes("/")) {
      allModels = allModels.filter((m) => m.id.toLowerCase() === filterLower || m.id.toLowerCase().includes(filterLower));
    } else {
      allModels = allModels.filter(
        (m) => m.provider.toLowerCase() === filterLower || m.id.toLowerCase().includes(filterLower)
      );
    }
  }

  if (filterProvider) {
    allModels = allModels.filter(
      (m) => m.provider.toLowerCase() === filterProvider!.toLowerCase() || m.id.toLowerCase().includes(filterProvider!.toLowerCase())
    );
  }

  return allModels;
}

function miniBar(latencyMs: number, maxMs = 2000): string {
  const width = 12;
  const ratio = Math.min(latencyMs / maxMs, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const barStr = "█".repeat(filled) + "░".repeat(empty);
  if (latencyMs < 500) return `\x1b[32m${barStr}\x1b[0m`;
  if (latencyMs < 1200) return `\x1b[33m${barStr}\x1b[0m`;
  return `\x1b[31m${barStr}\x1b[0m`;
}

function printSummaryLineup(available: AvailableModel[]) {
  if (available.length === 0) {
    console.log("⚠️  Tidak ada model yang 100% OK / Siap Pakai.");
    return;
  }
  console.log("─".repeat(70));
  console.log(`🎯 [LINEUP MODEL SIAP PAKAI] (${available.length} Model Ready)`);
  console.log("─".repeat(70));
  for (const item of available) {
    const speedInfo = item.speed ? `${item.speed} tok/s` : `⚡ ${item.latency}ms`;
    console.log(`  ${item.id.padEnd(42)} | ${speedInfo}`);
  }
  console.log("─".repeat(70) + "\n");
}

function writeSelectFile(available: AvailableModel[]) {
  if (!selectMode) return;
  const tmpDir = process.env.TMPDIR || "/tmp";
  const filePath = path.join(tmpDir, "gn-last-available.json");
  fs.writeFileSync(filePath, JSON.stringify(available, null, 2));
}

async function safeFetch(urlStr: string, options: any) {
  if (urlStr.includes("api.p0.systems")) {
    const https = require("https");
    const url = new URL(urlStr);
    return new Promise<Response>((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: options.method || "POST",
        family: 4,
        headers: options.headers,
      }, (res: any) => {
        let chunks: any[] = [];
        res.on("data", (c: any) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const r = new Response(buf, {
            status: res.statusCode,
            headers: res.headers,
          });
          resolve(r);
        });
      });
      req.on("error", reject);
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          req.destroy(new Error("TimeoutError"));
        });
      }
      if (options.body) req.write(options.body);
      req.end();
    });
  }
  return await fetch(urlStr, options);
}

async function executeModelRequest(m: ModelItem, prompt: string, maxTokens: number, timeoutMs: number) {
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  let url = gatewayUrl("/chat/completions");
  let headers: Record<string, string> = { "Content-Type": "application/json", Authorization: "Bearer dummy" };
  let body: any = {
    model: m.id,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  };

  if (m.customEndpoint && m.customApiKey) {
    const cleanBase = m.customEndpoint.replace(/\/+$/, "");
    if (m.apiType === "openai-responses") {
      url = `${cleanBase}/responses`;
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${m.customApiKey}` };
      body = {
        model: m.rawId || m.id,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        max_output_tokens: maxTokens,
      };
    } else {
      url = cleanBase.endsWith("/v1") ? `${cleanBase}/chat/completions` : `${cleanBase}/v1/chat/completions`;
      headers = { "Content-Type": "application/json", Authorization: `Bearer ${m.customApiKey}` };
      body = {
        model: m.rawId || m.id,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
      };
    }
  }

  try {
    const res = await safeFetch(url, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function runPing(models: ModelItem[], act: string, tgt: string) {
  const cached = loadCache(act, tgt);
  if (cached) {
    console.log(`\n⚡ [Goblin Nexus Ping] CACHED — gunakan --force untuk re-test\n`);
    printSummaryLineup(cached.results.available);
    writeSelectFile(cached.results.available);
    return;
  }

  console.log(`\n⚡ [Goblin Nexus Ping] Testing ${models.length} model(s)...\n`);
  console.log("  STATUS        MODEL ID                                   LATENCY BAR   TIME");
  console.log("  ───────────   ─────────────────────────────────────────  ────────────  ───────");

  const isTTY = process.stdout.isTTY;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const available: AvailableModel[] = [];

  for (const m of models) {
    let i = 0;
    let timer: NodeJS.Timeout | undefined;
    if (isTTY) {
      timer = setInterval(() => {
        process.stdout.write(`\r  ${frames[i++ % frames.length]} [PING]    ${m.id.padEnd(41)}  testing...`);
      }, 80);
    }

    const start = Date.now();
    try {
      const res = await executeModelRequest(m, "ping", 5, PING_TIMEOUT_MS);
      const elapsed = Date.now() - start;
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }

      if (res.ok) {
        console.log(`  ✅ [200 OK]   ${m.id.padEnd(41)}  ${miniBar(elapsed)}  ${elapsed}ms`);
        available.push({ provider: m.provider, id: m.id, name: m.name, latency: elapsed });
      } else if (res.status === 429) {
        console.log(`  ⚠️  [429 LIMIT] ${m.id.padEnd(41)}  ░░░░░░░░░░░░  Quota Depleted`);
      } else {
        console.log(`  💥 [${res.status} FAIL]  ${m.id.padEnd(41)}  ░░░░░░░░░░░░  HTTP ${res.status}`);
      }
    } catch (e: any) {
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }
      const elapsed = Date.now() - start;
      const isTimeout = e.name === "AbortError" || e.name === "TimeoutError";
      if (isTimeout) {
        console.log(`  ⏱️  [TIMEOUT]  ${m.id.padEnd(41)}  ░░░░░░░░░░░░  >${PING_TIMEOUT_MS / 1000}s`);
      } else {
        console.log(`  💥 [OFFLINE]  ${m.id.padEnd(41)}  ░░░░░░░░░░░░  ${e.message || "Gateway Down"}`);
      }
    }
  }
  console.log("");
  printSummaryLineup(available);
  saveCache(act, tgt, available);
  writeSelectFile(available);
}

async function runBench(models: ModelItem[], act: string, tgt: string) {
  const cached = loadCache(act, tgt);
  if (cached) {
    console.log(`\n📊 [Goblin Nexus Bench] CACHED — gunakan --force untuk re-bench\n`);
    printSummaryLineup(cached.results.available);
    writeSelectFile(cached.results.available);
    return;
  }

  console.log(`\n📊 [Goblin Nexus Bench] Target: ${models.length} model(s) — Simple benchmark\n`);
  console.log("  MODEL ID                                   LATENCY    TOKENS (TOK/S)");
  console.log("  ─────────────────────────────────────────  ────────  ───────────────");

  const isTTY = process.stdout.isTTY;
  const frames = ["⚡", "🔥", "✨", "🚀"];
  const available: AvailableModel[] = [];

  for (const m of models) {
    let i = 0;
    let timer: NodeJS.Timeout | undefined;
    if (isTTY) {
      timer = setInterval(() => {
        process.stdout.write(`\r  ${frames[i++ % frames.length]} [BENCH] ${m.id.padEnd(41)}  inferencing...`);
      }, 120);
    }

    const start = Date.now();
    try {
      const res = await executeModelRequest(m, BENCH_PROMPT, 150, BENCH_TIMEOUT_MS);
      const elapsed = Date.now() - start;
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data.choices?.[0]?.message?.content || "";
        const promptTok = data.usage?.prompt_tokens || 30;
        const compTok = data.usage?.completion_tokens || Math.round(text.length / 4);
        const totalTok = promptTok + compTok;
        const tokPerSec = compTok > 0 ? parseFloat(((compTok / elapsed) * 1000).toFixed(1)) : 0;

        const tokStr = `${totalTok} tok (${tokPerSec} t/s)`;

        console.log(
          `  ${m.id.padEnd(41)}  ${String(elapsed).padStart(6)}ms  ${tokStr.padEnd(19)}`
        );

        available.push({
          provider: m.provider,
          id: m.id,
          name: m.name,
          latency: elapsed,
          speed: String(tokPerSec),
        });
      } else {
        console.log(`  ${m.id.padEnd(41)}  ❌ FAIL ${res.status}`);
      }
    } catch (e: any) {
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }
      console.log(`  ${m.id.padEnd(41)}  ⏱️ TIMEOUT ${BENCH_TIMEOUT_MS / 1000}s`);
    }
  }

  console.log("");
  printSummaryLineup(available);
  saveCache(act, tgt, available);
  writeSelectFile(available);
}

async function main() {
  const models = await getModels(target);
  if (models.length === 0) {
    console.log(`🔥 [Goblin Roast] Kagak ada model yang cocok untuk target '${target}', BOSS!`);
    console.log(`💡 Hint: Pastikan gateway aktif di ${GATEWAY_BASE_URL} ('gn restart') atau provider ID benar.`);
    writeSelectFile([]);
    process.exit(1);
  }

  if (action === "bench" || action === "b") {
    await runBench(models, action, target);
  } else {
    await runPing(models, action, target);
  }
}

main();
