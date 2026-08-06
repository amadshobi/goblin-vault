import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export function renderGitDiff(cwd: string, filesFilter?: string[]): string | null {
  try {
    const gitArgs = ["diff", "--color=never", "HEAD"];
    if (filesFilter && filesFilter.length > 0) {
      gitArgs.push("--", ...filesFilter);
    }
    let res = spawnSync("git", gitArgs, { cwd, encoding: "utf-8" });
    let diffRaw = res.stdout || "";
    if (!diffRaw.trim()) {
      res = spawnSync("git", ["diff", "--color=never"], { cwd, encoding: "utf-8" });
      diffRaw = res.stdout || "";
    }

    if (!diffRaw.trim()) {
      const statusRes = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf-8" });
      const statusRaw = statusRes.stdout || "";
      if (statusRaw.trim()) {
        const lines = statusRaw.trim().split("\n");
        const formatted: string[] = [];
        for (const l of lines) {
          const st = l.slice(0, 2).trim();
          const file = l.slice(3).trim();
          if (filesFilter && filesFilter.length > 0 && !filesFilter.some((f) => f.includes(file) || file.includes(f))) {
            continue;
          }
          if (st === "??" || st === "A") {
            formatted.push(`\x1b[90m┌─\x1b[0m \x1b[1;33m󰈙 Created File: ${file}\x1b[0m \x1b[90m${"─".repeat(Math.max(5, 30 - file.length))}\x1b[0m`);
            formatted.push(`\x1b[90m│\x1b[0m \x1b[32m+ [New File Created]\x1b[0m`);
            formatted.push(`\x1b[90m└${"─".repeat(45)}\x1b[0m`);
          } else {
            formatted.push(`\x1b[90m┌─\x1b[0m \x1b[1;33m󰏫 Modified File: ${file}\x1b[0m \x1b[90m${"─".repeat(Math.max(5, 30 - file.length))}\x1b[0m`);
            formatted.push(`\x1b[90m│\x1b[0m \x1b[33m~ [File Changed]\x1b[0m`);
            formatted.push(`\x1b[90m└${"─".repeat(45)}\x1b[0m`);
          }
        }
        if (formatted.length > 0) return "\n" + formatted.join("\n");
      }

      if (filesFilter && filesFilter.length > 0) {
        const formatted: string[] = [];
        for (const file of filesFilter) {
          const relPath = file.replace(cwd + "/", "");
          formatted.push(`\x1b[90m┌─\x1b[0m \x1b[1;33m󰏫 Modified File: ${relPath}\x1b[0m \x1b[90m${"─".repeat(Math.max(5, 30 - relPath.length))}\x1b[0m`);
          formatted.push(`\x1b[90m│\x1b[0m \x1b[32m+ [File Content Updated]\x1b[0m`);
          formatted.push(`\x1b[90m└${"─".repeat(45)}\x1b[0m`);
        }
        return "\n" + formatted.join("\n");
      }

      return null;
    }

    const lines = diffRaw.split("\n");
    const formatted: string[] = [];
    let currentFile = "";

    for (let line of lines) {
      if (line.startsWith("diff --git")) {
        const match = line.match(/b\/(.+)$/);
        currentFile = match ? match[1] : "file";
        formatted.push(`\x1b[90m┌─\x1b[0m \x1b[1;33m󰏫 Diff: ${currentFile}\x1b[0m \x1b[90m${"─".repeat(Math.max(5, 38 - currentFile.length))}\x1b[0m`);
        continue;
      }
      if (line.startsWith("---") || line.startsWith("+++")) {
        continue;
      }
      if (line.startsWith("@@")) {
        formatted.push(`\x1b[90m│\x1b[0m \x1b[36m${line}\x1b[0m`);
        continue;
      }
      if (line.startsWith("+")) {
        formatted.push(`\x1b[90m│\x1b[0m \x1b[32m${line}\x1b[0m`);
        continue;
      }
      if (line.startsWith("-")) {
        formatted.push(`\x1b[90m│\x1b[0m \x1b[31m${line}\x1b[0m`);
        continue;
      }
      if (line.startsWith(" ")) {
        formatted.push(`\x1b[90m│   ${line.slice(1)}\x1b[0m`);
        continue;
      }
    }
    if (formatted.length > 0) {
      formatted.push(`\x1b[90m└${"─".repeat(45)}\x1b[0m`);
    }

    return "\n" + formatted.join("\n");
  } catch {
    if (filesFilter && filesFilter.length > 0) {
      const formatted: string[] = [];
      for (const file of filesFilter) {
        const relPath = file.replace(cwd + "/", "");
        formatted.push(`\x1b[90m┌─\x1b[0m \x1b[1;33m󰏫 Modified File: ${relPath}\x1b[0m \x1b[90m${"─".repeat(Math.max(5, 30 - relPath.length))}\x1b[0m`);
        formatted.push(`\x1b[90m│\x1b[0m \x1b[32m+ [File Content Updated]\x1b[0m`);
        formatted.push(`\x1b[90m└${"─".repeat(45)}\x1b[0m`);
      }
      return "\n" + formatted.join("\n");
    }
    return null;
  }
}
function highlightSyntaxLine(line: string): string {
  if (line.trim().startsWith("//") || line.trim().startsWith("#")) {
    return `\x1b[3;90m${line}\x1b[0m`;
  }

  let code = line;
  code = code.replace(/(["'`])(?:(?=(\\?))\2[\s\S])*?\1/g, "\x1b[32m$&\x1b[0m");

  const keywords = /\b(const|let|var|function|def|return|import|export|from|async|await|class|if|else|for|while|try|catch|new|type|interface)\b/g;
  code = code.replace(keywords, "\x1b[1;35m$1\x1b[0m");

  const constants = /\b(true|false|null|undefined|NaN|Infinity|\d+)\b/g;
  code = code.replace(constants, "\x1b[36m$1\x1b[0m");

  return code;
}

export class MarkdownStreamFormatter {
  private inCodeBlock = false;
  private currentLang = "";
  private lineBuffer = "";

  public processChunk(chunk: string): string {
    this.lineBuffer += chunk;
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() || "";

    const output: string[] = [];
    for (const line of lines) {
      output.push(this.formatLine(line));
    }
    return output.length > 0 ? output.join("\n") + "\n" : "";
  }

  public flush(): string {
    if (!this.lineBuffer) return "";
    const remaining = this.lineBuffer;
    this.lineBuffer = "";
    return this.formatLine(remaining) + "\n";
  }

  public formatLine(line: string): string {
    if (line.trim().startsWith("```")) {
      this.inCodeBlock = !this.inCodeBlock;
      this.currentLang = line.trim().replace(/^```/, "");
      if (this.inCodeBlock) {
        return `\x1b[90m┌─\x1b[0m \x1b[1;33m${this.currentLang || "code"}\x1b[0m \x1b[90m${"─".repeat(Math.max(10, 40 - (this.currentLang?.length || 4)))}\x1b[0m`;
      } else {
        return `\x1b[90m└${"─".repeat(46)}\x1b[0m`;
      }
    }

    if (this.inCodeBlock) {
      const highlighted = highlightSyntaxLine(line);
      return `\x1b[90m│\x1b[0m ${highlighted}`;
    }

    // Horizontal Rules
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      return `\x1b[90m${"─".repeat(50)}\x1b[0m`;
    }

    // Blockquotes (> quote)
    if (/^>\s+/.test(line)) {
      const quoteText = line.replace(/^>\s+/, "");
      return `\x1b[90m│\x1b[0m \x1b[3;90m${quoteText}\x1b[0m`;
    }

    // Format Grid Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (line.includes("---")) {
        line = line.replace(/\|/g, "┼").replace(/-/g, "─");
        line = `\x1b[90m${line}\x1b[0m`;
      } else {
        line = line.replace(/\|/g, "\x1b[90m│\x1b[0m");
      }
    }

    // Headers (# Header)
    line = line.replace(/^(#{1,6})\s+(.*)$/, (_m, hashes, text) => {
      const level = hashes.length;
      if (level === 1) return `\x1b[1;33m# ${text}\x1b[0m`;
      if (level === 2) return `\x1b[1;36m## ${text}\x1b[0m`;
      return `\x1b[1;35m${hashes} ${text}\x1b[0m`;
    });

    // Numbered lists (1. , 2. )
    line = line.replace(/^(\s*)(\d+)\.\s+/, "$1\x1b[33m$2.\x1b[0m ");

    // Bullet points (- , * )
    line = line.replace(/^(\s*)[-*]\s+/, "$1\x1b[36m •\x1b[0m ");

    // Task list items
    line = line.replace(/\[\s*\]/g, "\x1b[90m[ ]\x1b[0m");
    line = line.replace(/\[[xX]\]/g, "\x1b[32m[✓]\x1b[0m");

    // Links [text](url)
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\x1b[4;36m$1\x1b[0m \x1b[90m($2)\x1b[0m");

    // Format **bold**
    line = line.replace(/\*\*([^*]+)\*\*/g, "\x1b[1m$1\x1b[0m");

    // Format *italic* or _italic_
    line = line.replace(/(\*|_)([^*_]+)\1/g, "\x1b[3m$2\x1b[0m");

    // Format ~~strikethrough~~
    line = line.replace(/~~([^~]+)~~/g, "\x1b[9m$1\x1b[0m");

    // Format `inline code`
    line = line.replace(/`([^`]+)`/g, "\x1b[36m$1\x1b[0m");

    return line;
  }
}

export function formatMarkdownTerminal(raw: string): string {
  const formatter = new MarkdownStreamFormatter();
  const res = formatter.processChunk(raw);
  const flushed = formatter.flush();
  return (res + flushed).trimEnd();
}

export function formatOpenCodeToolLabel(name: string, args: Record<string, unknown>): string {
  if (!args || typeof args !== "object") return name;
  if (name === "read") {
    const targetPath = String(args.path || "");
    if (targetPath.includes(".db") || targetPath.includes(".sqlite")) {
      return `󰆼 Inspect DB ${targetPath}`;
    }
    if (targetPath.endsWith(".zip") || targetPath.endsWith(".tar.gz") || targetPath.endsWith(".tgz")) {
      return `󰿺 Archive ${targetPath}`;
    }

    try {
      const resolved = resolve(targetPath);
      if (existsSync(resolved) && statSync(resolved).isDirectory()) {
        return `󰉋 List ${targetPath}`;
      }
    } catch {}

    if (targetPath === "." || targetPath === ".." || targetPath.endsWith("/")) {
      return `󰉋 List ${targetPath}`;
    }

    return `󰈙 Read ${targetPath}`;
  }
  if (name === "write") {
    return `󰏫 Write ${args.path || ""}`.trim();
  }
  if (name === "edit") {
    return `󰏫 Edit ${args.path || ""}`.trim();
  }
  if (name === "bash") {
    const cmd = String(args.command || "").replace(/\n/g, " ");
    const shortCmd = cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd;
    return `󰞷 $ ${shortCmd}`.trim();
  }
  if (name === "glob") {
    return `󰈞 Glob "${args.pattern || args.path || ""}"`.trim();
  }
  if (name === "grep") {
    return `󰈞 Grep "${args.pattern || args.path || ""}"`.trim();
  }
  if (name === "web_search" || name === "websearch") {
    return `󰍉 Web Search "${args.query || ""}"`.trim();
  }
  if (name === "task") {
    return `│ ↳ Task ${args.agent || ""} ${args.task || ""}`.trim();
  }
  const raw = JSON.stringify(args);
  return `󰆧 ${name} ${raw.length > 40 ? raw.slice(0, 37) + "..." : raw}`.trim();
}
