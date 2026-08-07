import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { AgentInfo } from "../types";

// AGENTS_BASE_DIR ditanam inline di sini (nilai sumber dari config.ts) agar core
// TS ini tetap self-contained tanpa menarik dependensi config.ts yang hanya
// relevan untuk eksekusi sub-agent OMP — di luar lingkup engine gb.
const AGENTS_BASE_DIR = resolve(
  process.env.HOME || "/home/shobixlinuxdev",
  ".opencode/plugins/goblin-pack/agents"
);

export const VALID_OMP_TOOLS = new Set([
  "read", "bash", "edit", "ast_grep", "ast_edit", "ask", "debug", "eval", 
  "github", "glob", "grep", "lsp", "inspect_image", "browser", "computer", 
  "checkpoint", "rewind", "security_scan", "task", "hub", "todo", "web_search", 
  "write", "memory_edit", "retain", "recall", "reflect", "learn", "manage_skill", "yield", "goal"
]);

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function findDidYouMean(input: string, validFullNames: string[]): string | null {
  const cleanInput = input.toLowerCase();
  
  for (const fullName of validFullNames) {
    const cleanFull = fullName.toLowerCase();
    const cleanShort = cleanFull.replace(/^goblin-/, "");
    if (cleanFull.startsWith(cleanInput) || cleanShort.startsWith(cleanInput)) {
      return fullName;
    }
  }

  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const fullName of validFullNames) {
    const cleanFull = fullName.toLowerCase();
    const cleanShort = cleanFull.replace(/^goblin-/, "");

    const distFull = levenshtein(cleanInput, cleanFull);
    const distShort = levenshtein(cleanInput, cleanShort);
    const minDist = Math.min(distFull, distShort);

    if (minDist < minDistance && minDist <= 5) {
      minDistance = minDist;
      bestMatch = fullName;
    }
  }
  return bestMatch;
}

let cachedAgents: AgentInfo[] | null = null;

export function getAgents(): AgentInfo[] {
  if (!cachedAgents) {
    cachedAgents = scanAgents(AGENTS_BASE_DIR);
  }
  return cachedAgents;
}

export function scanAgents(dir: string, baseDir = dir): AgentInfo[] {
  let results: AgentInfo[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(scanAgents(fullPath, baseDir));
    } else if (stat.isFile() && entry.endsWith(".md")) {
      const relPath = relative(baseDir, fullPath);
      const name = entry.replace(/\.md$/, "");
      const category = relPath.includes("/") ? relPath.split("/")[0] : "general";

      const content = readFileSync(fullPath, "utf-8");
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let model: string | undefined;
      let tools: string[] = [];

      if (match) {
        const yaml = match[1];
        const m = yaml.match(/model:\s*([^\r\n]+)/);
        if (m) model = m[1].trim();

        const tMatch = yaml.match(/tools:\r?\n([\s\S]*?)(?=\n\w+:|$)/);
        if (tMatch) {
          const lines = tMatch[1].split("\n");
          for (const line of lines) {
            const entryMatch = line.match(/\s*([a-zA-Z0-9_-]+):\s*(true|false)/);
            if (entryMatch && entryMatch[2] === "true") {
              if (VALID_OMP_TOOLS.has(entryMatch[1])) {
                tools.push(entryMatch[1]);
              }
            }
          }
        }
      }

      results.push({ name, path: fullPath, category, model, tools });
    }
  }
  return results;
}
