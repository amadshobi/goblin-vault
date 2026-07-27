#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus Benchmark & Health Ping Engine v2.5.0
// Dynamic Spinner UX, Hybrid Scoring, & Agent Analytics Output.md
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { getRole, calculateHybridScore, type BenchRole } from "./bench-roles";
import { saveBenchRun, resetOutputMd, appendOutputMd, type BenchRecord } from "./bench-storage";

const args = process.argv.slice(2);
const action = args[0] || "ping";

let target = "config";
let forceRefresh = false;
let selectMode = false;
let filterProvider: string | null = null;
let vsModels: string[] | null = null;
let selectedRole: BenchRole = getRole("coder");
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
  } else if (arg.startsWith("--role=")) {
    selectedRole = getRole(arg.split("=")[1]);
  } else if (arg === "--role" && i + 1 < args.length) {
    selectedRole = getRole(args[++i]);
  } else if (arg.startsWith("--vs=")) {
    vsModels = arg.split("=")[1].split(",").map((s) => s.trim());
  } else if (arg === "--vs") {
    if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
      vsModels = args[++i].split(",").map((s) => s.trim());
    } else {
      vsModels = [];
    }
  } else if (!arg.startsWith("-")) {
    target = arg;
  }
}

const CACHE_DIR = `${process.env.HOME}/.cache/goblin-nexus`;
const CACHE_TTL_MS = 5 * 24 * 60 * 60 * 1000;
const PING_TIMEOUT_MS = customTimeoutSec ? customTimeoutSec * 1000 : 10_000; // 10s default ping
const BENCH_TIMEOUT_MS = customTimeoutSec ? customTimeoutSec * 1000 : 60_000; // 60s default bench

interface ModelItem {
  name: string;
  id: string;
  provider: string;
}

interface AvailableModel {
  provider: string;
  id: string;
  name: string;
  latency: number;
  speed?: string;
  quality?: number;
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

  if (targetFilter === "config" || targetFilter === "cfg") {
    const configPath = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf8").replace(/^\s*\/\/.*/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      const json = JSON.parse(raw);
      const modelsObj = json.provider?.["goblin-nexus"]?.models || {};
      allModels = Object.entries(modelsObj).map(([key, val]: [string, any]) => ({
        name: val.name || key,
        id: val.id,
        provider: val.id.split("/")[0] || "goblin-nexus",
      }));
    }
  } else {
    try {
      const res = await fetch("http://127.0.0.1:4000/v1/models");
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        allModels = (data.data || []).map((m) => ({
          name: m.id.split("/").pop() || m.id,
          id: m.id,
          provider: m.id.split("/")[0] || "gateway",
        }));
      }
    } catch (e: any) {
      console.log(`❌ Failed to connect to Gateway proxy (http://127.0.0.1:4000/v1): ${e.message}`);
    }
  }

  // Target Filter Parsing (Supports provider/model, provider name, or partial model name)
  if (targetFilter && targetFilter !== "config" && targetFilter !== "cfg" && targetFilter !== "all") {
    const filterLower = targetFilter.toLowerCase();
    if (filterLower.includes("/")) {
      // Exact full model match: e.g. "google-antigravity/claude-sonnet-4-6"
      allModels = allModels.filter((m) => m.id.toLowerCase() === filterLower || m.id.toLowerCase().includes(filterLower));
    } else {
      // Filter by provider prefix OR model ID match
      allModels = allModels.filter(
        (m) => m.provider.toLowerCase() === filterLower || m.id.toLowerCase().includes(filterLower)
      );
    }
  }

  // Filter by provider if specified via flag --provider
  if (filterProvider) {
    allModels = allModels.filter(
      (m) => m.provider.toLowerCase() === filterProvider!.toLowerCase() || m.id.toLowerCase().includes(filterProvider!.toLowerCase())
    );
  }

  // VS Mode filtering
  if (vsModels !== null) {
    if (vsModels.length > 0) {
      allModels = allModels.filter((m) => vsModels!.some((v) => m.id.toLowerCase().includes(v.toLowerCase())));
    } else {
      const providerMap = new Map<string, ModelItem>();
      for (const m of allModels) {
        if (!providerMap.has(m.provider)) {
          providerMap.set(m.provider, m);
        }
      }
      allModels = Array.from(providerMap.values());
    }
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
    const qualityInfo = item.quality !== undefined ? ` | ⭐ ${Math.round(item.quality * 100)}%` : "";
    console.log(`  ${item.id.padEnd(42)} | ${speedInfo}${qualityInfo}`);
  }
  console.log("─".repeat(70) + "\n");
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
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
      const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m.id,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        }),
      });
      clearTimeout(timeoutId);
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
        console.log(`  💥 [OFFLINE]  ${m.id.padEnd(41)}  ░░░░░░░░░░░░  Gateway Down`);
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

  // Reset output.md for fresh agent evaluation
  resetOutputMd(selectedRole.name, selectedRole.dataset.id);

  console.log(`\n📊 [Goblin Nexus Bench] Target: ${models.length} model(s) | Role: ${selectedRole.emoji} ${selectedRole.name}\n`);
  console.log("  MODEL ID                                   ROLE       LATENCY   TOKENS (TOK/S)   QUALITY");
  console.log("  ─────────────────────────────────────────  ─────────  ────────  ───────────────  ───────");

  const isTTY = process.stdout.isTTY;
  const frames = ["⚡", "🔥", "✨", "🚀"];
  const available: AvailableModel[] = [];
  const recordsToSave: BenchRecord[] = [];

  for (const m of models) {
    let i = 0;
    let timer: NodeJS.Timeout | undefined;
    if (isTTY) {
      timer = setInterval(() => {
        process.stdout.write(`\r  ${frames[i++ % frames.length]} [BENCH] ${m.id.padEnd(38)} ${selectedRole.id.padEnd(9)} inferencing...`);
      }, 120);
    }

    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), BENCH_TIMEOUT_MS);
      const res = await fetch("http://127.0.0.1:4000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer dummy" },
        signal: ctrl.signal,
        body: JSON.stringify({
          model: m.id,
          messages: [
            { role: "system", content: selectedRole.systemPrompt },
            { role: "user", content: selectedRole.dataset.prompt },
          ],
          max_tokens: 250,
        }),
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }

      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data.choices?.[0]?.message?.content || "";
        const promptTok = data.usage?.prompt_tokens || 30;
        const compTok = data.usage?.completion_tokens || Math.round(text.length / 4);
        const totalTok = promptTok + compTok;
        const tokPerSec = compTok > 0 ? parseFloat(((compTok / elapsed) * 1000).toFixed(1)) : 0;
        
        // Compute Hybrid Score (Deterministic + Keyword Rubric)
        const quality = calculateHybridScore(text, selectedRole.dataset);

        // Append output to output.md for agent analytics
        appendOutputMd(m.id, selectedRole.dataset.prompt, text, quality);

        const tokStr = `${totalTok} tok (${tokPerSec} t/s)`;
        const qualityStr = `⭐ ${Math.round(quality * 100)}%`;

        console.log(
          `  ${m.id.padEnd(41)}  ${selectedRole.id.padEnd(9)}  ${String(elapsed).padStart(5)}ms  ${tokStr.padEnd(15)}  ${qualityStr}`
        );

        available.push({
          provider: m.provider,
          id: m.id,
          name: m.name,
          latency: elapsed,
          speed: String(tokPerSec),
          quality,
        });

        recordsToSave.push({
          model: m.id,
          role: selectedRole.id,
          latencyMs: elapsed,
          tokens: { prompt: promptTok, completion: compTok, total: totalTok, tokPerSec },
          qualityScore: quality,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`  ${m.id.padEnd(41)}  ${selectedRole.id.padEnd(9)}  ❌ FAIL ${res.status}  ░░░░░░░░░░░░░░   0%`);
      }
    } catch (e: any) {
      if (isTTY && timer) { clearInterval(timer); process.stdout.write("\r\x1b[K"); }
      console.log(`  ${m.id.padEnd(41)}  ${selectedRole.id.padEnd(9)}  ⏱️ TIMEOUT ${BENCH_TIMEOUT_MS / 1000}s ░░░░░░░░░░░░░░   0%`);
    }
  }

  console.log("");
  printSummaryLineup(available);
  if (recordsToSave.length > 0) saveBenchRun(recordsToSave);
  saveCache(act, tgt, available);
  writeSelectFile(available);
}

async function main() {
  const models = await getModels(target);
  if (models.length === 0) {
    console.log(`🔥 [Goblin Roast] Kagak ada model yang cocok untuk target '${target}', BOSS!`);
    console.log(`💡 Hint: Pastikan gateway port 4000 aktif ('gn restart') atau provider ID benar.`);
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
