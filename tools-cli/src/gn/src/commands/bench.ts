import { stderr } from "node:process";
import {
  printGnHeader,
  formatTable,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_GREEN,
  ANSI_YELLOW,
} from "../utils/formatter";

interface BenchResult {
  run: number;
  latencyMs: number;
  status: number;
}

export async function handleBenchCommand(argv: string[]): Promise<number> {
  const hasJsonFlag = argv.includes("--json");
  
  let runs = 5;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-n" || arg === "--runs") {
      const parsed = parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        runs = parsed;
      }
    } else if (arg.startsWith("-n=")) {
      const parsed = parseInt(arg.slice(3), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        runs = parsed;
      }
    } else if (arg.startsWith("--runs=")) {
      const parsed = parseInt(arg.slice(7), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        runs = parsed;
      }
    }
  }

  const results: BenchResult[] = [];
  const url = "http://127.0.0.1:4000/healthz"; // Gunakan endpoint healthz untuk benchmark latency OMP

  if (!hasJsonFlag) {
    printGnHeader("OMP GATEWAY BENCHMARK");
    console.log(`\nStarting benchmark connectivity to ${url} (${runs} runs)...\n`);
  }

  for (let i = 1; i <= runs; i++) {
    const start = Bun.nanoseconds();
    let status = 0;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(2000), // 2s timeout
      });
      status = response.status;
    } catch (err) {
      status = 500;
    }
    const end = Bun.nanoseconds();
    const duration = Math.round((end - start) / 1000000);
    results.push({ run: i, latencyMs: duration, status });
  }

  // Hitung stats
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1));
  const p95Idx = Math.max(0, Math.floor(latencies.length * 0.95) - 1);
  const p95 = latencies[p95Idx] || 0;

  if (hasJsonFlag) {
    console.log(JSON.stringify({
      runs: results,
      stats: { min, max, avg, p95 },
    }, null, 2));
    return 0;
  }

  const headers = ["Run", "Latency (ms)", "HTTP Status"];
  const rows = results.map((r) => [
    `Run #${r.run}`,
    `${r.latencyMs} ms`,
    r.status === 200 ? "󰄬 200 OK" : `󰅚 ${r.status}`,
  ]);

  console.log(formatTable(headers, rows));
  console.log("");
  console.log(`${ANSI_BOLD}Latency Statistics:${ANSI_RESET}`);
  console.log(`  Min : ${ANSI_GREEN}${min} ms${ANSI_RESET}`);
  console.log(`  Max : ${ANSI_YELLOW}${max} ms${ANSI_RESET}`);
  console.log(`  Avg : ${ANSI_CYAN}${avg} ms${ANSI_RESET}`);
  console.log(`  P95 : ${ANSI_BOLD}${p95} ms${ANSI_RESET}`);
  console.log("");

  return 0;
}
