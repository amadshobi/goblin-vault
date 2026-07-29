#!/usr/bin/env bun
// ─────────────────────────────────────────────────────────────
// Goblin Nexus — gn price (Custom Pricing Engine CLI)
//   gn price                  (default: list)
//   gn price list             (tampilkan tabel harga per 1M)
//   gn price set <provider> <model> --input <rate> --output <rate> [--cache <rate>]
//   gn price calc <provider> <model> --prompt N --completion N [--cache N]
//   gn price --help
// ─────────────────────────────────────────────────────────────

import { argv, exit, stderr, stdout } from "node:process";
import { existsSync } from "node:fs";

import { loadPrices, savePrices, setPrice, calculateCost, PRICES_PATH } from "./telemetry/pricing.ts";

// ─── ANSI ─────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function paint(s: string, color: keyof typeof C): string {
  if (!stdout.isTTY) return s;
  return `${C[color]}${s}${C.reset}`;
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
  const raw = s.replace(/\x1b\[[0-9;]*m/g, "");
  const len = [...raw].length;
  if (len >= width) return s;
  const fill = " ".repeat(width - len);
  return align === "right" ? fill + s : s + fill;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.0000";
  return `$${n.toFixed(Math.abs(n) >= 100 ? 2 : 4)}`;
}

// ─── Help ─────────────────────────────────────────────────────

function printHelp(): void {
  stdout.write(`💰 GN PRICE — Custom Pricing Engine

DESKRIPSI
  Mengelola tarif kustom per 1M token (USD) untuk seluruh provider/model
  yang dipakai Goblin Nexus. Tarif disimpan di:
    ${PRICES_PATH}

  Rumus biaya TRANSPARAN (per 1M token):
    total = (prompt / 1M) * inputRate
          + (completion / 1M) * outputRate
          + (cache / 1M) * cacheRate

USAGE
  $ gn price                       Tampilkan tabel harga (default: list)
  $ gn price list                  Sama seperti default
  $ gn price set <prov> <model> --input <rate> --output <rate> [--cache <rate>]
  $ gn price calc <prov> <model> --prompt N --completion N [--cache N]
  $ gn price --help

COMMANDS
  list            Tampilkan semua tarif aktif dalam tabel rapi
  set             Set/update tarif untuk satu (provider, model) pair
  calc            Hitung biaya dari jumlah token aktual (untuk sanity-check)

OPTIONS (set)
  --input <rate>     USD per 1M input/prompt tokens   (required)
  --output <rate>    USD per 1M output/completion tokens (required)
  --cache <rate>     USD per 1M cache tokens (optional, default 0)

OPTIONS (calc)
  --prompt <N>       Jumlah prompt tokens (required)
  --completion <N>   Jumlah completion tokens (required)
  --cache <N>        Jumlah cache tokens (optional, default 0)

EXAMPLES
  $ gn price
  $ gn price set google-antigravity gemini-2.5-flash --input 0.075 --output 0.30 --cache 0.02
  $ gn price set anthropic claude-sonnet-4 --input 3.00 --output 15.00
  $ gn price calc anthropic claude-sonnet-4 --prompt 100000 --completion 20000
  $ gn price list --json
`);
}

// ─── Parsing ──────────────────────────────────────────────────

function parseRate(s: string | undefined): number {
  if (s == null) return NaN;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

function parseInt0(s: string | undefined): number {
  if (s == null) return NaN;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

// ─── Subcommands ──────────────────────────────────────────────

function cmdList(jsonMode: boolean): void {
  const prices = loadPrices();
  if (jsonMode) {
    stdout.write(JSON.stringify(prices, null, 2) + "\n");
    return;
  }

  stdout.write(`${paint("💰 PRICING ENGINE", "bold")}  ${paint(`(path: ${PRICES_PATH})`, "dim")}\n`);
  if (!existsSync(PRICES_PATH)) {
    stdout.write(`${paint("ℹ️  prices.json belum ada — sudah dibuat dengan default.", "dim")}\n`);
  } else {
    stdout.write(`${paint("ℹ️  Updated:", "dim")} ${prices.updatedAt}\n`);
  }
  stdout.write("\n");

  const widths = [24, 32, 12, 13, 12];
  const headers = ["PROVIDER", "MODEL", "INPUT/M", "OUTPUT/M", "CACHE/M"];
  const headerLine = headers.map((h, i) => paint(pad(h, widths[i]), "bold")).join("  ");
  const sepLine = widths.map((w) => "─".repeat(w)).join("  ");
  stdout.write(headerLine + "\n");
  stdout.write(paint(sepLine, "gray") + "\n");

  const providers = Object.keys(prices.rates ?? {}).sort();
  let rowCount = 0;
  for (const prov of providers) {
    const models = Object.keys(prices.rates[prov] ?? {}).sort();
    for (const model of models) {
      const rate = prices.rates[prov][model];
      const cacheDisplay = rate.cache != null ? fmtUsd(rate.cache) : paint("—", "dim");
      stdout.write(
        [
          pad(prov.slice(0, widths[0]), widths[0]),
          pad(model.slice(0, widths[1]), widths[1]),
          pad(fmtUsd(rate.input), widths[2], "right"),
          pad(fmtUsd(rate.output), widths[3], "right"),
          pad(cacheDisplay, widths[4], "right"),
        ].join("  ") + "\n",
      );
      rowCount++;
    }
  }

  stdout.write("\n");
  stdout.write(`${paint("ℹ️  Total:", "dim")} ${rowCount} rate entr${rowCount === 1 ? "y" : "ies"} across ${providers.length} provider${providers.length === 1 ? "" : "s"}\n`);
  stdout.write(`${paint("ℹ️  Use:", "dim")} \`gn price set <provider> <model> --input X --output Y [--cache Z]\` to add/update\n`);
}

function cmdSet(args: string[]): void {
  // args[0]=provider, args[1]=model, then --input, --output, [--cache]
  const provider = args[0];
  const model = args[1];
  if (!provider || !model) {
    stderr.write(`🔥 [Goblin Roast] \`gn price set\` butuh <provider> <model>.\n`);
    stderr.write(`💡 Contoh: gn price set anthropic claude-sonnet-4 --input 3.00 --output 15.00\n`);
    exit(1);
  }

  let inputRate = NaN;
  let outputRate = NaN;
  let cacheRate = 0;
  for (let i = 2; i < args.length; i++) {
    const a = args[i];
    if (a === "--input" && args[i + 1]) {
      inputRate = parseRate(args[++i]);
    } else if (a.startsWith("--input=")) {
      inputRate = parseRate(a.slice("--input=".length));
    } else if (a === "--output" && args[i + 1]) {
      outputRate = parseRate(args[++i]);
    } else if (a.startsWith("--output=")) {
      outputRate = parseRate(a.slice("--output=".length));
    } else if (a === "--cache" && args[i + 1]) {
      cacheRate = parseRate(args[++i]);
    } else if (a.startsWith("--cache=")) {
      cacheRate = parseRate(a.slice("--cache=".length));
    }
  }

  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) {
    stderr.write(`🔥 [Goblin Roast] --input dan --output wajib diisi dengan angka ≥ 0.\n`);
    exit(1);
  }

  const current = loadPrices();
  const next = setPrice(current, provider, model, { input: inputRate, output: outputRate, cache: cacheRate });
  savePrices(next);

  stdout.write(`${paint("✅ Price set:", "green")} ${paint(provider, "bold")}/${paint(model, "bold")}\n`);
  stdout.write(`   input:  ${paint(fmtUsd(inputRate), "cyan")} per 1M tokens\n`);
  stdout.write(`   output: ${paint(fmtUsd(outputRate), "cyan")} per 1M tokens\n`);
  stdout.write(`   cache:  ${paint(fmtUsd(cacheRate), "cyan")} per 1M tokens\n`);
  stdout.write(`   ${paint("path:", "dim")} ${PRICES_PATH}\n`);
}

function cmdCalc(args: string[]): void {
  const provider = args[0];
  const model = args[1];
  if (!provider || !model) {
    stderr.write(`🔥 [Goblin Roast] \`gn price calc\` butuh <provider> <model>.\n`);
    exit(1);
  }

  let prompt: number = NaN;
  let completion: number = NaN;
  let cache = 0;
  for (let i = 2; i < args.length; i++) {
    const a = args[i];
    if (a === "--prompt" && args[i + 1]) {
      prompt = parseInt0(args[++i]);
    } else if (a.startsWith("--prompt=")) {
      prompt = parseInt0(a.slice("--prompt=".length));
    } else if (a === "--completion" && args[i + 1]) {
      completion = parseInt0(args[++i]);
    } else if (a.startsWith("--completion=")) {
      completion = parseInt0(a.slice("--completion=".length));
    } else if (a === "--cache" && args[i + 1]) {
      cache = parseInt0(args[++i]);
    } else if (a.startsWith("--cache=")) {
      cache = parseInt0(a.slice("--cache=".length));
    }
  }

  if (!Number.isFinite(prompt) || !Number.isFinite(completion)) {
    stderr.write(`🔥 [Goblin Roast] --prompt dan --completion wajib angka ≥ 0.\n`);
    exit(1);
  }

  const prices = loadPrices();
  const breakdown = calculateCost(provider, model, prompt, completion, cache, prices);
  stdout.write(`${paint("💵 Cost Calculation", "bold")}\n\n`);
  stdout.write(`  ${paint("Provider:", "dim")}  ${provider}\n`);
  stdout.write(`  ${paint("Model:", "dim")}     ${model}\n`);
  stdout.write(`  ${paint("Rate src:", "dim")}  ${breakdown.rateSource}\n\n`);
  stdout.write(`  ${paint("Prompt tokens:", "dim")}     ${breakdown.promptTokens.toLocaleString()}\n`);
  stdout.write(`  ${paint("Completion tokens:", "dim")} ${breakdown.completionTokens.toLocaleString()}\n`);
  stdout.write(`  ${paint("Cache tokens:", "dim")}      ${breakdown.cacheTokens.toLocaleString()}\n\n`);
  stdout.write(`  ${paint("Input cost:", "dim")}        ${fmtUsd(breakdown.inputCost)}\n`);
  stdout.write(`  ${paint("Output cost:", "dim")}       ${fmtUsd(breakdown.outputCost)}\n`);
  stdout.write(`  ${paint("Cache cost:", "dim")}        ${fmtUsd(breakdown.cacheCost)}\n`);
  stdout.write(`  ${paint("─".repeat(30), "gray")}\n`);
  stdout.write(`  ${paint("Total:", "bold")}            ${paint(fmtUsd(breakdown.total), "green")}\n\n`);
  stdout.write(`  ${paint("Formula (per 1M):", "dim")}  (P/1M*in) + (C/1M*out) + (Cache/1M*cache)\n`);
  stdout.write(`  ${paint("Rates:", "dim")}  in=${fmtUsd(breakdown.rate.input)} out=${fmtUsd(breakdown.rate.output)} cache=${fmtUsd(breakdown.rate.cache ?? 0)}\n`);
}

// ─── Main ─────────────────────────────────────────────────────

function main(): void {
  const args = argv.slice(2);

  // Top-level help
  for (const a of args) {
    if (a === "--help" || a === "-h") {
      printHelp();
      exit(0);
    }
  }

  const sub = args[0];

  if (!sub || sub === "list" || sub === "ls") {
    const jsonMode = args.includes("--json") || (sub && args.includes("--json"));
    cmdList(jsonMode);
    return;
  }

  if (sub === "set") {
    cmdSet(args.slice(1));
    return;
  }

  if (sub === "calc") {
    cmdCalc(args.slice(1));
    return;
  }

  stderr.write(`🔥 [Goblin Roast] Subcommand tidak dikenali: '${sub}'\n`);
  stderr.write(`💡 Gunakan \`gn price --help\` untuk bantuan.\n`);
  exit(1);
}

main();
