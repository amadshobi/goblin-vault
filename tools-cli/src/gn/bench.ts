#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus Benchmark & Health Ping Engine
// Modular script — supports --select for model picker integration
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const action = args[0] || "ping";
let target = "config";
let forceRefresh = false;
let selectMode = false;

for (let i = 1; i < args.length; i++) {
  if (args[i] === "--force" || args[i] === "-f") {
    forceRefresh = true;
  } else if (args[i] === "--select" || args[i] === "-s") {
    selectMode = true;
  } else if (!args[i].startsWith("-")) {
    target = args[i];
  }
}

const CACHE_DIR = `${process.env.HOME}/.cache/goblin-nexus`;
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 hari
const REQUEST_TIMEOUT_MS = 10_000; // 10s — pasukan yang lebih dari ini dianggap gugur

interface CacheData {
  timestamp: number;
  results: {
    logLines: string[];
    available: AvailableModel[];
  };
}

function getCacheFilePath(act: string, tgt: string): string {
  const cleanTgt = tgt.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `gn-${act}-${cleanTgt}.json`);
}

function loadCache(act: string, tgt: string): CacheData | null {
  if (forceRefresh) return null;
  const cacheFile = getCacheFilePath(act, tgt);
  if (!fs.existsSync(cacheFile)) return null;
  try {
    const raw = fs.readFileSync(cacheFile, "utf8");
    const data: CacheData = JSON.parse(raw);
    const age = Date.now() - data.timestamp;
    if (age < CACHE_TTL_MS) return data;
  } catch (_) { /* ignore */ }
  return null;
}

function saveCache(act: string, tgt: string, logLines: string[], available: AvailableModel[]) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = getCacheFilePath(act, tgt);
  const payload: CacheData = {
    timestamp: Date.now(),
    results: { logLines, available },
  };
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2));
}

interface ModelItem {
  name: string;
  id: string;
}

interface AvailableModel {
  provider: string;
  id: string;
  name: string;
  latency: number;
  speed?: string;
}

async function getModels(targetFilter: string): Promise<ModelItem[]> {
  if (targetFilter === "config" || targetFilter === "cfg") {
    const configPath = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
    if (!fs.existsSync(configPath)) {
      console.log(`❌ Config file not found: ${configPath}`);
      return [];
    }
    const raw = fs
      .readFileSync(configPath, "utf8")
      .replace(/^\s*\/\/.*/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const json = JSON.parse(raw);
    const modelsObj = json.provider?.["goblin-nexus"]?.models || {};
    return Object.entries(modelsObj).map(([key, val]: [string, any]) => ({
      name: val.name || key,
      id: val.id,
    }));
  }

  try {
    const res = await fetch("http://127.0.0.1:4000/v1/models");
    if (!res.ok) throw new Error(`Gateway returned HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    let allModels = (data.data || []).map((m) => m.id);
    if (targetFilter !== "all") {
      allModels = allModels.filter((id) =>
        id.toLowerCase().includes(targetFilter.toLowerCase())
      );
    }
    return allModels.map((id) => ({ name: id.split("/").pop() || id, id }));
  } catch (e: any) {
    console.log(`❌ Gagal mengontak Gateway proxy (http://127.0.0.1:4000/v1): ${e.message}`);
    return [];
  }
}

function printSummaryLineup(available: AvailableModel[]) {
  if (available.length === 0) {
    console.log("⚠️  Tidak ada model yang 100% OK / Siap Pakai.");
    return;
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🎯 [LINEUP MODEL SIAP PAKAI] (${available.length} Model Ready)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  PROVIDER             | FULL MODEL ID                                   | SPEED / LATENCY");
  console.log("  ─────────────────────┼─────────────────────────────────────────────────┼──────────────────");
  for (const item of available) {
    const provider = item.id.split("/")[0] || "unknown";
    const speedInfo = item.speed ? `${item.speed} tok/s` : `⚡ ${item.latency}ms`;
    console.log(`  ${provider.padEnd(20)} | ${item.id.padEnd(47)} | ${speedInfo}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

function writeSelectFile(available: AvailableModel[]) {
  if (!selectMode) return;
  const tmpDir = process.env.TMPDIR || "/tmp";
  const filePath = path.join(tmpDir, "gn-last-available.json");
  fs.writeFileSync(filePath, JSON.stringify(available, null, 2));
}

async function runPing(models: ModelItem[], act: string, tgt: string) {
  const cached = loadCache(act, tgt);
  if (cached) {
    const ageDays = ((Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24)).toFixed(1);
    console.log(`\n⚡ [Goblin Nexus Ping] CACHED (${ageDays}d lalu) — gunakan --force untuk re-test\n`);
    printSummaryLineup(cached.results.available);
    writeSelectFile(cached.results.available);
    return;
  }

  console.log(`\n⚡ [Goblin Nexus Ping] Testing ${models.length} models...\n`);
  console.log("  STATUS        | MODEL NAME                   | PROXY MODEL ID                             | LATENCY");
  console.log("  ──────────────┼──────────────────────────────┼────────────────────────────────────────────┼──────────");

  const isTTY = process.stdout.isTTY;
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const available: AvailableModel[] = [];
  const logLines: string[] = [];
  logLines.push("  STATUS        | MODEL NAME                   | PROXY MODEL ID                             | LATENCY");
  logLines.push("  ──────────────┼──────────────────────────────┼────────────────────────────────────────────┼──────────");

  for (const m of models) {
    let i = 0;
    let timer: NodeJS.Timeout | undefined;
    if (isTTY) {
      timer = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]} [PINGING] ${m.name} (${m.id})...`);
      }, 80);
    }

    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m.id,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
          reasoning_effort: m.id.includes("pro") ? "low" : undefined,
        }),
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }

      let line = "";
      if (res.ok) {
        line = `  ✅ [200 OK]      ${m.name.padEnd(28)} | ${m.id.padEnd(42)} | ⚡ ${elapsed}ms`;
        available.push({ provider: m.id.split("/")[0], id: m.id, name: m.name, latency: elapsed });
      } else if (res.status === 410) {
        line = `  ❌ [410 GONE]    ${m.name.padEnd(28)} | ${m.id.padEnd(42)} | 💀 Retired Upstream`;
      } else if (res.status === 403) {
        line = `  🔒 [403 PRO]     ${m.name.padEnd(28)} | ${m.id.padEnd(42)} | 💳 Requires Sub`;
      } else if (res.status === 429) {
        line = `  ⚠️  [429 RATELIMIT] ${m.name.padEnd(24)} | ${m.id.padEnd(42)} | ⏳ Quota Depleted`;
      } else {
        line = `  💥 [${res.status} FAIL]    ${m.name.padEnd(25)} | ${m.id.padEnd(42)} | 🛑 Error HTTP ${res.status}`;
      }
      console.log(line);
      logLines.push(line);
    } catch (e: any) {
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }
      const elapsed = Date.now() - start;
      const isTimeout = e.name === "AbortError" || e.name === "TimeoutError";
      const line = isTimeout
        ? `  ⏱️  [TIMEOUT]     ${m.name.padEnd(27)} | ${m.id.padEnd(42)} | 🐢 >${REQUEST_TIMEOUT_MS / 1000}s (gugur)`
        : `  💥 [OFFLINE]     ${m.name.padEnd(27)} | ${m.id.padEnd(42)} | 🔌 Gateway Down`;
      console.log(line);
      logLines.push(line);
    }
  }
  console.log("");
  printSummaryLineup(available);
  saveCache(act, tgt, logLines.slice(2), available);
  writeSelectFile(available);
}

async function runBench(models: ModelItem[], act: string, tgt: string) {
  const cached = loadCache(act, tgt);
  if (cached) {
    const ageDays = ((Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24)).toFixed(1);
    console.log(`\n📊 [Goblin Nexus Bench] CACHED (${ageDays}d lalu) — gunakan --force untuk re-bench\n`);
    printSummaryLineup(cached.results.available);
    writeSelectFile(cached.results.available);
    return;
  }

  console.log(`\n📊 [Goblin Nexus Bench] Benchmarking ${models.length} models...\n`);
  console.log("  STATUS        | MODEL NAME                   | LATENCY  | SPEED       | TOKENS");
  console.log("  ──────────────┼──────────────────────────────┼──────────┼─────────────┼────────");

  const isTTY = process.stdout.isTTY;
  const frames = ["🐒", "🙈", "🙉", "🙊"];
  const available: AvailableModel[] = [];
  const logLines: string[] = [];
  logLines.push("  STATUS        | MODEL NAME                   | LATENCY  | SPEED       | TOKENS");
  logLines.push("  ──────────────┼──────────────────────────────┼──────────┼─────────────┼────────");

  for (const m of models) {
    let i = 0;
    let timer: NodeJS.Timeout | undefined;
    if (isTTY) {
      timer = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]} [BENCHMARKING] ${m.name} (${m.id})...`);
      }, 120);
    }
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m.id,
          messages: [{ role: "user", content: "Write a 2-sentence summary of Quantum Computing." }],
          max_tokens: 60,
          reasoning_effort: m.id.includes("pro") ? "low" : undefined,
        }),
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }

      let line = "";
      if (res.ok) {
        const data = (await res.json()) as any;
        const completionTokens = data.usage?.completion_tokens || 0;
        const tokPerSec = completionTokens > 0 ? ((completionTokens / elapsed) * 1000).toFixed(1) : "N/A";
        line = `  ✅ [200 OK]      ${m.name.padEnd(28)} | ⏱️  ${String(elapsed).padStart(5)}ms | 🚀 ${String(tokPerSec).padStart(5)} tok/s | 📝 ${completionTokens} tokens`;
        available.push({ provider: m.id.split("/")[0], id: m.id, name: m.name, latency: elapsed, speed: tokPerSec });
      } else if (res.status === 410) {
        line = `  ❌ [410 GONE]    ${m.name.padEnd(28)} | 💀 Retired Upstream`;
      } else if (res.status === 403) {
        line = `  🔒 [403 PRO]     ${m.name.padEnd(28)} | 💳 Requires Subscription`;
      } else {
        line = `  💥 [${res.status} FAIL]    ${m.name.padEnd(25)} | 🛑 Error HTTP ${res.status}`;
      }
      console.log(line);
      logLines.push(line);
    } catch (e: any) {
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }
      const elapsed = Date.now() - start;
      const isTimeout = e.name === "AbortError" || e.name === "TimeoutError";
      const line = isTimeout
        ? `  ⏱️  [TIMEOUT]     ${m.name.padEnd(27)} | 🐢 >${REQUEST_TIMEOUT_MS / 1000}s (gugur)`
        : `  💥 [OFFLINE]     ${m.name.padEnd(27)} | 🔌 Proxy Unavailable`;
      console.log(line);
      logLines.push(line);
    }
  }
  console.log("");
  printSummaryLineup(available);
  saveCache(act, tgt, logLines.slice(2), available);
  writeSelectFile(available);
}

async function main() {
  const models = await getModels(target);
  if (models.length === 0) {
    console.log(`⚠️  Tidak ada model ditemukan untuk target '${target}'.`);
    // Still write empty list so picker knows there's nothing
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
