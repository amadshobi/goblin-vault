/**
 * issue/view.ts — GitHub issues CRUD & view (TS)
 *
 * Port dari `commands/issue.js` + `utils/display.js` (formatIssue + visual
 * helpers) yang di-inline agar domain issue self-contained.
 *
 * Visual helpers (stripAnsi, visualLength, padVisual, truncateVisual,
 * clearLastLines) di-import dari `../../utils/format` (shared cross-domain).
 */
import { cancel, note, spinner, text, confirm, select, isCancel } from "@clack/prompts";
import { writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import color from "picocolors";
import { ghExec, ghRaw } from "../gh";
import type { GHIssue } from "../../types";
import { clearLastLines } from "../../utils/format";

const ALLOWED_PAGERS = new Set(["less", "more", "most", "bat", "pg", "view"]);

/** Parse PAGER env var secara aman tanpa shell interpolation */
function parsePagerEnv(pagerEnv?: string): { bin: string; args: string[] } {
  if (!pagerEnv || !pagerEnv.trim()) {
    return { bin: "less", args: ["-R"] };
  }
  const parts = pagerEnv.trim().split(/\s+/);
  const rawBin = parts[0];
  const binName = path.basename(rawBin).toLowerCase();

  if (!ALLOWED_PAGERS.has(binName)) {
    return { bin: "less", args: ["-R"] };
  }

  const safeArgs = parts.slice(1).filter((arg) => !/[;&|><$`\\]/.test(arg));
  return { bin: rawBin, args: safeArgs };
}

/** Plain-string truncate untuk display ringkas (tanpa memperdulikan ANSI). */
export function truncate(str: string | null | undefined, maxLen = 50): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

/** Format an Issue object for display. */
export function formatIssue(issue: GHIssue): string {
  const stateIcon = issue.state === "OPEN" ? color.green("[OPEN]") : color.red("[CLOS]");
  const title = truncate(issue.title, 60);
  const number = `#${issue.number}`;
  return `${stateIcon} ${color.cyan(number.padEnd(7))} ${color.bold(title)}`;
}

/** Open content in pager or just log it. */
export function showInPager(content: string, title = ""): void {
  const tmpFile = path.join(os.tmpdir(), `gb-view-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  const header = title ? `${title}\n${"-".repeat(60)}\n\n` : "";
  
  try {
    writeFileSync(tmpFile, header + content, "utf8");

    const { bin, args } = parsePagerEnv(process.env.PAGER);
    const result = spawnSync(bin, [...args, tmpFile], { stdio: "inherit" });

    if (result.status !== 0) {
      console.log(content);
    }
  } catch {
    console.log(content);
  } finally {
    try {
      if (unlinkSync) unlinkSync(tmpFile);
    } catch {}
  }
}

/** Pause until Enter. */
export async function continuePrompt(): Promise<void> {
  const res = await text({ message: "Tekan Enter untuk lanjut...", placeholder: "" });
  isCancel(res);
}

/** Fetch a single issue (raw JSON, tanpa pager) — dipakai router/summarize/analyze. */
export function fetchIssue(repo: string, issueNumber: number | string): GHIssue {
  return ghExec([
    "issue", "view", String(issueNumber), "--repo", repo,
    "--json", "number,title,state,body,author,createdAt,labels,comments",
  ]) as GHIssue;
}

/** List issues by state (OPEN/CLOSED). */
export async function listIssues(repo: string, state = "OPEN"): Promise<GHIssue[]> {
  const s = spinner();
  s.start(`Fetching ${state} issues...`);
  try {
    const issues = ghExec(["issue", "list", "--repo", repo, "--state", state, "--json", "number,title,state,author,createdAt,labels"]) as
      GHIssue[] | null;
    s.stop(`Found ${issues?.length || 0} issues`);
    if (!issues || issues.length === 0) {
      note(`No ${state.toLowerCase()} issues found.`);
      return [];
    }
    return issues;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return [];
  }
}

/** View a single issue (paginated). */
export async function viewIssue(repo: string, issueNumber: number | string): Promise<GHIssue | null> {
  const s = spinner();
  s.start("Fetching issue details...");
  try {
    const issue = ghExec([
      "issue", "view", String(issueNumber), "--repo", repo,
      "--json", "number,title,state,body,author,createdAt,labels,comments",
    ]) as GHIssue;

    let output = `#${issue.number} ${issue.title}\n`;
    output += `State: ${issue.state} | Author: ${issue.author?.login} | Created: ${issue.createdAt}\n`;
    if (issue.labels?.length) {
      output += `Labels: ${issue.labels.map((l) => l.name).join(", ")}\n`;
    }
    output += "\n" + "-".repeat(60) + "\n\n";
    output += issue.body || "(no description)";

    if (issue.comments?.length) {
      output += "\n\n" + "-".repeat(60) + "\nCOMMENTS:\n";
      issue.comments.slice(0, 5).forEach((c) => {
        output += `\n${color.bold(c.author?.login || "unknown")} (${c.createdAt}):\n`;
        output += `  ${(c.body || "(no body)").slice(0, 200)}`;
        if ((c.body?.length ?? 0) > 200) output += "...";
        output += "\n";
      });
      if (issue.comments.length > 5) output += `\n...and ${issue.comments.length - 5} more comments`;
    }

    showInPager(output, `Issue #${issue.number}`);
    return issue;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return null;
  }
}

/** Create an issue interactively. */
export async function createIssue(repo: string): Promise<boolean> {
  const title = await text({ message: "Judul Issue:", placeholder: "Bug: something broke" });
  if (isCancel(title)) {
    clearLastLines(2);
    return false;
  }
  const body = await text({ message: "Deskripsi (optional):", placeholder: "Steps to reproduce..." });
  if (isCancel(body)) {
    clearLastLines(2);
    return false;
  }

  const s = spinner();
  s.start("Creating issue...");
  try {
    const args = ["issue", "create", "--repo", repo, "--title", title];
    if (body.trim()) args.push("--body", body.trim());
    const out = ghRaw(args);
    s.stop("Issue Created");
    note(out || "created", "New Issue");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Close an issue (with confirmation). */
export async function closeIssue(repo: string, issueNumber: number | string): Promise<boolean> {
  const confirmed = await confirm({
    message: `Close issue #${issueNumber}?`,
  });
  if (isCancel(confirmed) || !confirmed) {
    clearLastLines(2);
    return false;
  }

  const s = spinner();
  s.start(`Closing issue #${issueNumber}...`);
  try {
    const out = ghRaw(["issue", "close", String(issueNumber), "--repo", repo]);
    s.stop("Closed");
    note(out || "closed", "Close");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Pick an issue from a list interactively. */
export async function selectIssue(issues: GHIssue[]): Promise<number | null> {
  const selected = await select({
    message: "Pilih Issue:",
    options: issues.map((i) => ({ value: `${i.number}`, label: formatIssue(i) })),
  });
  if (isCancel(selected)) {
    clearLastLines(2);
    return null;
  }
  return Number(selected);
}

/** TUI menu utama untuk domain issue. */
export async function issueMenu(repo: string): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string }[], string>({
      message: `Issues — ${color.cyan(repo)}`,
      options: [
        { value: "listOpen", label: "List Open Issues" },
        { value: "listClosed", label: "List Closed Issues" },
        { value: "view", label: "View Issue" },
        { value: "create", label: "Create Issue" },
        { value: "close", label: "Close Issue" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    if (action === "listOpen" || action === "listClosed") {
      const state = action === "listOpen" ? "OPEN" : "CLOSED";
      const issues = await listIssues(repo, state);
      if (issues.length > 0) {
        const listStr = issues.map((i) => `  ${formatIssue(i)}`).join("\n");
        note(listStr, `Issues (${state})`);
      }
      await continuePrompt();
    } else if (action === "view" || action === "close") {
      const issues = await listIssues(repo, "OPEN");
      if (issues.length === 0) {
        await continuePrompt();
        continue;
      }
      const issueNum = await selectIssue(issues);
      if (!issueNum) continue;

      switch (action) {
        case "view":
          await viewIssue(repo, issueNum);
          break;
        case "close":
          await closeIssue(repo, issueNum);
          break;
      }
      await continuePrompt();
    } else if (action === "create") {
      await createIssue(repo);
      await continuePrompt();
    }
  }
}