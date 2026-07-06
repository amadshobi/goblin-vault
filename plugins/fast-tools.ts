import type { Plugin } from "@opencode-ai/plugin";
import { execSync } from "child_process";

/**
 * Fast Tools — Ripgrep Interception
 *
 * Intercept grep/glob tool calls, serve via ripgrep dengan:
 * - Submatch windowing (±30 chars per match) → hemat token 80-90%
 * - Grouped by file dengan match count banner
 * - Auto fallback kalo rg ga ada
 */

const RG_AVAILABLE = (() => {
  try {
    execSync("which rg", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const WINDOW_SIZE = 30; // ±chars around each match

interface MatchGroup {
  file: string;
  matches: string[];
  lineNumbers: number[];
}

function parseRgOutput(raw: string, pattern: string): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const lines = raw.split("\n").filter((l) => l.trim());

  let currentGroup: MatchGroup | null = null;

  for (const line of lines) {
    // rg output format: file:line:content  or  file:line:col:content
    const match = line.match(/^(.+?):(\d+)(?::\d+)?:(.+)$/);
    if (!match) continue;

    const [, file, lineNumStr, content] = match;
    const lineNum = parseInt(lineNumStr);

    // Extract match with context window
    const matchIdx = content.toLowerCase().indexOf(pattern.toLowerCase());
    let windowed: string;
    if (matchIdx >= 0) {
      const start = Math.max(0, matchIdx - WINDOW_SIZE);
      const end = Math.min(content.length, matchIdx + pattern.length + WINDOW_SIZE);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < content.length ? "..." : "";
      windowed = `${prefix}${content.slice(start, end)}${suffix}`;
    } else {
      windowed = content.length > 80 ? content.slice(0, 80) + "..." : content;
    }

    if (currentGroup && currentGroup.file === file) {
      currentGroup.matches.push(windowed);
      currentGroup.lineNumbers.push(lineNum);
    } else {
      if (currentGroup) groups.push(currentGroup);
      currentGroup = { file, matches: [windowed], lineNumbers: [lineNum] };
    }
  }

  if (currentGroup) groups.push(currentGroup);
  return groups;
}

function formatRgOutput(groups: MatchGroup[]): string {
  const parts: string[] = [];

  for (const group of groups) {
    const matchWord = group.matches.length === 1 ? "match" : "matches";
    parts.push(`── ${group.file} (${group.matches.length} ${matchWord}) ──`);

    for (let i = 0; i < group.matches.length; i++) {
      parts.push(`  ${group.lineNumbers[i]}: ${group.matches[i]}`);
    }
    parts.push(""); // blank line between files
  }

  return parts.join("\n");
}

export default (async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const toolId = input.toolID;

      // Intercept grep tool
      if (toolId === "grep" && RG_AVAILABLE && output.args) {
        const pattern = output.args.pattern || output.args[0];
        const path = output.args.path || output.args[1] || ".";

        if (pattern && typeof pattern === "string") {
          try {
            const rgOutput = execSync(
              `rg --line-number --no-heading -i '${pattern.replace(/'/g, "'\\''")}' '${path}' 2>/dev/null`,
              { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
            );

            if (rgOutput.trim()) {
              const groups = parseRgOutput(rgOutput, pattern);
              const formatted = formatRgOutput(groups);

              // Override args to use rg-style output
              // We keep the grep tool but the output will be processed in after hook
              output.args._rgResult = formatted;
              output.args._rgMatchCount = groups.reduce((s, g) => s + g.matches.length, 0);
            }
          } catch {
            // rg failed, fallback to default grep
          }
        }
      }
    },

    "tool.execute.after": async (input, output) => {
      const toolId = input.toolID;

      // For grep tool with rg results — replace output
      if (toolId === "grep" && output.result && output.result._rgResult) {
        const result = output.result;
        const rgResult = result._rgResult;
        const matchCount = result._rgMatchCount || 0;

        output.result = {
          summary: `${matchCount} ${matchCount === 1 ? "match" : "matches"} found (via ripgrep fast tools)`,
          output: rgResult,
          _meta: {
            source: "ripgrep-fast-tools",
            matchCount,
            truncated: false,
          },
        };

        // Clean up temp props
        delete output.result._rgResult;
        delete output.result._rgMatchCount;
      }

      // For glob tool — optimize if rg available
      if (toolId === "glob" && RG_AVAILABLE && output.result) {
        const files = Array.isArray(output.result) ? output.result : [];
        if (files.length > 50) {
          // If too many files, truncate and note
          const display = files.slice(0, 50);
          output.result = {
            summary: `${files.length} files found (showing first 50 via fast tools)`,
            files: display,
            _meta: {
              source: "ripgrep-fast-tools",
              totalFiles: files.length,
              truncated: files.length > 50,
            },
          };
        }
      }
    },
  };
}) satisfies Plugin;
