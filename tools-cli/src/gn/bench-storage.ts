// ─────────────────────────────────────────────────────────────
// Goblin Nexus Benchmark Storage Engine & Output.md Generator
// Appends history.json & generates self-cleaning output.md for agent analytics
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

export interface BenchRecord {
  model: string;
  role: string;
  latencyMs: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
    tokPerSec: number;
  };
  qualityScore: number;
  timestamp: string;
  outputSnippet?: string;
  promptDataset?: string;
}

export interface BenchRunSession {
  runId: string;
  timestamp: string;
  records: BenchRecord[];
}

const STORAGE_DIR = path.join(__dirname, "storage");
const STORAGE_FILE = path.join(STORAGE_DIR, "history.json");
const OUTPUT_MD_FILE = path.join(STORAGE_DIR, "output.md");

export function resetOutputMd(roleName: string, datasetId: string): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    const header = `# 🧪 GOBLIN NEXUS BENCHMARK OUTPUT EVALUATION
- **Date**: ${new Date().toLocaleString()}
- **Role**: ${roleName}
- **Dataset ID**: \`${datasetId}\`

---
`;
    fs.writeFileSync(OUTPUT_MD_FILE, header);
  } catch (err: any) {
    console.error(`⚠️  Failed to reset output.md: ${err.message}`);
  }
}

export function appendOutputMd(modelId: string, promptText: string, outputText: string, qualityScore: number): void {
  try {
    const section = `
## 📌 MODEL: \`${modelId}\`
- **Score (Deterministic)**: ⭐ ${Math.round(qualityScore * 100)}%

### ❓ Prompt (Soal)
\`\`\`text
${promptText}
\`\`\`

### 💡 Model Response (Jawaban)
${outputText}

---
`;
    fs.appendFileSync(OUTPUT_MD_FILE, section);
  } catch (err: any) {
    console.error(`⚠️  Failed to append to output.md: ${err.message}`);
  }
}

export function saveBenchRun(records: BenchRecord[]): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    let history: BenchRunSession[] = [];
    if (fs.existsSync(STORAGE_FILE)) {
      try {
        const raw = fs.readFileSync(STORAGE_FILE, "utf8");
        history = JSON.parse(raw);
      } catch (_) {
        history = [];
      }
    }

    const session: BenchRunSession = {
      runId: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      records,
    };

    const updatedHistory = [session, ...history].slice(0, 50);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(updatedHistory, null, 2));
  } catch (err: any) {
    console.error(`⚠️  Failed to save benchmark history: ${err.message}`);
  }
}
