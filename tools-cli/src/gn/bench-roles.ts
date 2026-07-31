// ─────────────────────────────────────────────────────────────
// Goblin Nexus Dynamic Benchmark Roles & Hybrid Scoring Loader
// Reads prompts & datasets from tools-cli/src/gn/prompts/
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

export interface DatasetItem {
  id: string;
  prompt: string;
  must_include?: string[];
  code_required?: boolean;
}

export interface BenchRole {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  dataset: DatasetItem;
}

const PROMPTS_DIR = path.join(__dirname, "prompts");
const ROLES_DIR = path.join(PROMPTS_DIR, "roles");
const DATASETS_DIR = path.join(PROMPTS_DIR, "datasets");

const ROLE_METADATA: Record<string, { name: string; emoji: string }> = {
  coder: { name: "Senior Software Engineer", emoji: "💻" },
  bugfix: { name: "Senior Debugging Specialist", emoji: "🐛" },
  planning: { name: "Senior Technical Architect", emoji: "📐" },
  codereview: { name: "Senior Code Reviewer", emoji: "👁️" },
};

function readRolePrompt(roleId: string): string {
  const file = path.join(ROLES_DIR, `${roleId}.txt`);
  if (fs.existsSync(file)) {
    return fs.readFileSync(file, "utf8").trim();
  }
  return "You are a helpful software engineering assistant.";
}

function readDatasetItem(roleId: string): DatasetItem {
  const file = path.join(DATASETS_DIR, `${roleId}.json`);
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const items = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        return items[0];
      }
    } catch (_) {}
  }
  return {
    id: `${roleId}_default`,
    prompt: "Write a clean modular implementation.",
    must_include: ["function"],
    code_required: true,
  };
}

export function getRole(roleId?: string): BenchRole {
  const id = (roleId || "coder").toLowerCase();
  const meta = ROLE_METADATA[id] || { name: `${id} specialist`, emoji: "🤖" };

  return {
    id,
    name: meta.name,
    emoji: meta.emoji,
    systemPrompt: readRolePrompt(id),
    dataset: readDatasetItem(id),
  };
}

/**
 * Hybrid Scoring Matcher (Sumber Kebenaran Deterministik 1)
 */
export function calculateHybridScore(text: string, dataset: DatasetItem): number {
  if (!text || text.length < 20) return 0.1;

  let score = 0.4; // Base score for non-empty response

  // Cek kata kunci wajib
  if (dataset.must_include && dataset.must_include.length > 0) {
    const textLower = text.toLowerCase();
    let matchedCount = 0;
    for (const kw of dataset.must_include) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedCount++;
      }
    }
    const kwRatio = matchedCount / dataset.must_include.length;
    score += kwRatio * 0.4; // Up to +40%
  } else {
    score += 0.3;
  }

  // Cek keberadaan Code Block bila diminta
  if (dataset.code_required) {
    if (text.includes("```")) {
      score += 0.2; // +20% for code formatting
    }
  } else {
    score += 0.1;
  }

  // Length & structure check
  if (text.length > 200) score += 0.1;

  return Math.min(parseFloat(score.toFixed(2)), 1.0);
}
