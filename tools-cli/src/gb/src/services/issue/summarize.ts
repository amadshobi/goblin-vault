/**
 * issue/summarize.ts — Issue summarization service (TS)
 *
 * Fondasi modular: mengambil issue + komentar, membangun prompt ringkas dalam
 * Bahasa Indonesia, dan mendelegasikan ke LLM via `../llm.ts` (`callLLM`).
 *
 * Ini fondasi — tidak terikat ke UI; callable dari mana saja (TUI, CLI, scheduler).
 */
import { callLLM, estimateTokens } from "../llm";
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
    "You are a concise issue summarizer. Summarize the GitHub issue below in Bahasa Indonesia.",
    "Output: 1) ringkasan masalah (2-3 kalimat), 2) langkah reproduksi (bila ada),",
    "3) konteks/kesepakatan dari komentar (bila ada), 4) saran next step. Direct, no fluff.",
    "",
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
export async function summarizeIssue(issue: GHIssue, options: { model?: string | null; variant?: string | null } = {}): Promise<IssueSummary> {
  const prompt = buildSummaryPrompt(issue);

  const { text, backend, model } = callLLM(prompt, {
    model: options.model,
    variant: options.variant ?? undefined,
  });

  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(text);
  return {
    summary: text,
    prompt,
    model,
    backend,
    tokens: { prompt: promptTokens, completion: completionTokens, total: promptTokens + completionTokens },
  };
}