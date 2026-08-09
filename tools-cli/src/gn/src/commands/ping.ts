import { stderr } from "node:process";
import * as fs from "fs";
import { getOpenCodeDb } from "../utils/db";
import {
  printGnHeader,
  formatTable,
  ANSI_BOLD,
  ANSI_RESET,
  ANSI_GRAY,
  ANSI_CYAN,
  ANSI_GREEN,
} from "../utils/formatter";

interface PingResult {
  name: string;
  status: "OK" | "FAIL";
  latencyMs: number | string;
  detail: string;
}

async function checkPort(port: number, host = "127.0.0.1"): Promise<number> {
  const start = Bun.nanoseconds();
  try {
    const socket = await Bun.connect({
      hostname: host,
      port: port,
      socket: {
        data() {},
        open(ws) {
          ws.end();
        },
        error(err) {
          throw err;
        },
      },
    });
    return Math.round((Bun.nanoseconds() - start) / 1000000);
  } catch {
    return -1;
  }
}

export async function handlePingCommand(argv: string[]): Promise<number> {
  const hasJsonFlag = argv.includes("--json");
  const results: PingResult[] = [];

  // 1. OMP Gateway (Port 4000)
  const gatewayLat = await checkPort(4000);
  results.push({
    name: "OMP Gateway",
    status: gatewayLat >= 0 ? "OK" : "FAIL",
    latencyMs: gatewayLat >= 0 ? gatewayLat : "-",
    detail: gatewayLat >= 0 ? "Connected to 127.0.0.1:4000" : "Port 4000 unreachable",
  });

  // 2. OMP Broker (Port 4001)
  const brokerLat = await checkPort(4001);
  results.push({
    name: "OMP Broker",
    status: brokerLat >= 0 ? "OK" : "FAIL",
    latencyMs: brokerLat >= 0 ? brokerLat : "-",
    detail: brokerLat >= 0 ? "Connected to 127.0.0.1:4001" : "Port 4001 unreachable",
  });

  // 3. Ollama API (Port 11434)
  const ollamaLat = await checkPort(11434);
  results.push({
    name: "Ollama API",
    status: ollamaLat >= 0 ? "OK" : "FAIL",
    latencyMs: ollamaLat >= 0 ? ollamaLat : "-",
    detail: ollamaLat >= 0 ? "Connected to 127.0.0.1:11434" : "Port 11434 unreachable (local service)",
  });

  // 4. Local OpenCode DB
  const startDb = Bun.nanoseconds();
  let dbOk = false;
  const dbPath = getOpenCodeDb();
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      const fd = fs.openSync(dbPath, "r");
      fs.closeSync(fd);
      dbOk = true;
    } catch {}
  }
  const dbLat = Math.round((Bun.nanoseconds() - startDb) / 1000000);
  results.push({
    name: "OpenCode DB",
    status: dbOk ? "OK" : "FAIL",
    latencyMs: dbOk ? dbLat : "-",
    detail: dbOk ? `Read access verified: ${dbPath}` : `Cannot access database file: ${dbPath || "not configured"}`,
  });

  if (hasJsonFlag) {
    console.log(JSON.stringify(results, null, 2));
    return results.some((r) => r.status === "FAIL") ? 1 : 0;
  }

  printGnHeader("CONNECTIVITY PING");
  console.log("");

  const headers = ["Target Service", "Status", "Latency", "Diagnostics"];
  const rows = results.map((r) => [
    r.name,
    r.status === "OK" ? "󰄬 OK" : "󰅚 FAIL",
    r.latencyMs === "-" ? "-" : `${r.latencyMs} ms`,
    r.detail,
  ]);

  console.log(formatTable(headers, rows));
  console.log("");

  return results.some((r) => r.status === "FAIL") ? 1 : 0;
}
