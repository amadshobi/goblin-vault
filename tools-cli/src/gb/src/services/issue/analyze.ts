/**
 * issue/analyze.ts — Issue analysis service (TS)
 *
 * Fondasi modular untuk analisis isu: triase/labeling, penghitungan statistik
 * backlog, klasifikasi severity, dan AI Deep Technical Analysis via LLM.
 */
import { streamLLM, estimateTokens } from "../llm";
import { getSystemPrompt } from "../../config/prompts";
import { recordLLMLog } from "../logger";
import type { GHIssue } from "../../types";

export type Severity = "critical" | "warning" | "normal" | "info";

export interface IssueSeverity {
  number: number;
  title: string;
  severity: Severity;
  reason: string;
}

export interface IssueStats {
  total: number;
  open: number;
  closed: number;
  byLabel: Record<string, number>;
  byAuthor: Record<string, number>;
}

export interface IssueAnalysisResult {
  analysis: string;
  prompt: string;
  tokens: { prompt: number; completion: number; total: number };
}

/** Kata-kunci penanda isu (case-insensitive) untuk klasifikasi cepat. */
const SEVERITY_KEYWORDS: Record<Exclude<Severity, "normal">, RegExp> = {
  critical: /\b(securit|auth|password|credential|data loss|crash|panic|regression|blocker)\b/i,
  warning: /\b(perf|performance|memory leak|deadlock|race|timeout|flaky|deprecat)\b/i,
  info: /\b(doc|docs|typo|refactor|cleanup|enhancement|test)\b/i,
};

/** Klasifikasikan satu issue berdasar title+body/labels. Pure function. */
export function classifyIssue(issue: GHIssue): IssueSeverity {
  const haystack = `${issue.title || ""} ${issue.body || ""} ${(issue.labels || []).map((l) => l.name).join(" ")}`;
  const raw = haystack.toLowerCase();

  if (SEVERITY_KEYWORDS.critical.test(haystack) || raw.includes("critical")) {
    return { number: issue.number, title: issue.title || "", severity: "critical", reason: "cocok kata kunci kritikal" };
  }
  if (SEVERITY_KEYWORDS.warning.test(haystack)) {
    return { number: issue.number, title: issue.title || "", severity: "warning", reason: "cocok kata kunci warning" };
  }
  if (SEVERITY_KEYWORDS.info.test(haystack)) {
    return { number: issue.number, title: issue.title || "", severity: "info", reason: "cocok kata kunci info" };
  }
  return { number: issue.number, title: issue.title || "", severity: "normal", reason: "tanpa kata kunci khusus" };
}

/** Analisis statistik sekumpulan issue. Immutable — tidak memutasi input. */
export function analyzeIssues(issues: readonly GHIssue[]): { stats: IssueStats; severities: IssueSeverity[] } {
  const stats: IssueStats = { total: issues.length, open: 0, closed: 0, byLabel: {}, byAuthor: {} };

  const severities: IssueSeverity[] = [];
  for (const issue of issues) {
    if (issue.state === "OPEN") stats.open += 1;
    else stats.closed += 1;

    for (const label of issue.labels || []) {
      stats.byLabel[label.name] = (stats.byLabel[label.name] || 0) + 1;
    }
    const author = issue.author?.login || "unknown";
    stats.byAuthor[author] = (stats.byAuthor[author] || 0) + 1;

    severities.push(classifyIssue(issue));
  }

  return { stats, severities };
}

/** Ringkasan backlog yang mudah dibaca (untuk TUI/CLI/notifikasi). */
export function summarizeBacklog(issues: readonly GHIssue[]): string {
  const { stats, severities } = analyzeIssues(issues);
  const lines = [
    `Total: ${stats.total} isu (open: ${stats.open}, closed: ${stats.closed})`,
  ];
  if (stats.byLabel && Object.keys(stats.byLabel).length) {
    const top = Object.entries(stats.byLabel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");
    lines.push(`Label teratas: ${top || "-"}`);
  }
  const critical = severities.filter((s) => s.severity === "critical").length;
  const warning = severities.filter((s) => s.severity === "warning").length;
  lines.push(`Severity: ${critical} critical, ${warning} warning.`);
  return lines.join("\n");
}

/**
 * Melakukan AI Deep Technical Analysis pada Issue menggunakan OMP StreamLLM & System Prompt khusus
 */
export async function analyzeIssueWithAI(
  issue: GHIssue,
  options: { model?: string; variant?: string; high?: boolean; medium?: boolean; low?: boolean } = {}
): Promise<IssueAnalysisResult> {
  const systemPrompt = getSystemPrompt("issue-analyze");
  const userPrompt = [
    `TITLE: ${issue.title || "(untitled)"}`,
    `AUTHOR: ${issue.author?.login || "unknown"}`,
    `LABELS: ${(issue.labels || []).map((l) => l.name).join(", ") || "(none)"}`,
    "",
    "DESCRIPTION:",
    issue.body || "(no description)",
  ].join("\n");

  const rawAnalysis = await streamLLM(userPrompt, {
    systemPrompt,
    model: options.model,
    variant: options.variant,
    high: options.high,
    medium: options.medium,
    low: options.low,
  });

  const promptTokens = estimateTokens(userPrompt);
  const completionTokens = estimateTokens(rawAnalysis);

  recordLLMLog({
    type: "issue-analyze",
    number: issue.number,
    model: options.model || "default",
    variant: options.variant || (options.high ? "high" : options.low ? "low" : "medium"),
    inputTokens: promptTokens,
    outputTokens: completionTokens,
  });

  return {
    analysis: rawAnalysis,
    prompt: userPrompt,
    tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
  };
}
