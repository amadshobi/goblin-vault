/**
 * pr/view.ts — PR data fetching & display formatting (TS)
 *
 * Port dari `commands/review.js` (fetchPRData/getPRDiff) + `utils/display.js`
 * (formatReview/formatPR + visual helpers). Menyediakan layer data & rendering
 * yang dipakai oleh `./review.ts`.
 *
 * Visual helpers (stripAnsi, visualLength, padVisual, truncateVisual,
 * clearLastLines) di-import dari `../../utils/format` (shared cross-domain).
 */
import color from "picocolors";
import { ghExec, ghRaw } from "../gh";
import type { GHPullRequest } from "../../types";
import { padVisual, truncateVisual } from "../../utils/format";

/** Plain-string truncate untuk display ringkas (tanpa memperdulikan ANSI). */
export function truncate(str: string | null | undefined, maxLen = 50): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

/**
 * Fetch PR metadata via `gh pr view` (JSON fields incl. headRefOid).
 * @throws {Error} Kalau PR tidak ditemukan.
 */
export function fetchPRData(repo: string, prNumber: number | string): GHPullRequest & { repo?: string } {
  const pr = ghExec([
    "pr", "view", String(prNumber), "--repo", repo,
    "--json", "number,title,body,state,author,headRefName,headRefOid,baseRefName,createdAt,additions,deletions,files",
  ]) as GHPullRequest | null;
  if (!pr || !pr.number) {
    throw new Error(`PR #${prNumber} tidak ditemukan di ${repo}.`);
  }
  return {
    repo,
    number: pr.number,
    title: pr.title || "(no title)",
    body: pr.body || "",
    state: pr.state,
    author: pr.author || {},
    headRefName: pr.headRefName,
    headSha: pr.headRefOid,
    baseRefName: pr.baseRefName,
    createdAt: pr.createdAt,
    additions: pr.additions,
    deletions: pr.deletions,
    files: pr.files || [],
  };
}

/** Fetch PR diff sebagai raw text. */
export function getPRDiff(repo: string, prNumber: number | string): string {
  return ghRaw(["pr", "diff", String(prNumber), "--repo", repo]) || "";
}

/** Minimal shape yang dibutuhkan `formatPR` (superset aman dari PR list & detail). */
export interface PRListItem {
  number: number;
  title?: string;
  state?: string;
  author?: { login?: string } | null;
  [key: string]: unknown;
}

/** Format a PR object for list display. */
export function formatPR(pr: PRListItem): string {
  const stateIcon =
    pr.state === "OPEN" ? color.green("[OPEN]")
    : pr.state === "MERGED" ? color.magenta("[MERGE]")
    : color.red("[CLOSE]");
  const title = truncate(pr.title, 60);
  const author = pr.author?.login || "unknown";
  const number = `#${pr.number}`;
  return `${stateIcon} ${color.cyan(number.padEnd(7))} ${color.bold(title)} — ${color.dim(author)}`;
}

export interface ReviewMeta {
  model?: string | null;
  variant?: string | null;
  backend?: string;
  tokens?: { total?: number };
}

/**
 * Format a review block untuk terminal: bordered box + PR header + stats + body + footer.
 */
export function formatReview(reviewText: string, prData: Partial<GHPullRequest> = {}, meta: ReviewMeta = {}): string {
  const width = 60;
  const maxInnerWidth = width;
  const bar = color.dim("─".repeat(width));

  const num = prData.number != null ? `#${prData.number}` : "";
  const title = truncate(prData.title || "(no title)", 40);
  const headerLine = `║${color.bold(color.cyan(padVisual(truncateVisual(`${num} ${title}`.trim(), maxInnerWidth), maxInnerWidth)))}║`;

  const stats: string[] = [];
  if (prData.author?.login) stats.push(`author: ${prData.author.login}`);
  if (prData.state) stats.push(`state: ${prData.state}`);
  if (typeof prData.additions === "number") stats.push(`+${prData.additions}`);
  if (typeof prData.deletions === "number") stats.push(`-${prData.deletions}`);
  if (Array.isArray(prData.files)) stats.push(`files: ${prData.files.length}`);
  if (prData.createdAt) stats.push(`created: ${truncate(prData.createdAt, 10)}`);
  const statsText = stats.length ? truncateVisual(stats.join("  "), maxInnerWidth) : " ".repeat(maxInnerWidth);
  const statsLine = `║${color.dim(padVisual(statsText, maxInnerWidth))}║`;

  const bodyLines = String(reviewText || "(no review comment)").split("\n");
  const body = bodyLines
    .map((line) => `║ ${padVisual(truncateVisual(line, maxInnerWidth - 2), maxInnerWidth - 2)} ║`)
    .join("\n");

  const footer: string[] = [];
  if (meta && (meta.model != null || meta.tokens?.total != null)) {
    const model = meta.model || "(default)";
    const variantTag = meta.variant
      ? ` (variant: ${meta.variant})`
      : meta.backend
        ? ` (${meta.backend})`
        : "";
    const tokens = meta.tokens?.total != null
      ? ` · tokens: ${meta.tokens.total.toLocaleString("id-ID")}`
      : "";
    const footerStr = `Model: ${model}${variantTag}${tokens}`;
    footer.push(`║${color.dim(padVisual(truncateVisual(footerStr, maxInnerWidth), maxInnerWidth))}║`);
  }

  return [
    `╔${bar}╗`,
    headerLine,
    statsLine,
    `║${bar}║`,
    body,
    ...footer,
    `╚${bar}╝`,
  ].join("\n");
}