import type { Plugin } from "@opencode-ai/plugin";

/**
 * Smart Truncation — Head+Tail Truncation Cerdas
 *
 * Bukan sekedar potong mentah. Pake pendekatan head+tail:
 * - Shell/bash: 200 line awal + 200 line akhir (yang tengah di-ringkas)
 * - Grep/search: 200 line max, 400 chars/line
 * - Fetch: 40K chars max
 * - Ada banner info biar tau berapa yang ke-truncate
 */

const LIMITS = {
  shell: { head: 200, tail: 200, maxLineChars: 500 },
  grep: { maxLines: 200, maxLineChars: 400 },
  fetch: { maxChars: 40000 },
  default: { head: 100, tail: 100, maxLineChars: 1000 },
};

type ToolCategory = "shell" | "grep" | "fetch" | "default";

function categorizeTool(toolId: string): ToolCategory {
  if (["bash", "shell", "terminal", "exec"].includes(toolId)) return "shell";
  if (["grep", "search", "glob"].includes(toolId)) return "grep";
  if (["webfetch", "fetch", "web_search", "websearch"].includes(toolId)) return "fetch";
  return "default";
}

/**
 * Truncate string with head+tail approach
 */
function smartTruncate(
  text: string,
  headLines: number,
  tailLines: number,
  maxLineChars: number
): string {
  if (!text) return text;

  const lines: string[] = [];
  let currentLine = "";
  let lineCount = 0;

  // Split by newlines, but also handle super long lines
  for (const rawLine of text.split("\n")) {
    lineCount++;

    // Truncate individual long lines
    const line =
      rawLine.length > maxLineChars
        ? rawLine.slice(0, maxLineChars) + `... [${rawLine.length - maxLineChars} chars truncated]`
        : rawLine;

    if (lineCount <= headLines) {
      lines.push(line);
    } else if (lineCount > headLines && lineCount <= lineCount - tailLines) {
      // Middle section — skip
      continue;
    } else {
      lines.push(line);
    }
  }

  const totalLines = lineCount;

  // If total lines > head + tail, insert truncation notice
  if (totalLines > headLines + tailLines) {
    const truncatedCount = totalLines - headLines - tailLines;
    const insertAt = headLines > lines.length ? lines.length : headLines;
    lines.splice(insertAt, 0, ``, `┈┈ [${truncatedCount} lines truncated — head ${headLines} / tail ${tailLines}] ┈┈`, ``);
  }

  return lines.join("\n");
}

export default (async () => {
  return {
    "tool.execute.after": async (input, output) => {
      const toolId = input.toolID;
      const category = categorizeTool(toolId);
      const result = output.result;

      if (!result) return;

      const resultText =
        typeof result === "string"
          ? result
          : result.output || result.text || result.content || JSON.stringify(result);

      if (!resultText || resultText.length < 500) return; // Skip small outputs

      let truncated: string;
      const meta: Record<string, any> = {};

      switch (category) {
        case "shell": {
          const { head, tail, maxLineChars } = LIMITS.shell;
          const origLength = resultText.length;
          truncated = smartTruncate(resultText, head, tail, maxLineChars);
          meta.originalChars = origLength;
          meta.truncatedChars = truncated.length;
          meta.savings = `${Math.round((1 - truncated.length / origLength) * 100)}%`;
          break;
        }

        case "grep": {
          const { maxLines, maxLineChars } = LIMITS.grep;
          const lines = resultText.split("\n");
          if (lines.length > maxLines) {
            truncated = lines.slice(0, maxLines).join("\n");
            truncated += `\n\n┈┈ [${lines.length - maxLines} more lines truncated — grep limit ${maxLines}] ┈┈`;
            meta.originalLines = lines.length;
            meta.truncatedLines = maxLines;
          } else {
            // Still truncate individual long lines
            truncated = lines
              .map((l) =>
                l.length > maxLineChars
                  ? l.slice(0, maxLineChars) + `... [truncated]`
                  : l
              )
              .join("\n");
          }
          break;
        }

        case "fetch": {
          const { maxChars } = LIMITS.fetch;
          if (resultText.length > maxChars) {
            truncated = resultText.slice(0, maxChars);
            truncated += `\n\n┈┈ [${resultText.length - maxChars} chars truncated — fetch limit ${maxChars}] ┈┈`;
            meta.originalChars = resultText.length;
            meta.truncatedChars = truncated.length;
          } else {
            truncated = resultText;
          }
          break;
        }

        default: {
          const { head, tail, maxLineChars } = LIMITS.default;
          truncated = smartTruncate(resultText, head, tail, maxLineChars);
          break;
        }
      }

      // Replace output with truncated version
      if (truncated !== resultText) {
        if (typeof result === "string") {
          output.result = truncated;
        } else {
          // Object result — preserve structure
          output.result = {
            ...result,
            output: truncated,
            _truncation: {
              originalSize: resultText.length,
              truncatedSize: truncated.length,
              tool: toolId,
              ...meta,
            },
          };
        }
      }
    },
  };
}) satisfies Plugin;
