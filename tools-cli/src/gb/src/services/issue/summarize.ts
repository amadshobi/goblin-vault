/**
 * issue/summarize.ts — Issue summarization service (TS)
 *
 * Fondasi modular: mengambil issue + komentar, membangun prompt ringkas dalam
 * Bahasa Indonesia, dan mendelegasikan ke LLM via `../llm.ts` (`streamLLM`).
 */
import { callLLM, streamLLM, estimateTokens } from "../llm";
import { getSystemPrompt } from "../../config/prompts";
import { recordLLMLog } from "../logger";
import type { GHIssue } from "../../types";

export interface IssueSummary {
  summary: string;
  prompt: string;
  model: string | null;
  backend: string;
  tokens: { prompt: number; completion: number; total: number };
}

/** Build a summarization prompt from issue metadata + comments. */
export function buildSummaryPrompt(issue: GHIssue, commentsLimit = 10): string {
  const title = issue.title || "(untitled)";
  const body = issue.body || "(no description)";
  const author = issue.author?.login || "unknown";
  const labels = issue.labels?.length ? issue.labels.map((l) => l.name).join(", ") : "(none)";

  const comments = (issue.comments || [])
    .slice(0, commentsLimit)
    .map((c) => `- ${c.author?.login || "unknown"} (${c.createdAt || "?"}): ${(c.body || "").slice(0, 500)}`)
    .join("\n");

  return [
    `TITLE: ${title}`,
    `AUTHOR: ${author}`,
    `LABELS: ${labels}`,
    "",
    "DESCRIPTION:",
    body,
    "",
    comments ? `COMMENTS:\n${comments}` : "COMMENTS: (none)",
  ].join("\n");
}

/**
 * Summarize an issue.
 * @throws {Error} Kalau LLM backend gagal.
 */
export async function summarizeIssue(
  issue: GHIssue,
  options: { model?: string | null; variant?: string | null; stream?: boolean; high?: boolean; medium?: boolean; low?: boolean } = {}
): Promise<IssueSummary> {
  const prompt = buildSummaryPrompt(issue);
  const systemPrompt = getSystemPrompt("issue-summarize");
  const isStream = options.stream !== false;

  let text = "";
  let backend = "omp";
  let model = options.model || null;

  if (isStream) {
    text = await streamLLM(prompt, {
      systemPrompt,
      model: options.model ?? undefined,
      variant: options.variant ?? undefined,
      high: options.high,
      medium: options.medium,
      low: options.low,
    });
  } else {
    const res = callLLM(prompt, {
      model: options.model,
      variant: options.variant ?? undefined,
    });
    text = res.text;
    backend = res.backend;
    model = res.model;
  }

  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(text);

  recordLLMLog({
    type: "issue-summarize",
    number: issue.number,
    model: model || "default",
    variant: options.variant || (options.high ? "high" : options.low ? "low" : "medium"),
    inputTokens: promptTokens,
    outputTokens: completionTokens,
  });

  return {
    summary: text,
    prompt,
    model,
    backend,
    tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
  };
}
