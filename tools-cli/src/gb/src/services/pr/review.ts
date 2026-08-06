/**
 * pr/review.ts — PR review orchestration (TS)
 *
 * Port dari `commands/review.js` + `utils/scheduler.js` (review log) yang
 * di-inline agar domain PR self-contained. Alur:
 *   fetchPRData + getPRDiff -> generateReview (../llm) -> (optional) publish
 *   -> recordReview -> return ReviewResult.
 *
 * Live-streaming: bila `options.live === true`, jalan `streamReview` yang
 * meng-airflow hasil LLM lewat `MarkdownStreamFormatter` (core/renderer.ts) dan
 * me-render progresif token-by-token — integrasi nyata dengan core engine.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { note, cancel, select, isCancel, text, confirm, spinner } from "@clack/prompts";
import color from "picocolors";
import { ghApi, ghExec, getCurrentRepo, selectRepo } from "../gh";
import { buildReviewPrompt, generateReview, stripAnsi } from "../llm";
import type { ReviewTokens } from "../llm";
import { fetchPRData, formatReview, getPRDiff } from "./view";
import { clearLastLines } from "../../utils/format";
import { MarkdownStreamFormatter } from "../../core/renderer";
import type { GHPullRequest } from "../../types";

// ─────────────────────────────────────────────────────────────────────────
// Review log (sumber: utils/scheduler.js — inlined)
// ─────────────────────────────────────────────────────────────────────────

type ReviewEntry = Record<string, unknown>;
type ReviewLog = Record<string, Record<string, ReviewEntry>>;

function reviewLogPath(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "goblin-vault", "gb-reviews.json");
}

function loadReviewLog(): ReviewLog {
  const file = reviewLogPath();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ReviewLog) : {};
  } catch {
    return {};
  }
}

function saveReviewLog(log: ReviewLog): void {
  const file = reviewLogPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(log, null, 2), "utf8");
  renameSync(tmp, file);
}

/** Cek apakah PR (pada headSha tertentu) sudah pernah di-review. */
function hasBeenReviewed(repo: string, prNumber: number | string, headSha?: string): boolean {
  const log = loadReviewLog();
  const entry = log[repo]?.[String(prNumber)];
  if (!entry) return false;
  if (headSha && entry.headSha && entry.headSha !== headSha) return false;
  return true;
}

function recordReview(repo: string, prNumber: number | string, metadata: ReviewEntry): ReviewEntry {
  const log = loadReviewLog();
  const repoLog = { ...(log[repo] || {}) };
  const entry: ReviewEntry = { lastReviewedAt: new Date().toISOString(), ...metadata };
  repoLog[String(prNumber)] = entry;
  saveReviewLog({ ...log, [repo]: repoLog });
  return entry;
}

// ─────────────────────────────────────────────────────────────────────────
// Publish
// ─────────────────────────────────────────────────────────────────────────

/** Post review sebagai komentar resmi GitHub PR via REST. Tidak throw pada gagal. */
export function publishReview(
  repo: string,
  prNumber: number | string,
  reviewText: string
): { ok: boolean; id?: number; error?: string } {
  try {
    const res = ghApi<{ id?: number; message?: string }>(`/repos/${repo}/pulls/${prNumber}/reviews`, {
      method: "POST",
      body: { body: reviewText, event: "COMMENT" },
    });
    if (res?.id) return { ok: true, id: res.id };
    const apiErr = res?.message || "response tanpa review ID";
    return { ok: false, error: `GitHub API mengembalikan response tanpa review ID: ${String(apiErr).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Sync review path (ports reviewPR / autoReviewAll)
// ─────────────────────────────────────────────────────────────────────────

export interface ReviewOptions {
  repo?: string;
  publish?: boolean;
  force?: boolean;
  model?: string | null;
  variant?: string | null;
  useOmp?: boolean;
  backend?: string;
  live?: boolean;
}

export interface ReviewResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  prNumber?: number;
  review?: string;
  prompt?: string;
  model?: string | null;
  variant?: string | null;
  backend?: string;
  tokens?: ReviewTokens;
  prData?: GHPullRequest & { repo?: string };
  published?: boolean;
  publishError?: string;
  error?: string;
}

/**
 * Review satu PR: fetch meta + diff, generate review AI, publish (opsional),
 * dan catat ke review log.
 */
export async function reviewPR(prNumber: number | string, options: ReviewOptions = {}): Promise<ReviewResult> {
  const repo = options.repo || getCurrentRepo();
  if (!repo) {
    return { ok: false, error: "Tidak ada repo aktif. Pilih repo dulu." };
  }
  const n = Number(prNumber);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, prNumber: n, error: `Nomor PR tidak valid: "${prNumber}"` };
  }

  try {
    const prData = fetchPRData(repo, n);

    if (!options.force && hasBeenReviewed(repo, n, (prData as { headSha?: string }).headSha)) {
      return {
        ok: true,
        skipped: true,
        prData,
        reason: `PR #${n} sudah di-review untuk commit ${String((prData as { headSha?: string }).headSha || "").slice(0, 7)}. Gunakan --force untuk review ulang.`,
      };
    }

    const diff = getPRDiff(repo, n);

    let generated: ReturnType<typeof generateReview>;
    if (options.live) {
      const raw = await streamLLM(buildReviewPrompt(prData, diff), options);
      const review = stripAnsi(raw);
      generated = {
        review,
        prompt: buildReviewPrompt(prData, diff),
        model: options.model || null,
        variant: options.variant || null,
        backend: options.useOmp ? "omp" : "opencode",
        thinking: "",
        tokens: {
          prompt: Math.ceil(buildReviewPrompt(prData, diff).length / 4),
          completion: Math.ceil(review.length / 4),
          total: 0,
        },
      };
      generated.tokens.total = generated.tokens.prompt + generated.tokens.completion;
    } else {
      generated = generateReview(prData, diff, options);
    }

    const result: ReviewResult = {
      ok: true,
      skipped: false,
      review: generated.review,
      prompt: generated.prompt,
      model: generated.model,
      variant: generated.variant,
      backend: generated.backend,
      tokens: generated.tokens,
      prData,
      published: false,
    };
    if (options.publish) {
      const pub = publishReview(repo, n, generated.review);
      result.published = pub.ok;
      if (!pub.ok) result.publishError = pub.error || "unknown error";
    }

    recordReview(repo, n, {
      headSha: (prData as { headSha?: string }).headSha,
      status: prData.state,
      published: result.published,
      model: generated.model,
      variant: generated.variant,
      backend: generated.backend,
      tokens: generated.tokens,
      ...(result.publishError ? { publishError: result.publishError } : {}),
    });

    return result;
  } catch (err) {
    return { ok: false, prNumber: n, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Batch / scheduled review semua open PRs. Skips yang SHA-nya sudah tercatat.
 */
export async function autoReviewAll(options: ReviewOptions = {}): Promise<{
  ok: boolean;
  total: number;
  reviewed: number[];
  skipped: number[];
  failed: Array<{ number: number; error: string }>;
  publishFailed: Array<{ number: number; error: string }>;
  error?: string;
}> {
  const repo = options.repo || getCurrentRepo();
  const empty = {
    ok: false,
    total: 0,
    reviewed: [] as number[],
    skipped: [] as number[],
    failed: [] as Array<{ number: number; error: string }>,
    publishFailed: [] as Array<{ number: number; error: string }>,
  };
  if (!repo) {
    return { ...empty, error: "Tidak ada repo aktif. Pilih repo dulu." };
  }

  const prs = ghExec(["pr", "list", "--repo", repo, "--state", "OPEN", "--json", "number,title,headRefOid"]) as
    Array<{ number: number; title?: string; headRefOid?: string }> | null;
  if (!Array.isArray(prs) || prs.length === 0) {
    return { ok: true, total: 0, reviewed: [], skipped: [], failed: [], publishFailed: [] };
  }

  const summary = {
    ok: true,
    total: prs.length,
    reviewed: [] as number[],
    skipped: [] as number[],
    failed: [] as Array<{ number: number; error: string }>,
    publishFailed: [] as Array<{ number: number; error: string }>,
  };
  for (const pr of prs) {
    if (!options.force && hasBeenReviewed(repo, pr.number, pr.headRefOid)) {
      summary.skipped.push(pr.number);
      continue;
    }
    const res = await reviewPR(pr.number, {
      repo,
      publish: options.publish,
      force: options.force,
      model: options.model,
      variant: options.variant,
      useOmp: options.useOmp,
      backend: options.backend,
      live: options.live,
    });
    if (res.ok && !res.skipped) {
      summary.reviewed.push(pr.number);
      if (res.publishError) summary.publishFailed.push({ number: pr.number, error: res.publishError });
    } else if (res.ok && res.skipped) {
      summary.skipped.push(pr.number);
    } else {
      summary.failed.push({ number: pr.number, error: res.error || "unknown" });
    }
  }
  return summary;
}

// ─────────────────────────────────────────────────────────────────────────
// Live streaming (integrasi core/renderer.ts MarkdownStreamFormatter)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Stream LLM response token-by-token via MarkdownStreamFormatter.
 * Meng-spawn backend LLM (`opencode` atau `omp`) dengan stdout piped, mem-format
 * setiap chunk dengan MarkdownStreamFormatter (core engine), dan merender
 * progresif. Mengembalikan teks mentah (raw, unbuffered) untuk review final.
 */
export async function streamLLM(prompt: string, options: ReviewOptions = {}): Promise<string> {
  const usesOmp = options.useOmp === true || options.backend === "omp";
  const formatter = new MarkdownStreamFormatter();
  const chunks: string[] = [];
  let tmpFile: string | null = null;

  return new Promise<string>((resolvePromise, rejectPromise) => {
    let child: ReturnType<typeof spawn>;
    if (usesOmp) {
      tmpFile = path.join(os.tmpdir(), `gb-live-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
      writeFileSync(tmpFile, prompt, "utf8");
      const args = ["-p", `@${tmpFile}`, "--no-session", "--hide-thinking"];
      if (options.model) args.push(`--model=${options.model}`);
      child = spawn("omp", args, { stdio: ["ignore", "pipe", "pipe"] });
    } else {
      child = spawn("opencode", ["run"], { stdio: ["pipe", "pipe", "pipe"] });
      child.stdin!.write(prompt);
      child.stdin!.end();
    }

    process.stdout.write("\x1b[?25l"); // hide cursor
    child.stdout!.on("data", (d: Buffer) => {
      const chunk = d.toString();
      chunks.push(chunk);
      const rendered = formatter.processChunk(chunk);
      if (rendered) process.stdout.write(rendered);
    });
    child.stderr!.on("data", (d: Buffer) => {
      const line = d.toString().trim();
      if (line) process.stderr.write(`\x1b[90m…${line.split("\n")[0]}\x1b[0m\n`);
    });
    child.on("error", (err) => {
      process.stdout.write("\x1b[?25h");
      if (tmpFile) {
        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }
      }
      rejectPromise(err);
    });
    child.on("close", (code) => {
      const flushed = formatter.flush();
      if (flushed) process.stdout.write(flushed);
      process.stdout.write("\x1b[?25h"); // restore cursor
      if (tmpFile) {
        try {
          unlinkSync(tmpFile);
        } catch {
          // ignore
        }
      }
      let raw = chunks.join("").trim();
      if (code === 0 && raw) {
        resolvePromise(raw);
      } else if (code !== 0) {
        rejectPromise(new Error(`LLM live backend exit ${code}`));
      } else {
        rejectPromise(new Error("LLM live backend mengembalikan output kosong"));
      }
    });
  });
}

/** Show one review result (interactive terminal). */
export async function showReviewResult(res: ReviewResult): Promise<void> {
  if (!res.ok) {
    cancel(color.red(res.error || "unknown error"));
    clearLastLines(2);
    return;
  }
  if (res.skipped) {
    note(color.yellow(res.reason || "skipped"), "Skipped");
    return;
  }
  console.log(
    formatReview(res.review || "(no review)", res.prData || {}, {
      model: res.model,
      variant: res.variant,
      backend: res.backend,
      tokens: res.tokens,
    })
  );
  if (res.published) {
    note(color.green(`Review PR #${res.prData?.number} dipublikasikan ke GitHub.`), "Published");
  } else if (res.publishError) {
    note(color.yellow(`Review gagal dipublish ke GitHub: ${res.publishError}`), "Publish Failed");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TUI Menu (reviewMenu) — port dari commands/review.js
// ─────────────────────────────────────────────────────────────────────────

async function continuePrompt(): Promise<void> {
  const res = await text({ message: "Tekan Enter untuk lanjut...", placeholder: "" });
  void res;
}

/** Tampilkan ringkasan batch review (interaktif). */
async function showBatchSummary(summary: {
  ok: boolean;
  total: number;
  reviewed: number[];
  skipped: number[];
  failed: Array<{ number: number; error: string }>;
  publishFailed: Array<{ number: number; error: string }>;
  error?: string;
}): Promise<void> {
  if (!summary.ok) {
    cancel(color.red(summary.error || "unknown error"));
    clearLastLines(2);
    return;
  }
  const parts: string[] = [];
  if (summary.reviewed.length) parts.push(color.green(`Reviewed: ${summary.reviewed.length}`));
  if (summary.skipped.length) parts.push(color.yellow(`Skipped: ${summary.skipped.length}`));
  if (summary.publishFailed.length) parts.push(color.yellow(`Publish Failed: ${summary.publishFailed.length}`));
  if (summary.failed.length) parts.push(color.red(`Failed: ${summary.failed.length}`));
  note(parts.join("  ") || color.dim("Tidak ada open PR."), "Summary");
  if (summary.publishFailed.length) {
    summary.publishFailed.forEach((f) => note(color.yellow(f.error), `PR #${f.number} gagal publish`));
  }
  if (summary.failed.length) {
    summary.failed.forEach((f) => note(color.red(f.error), `PR #${f.number} gagal`));
  }
}

/** Review satu PR via prompt interaktif. */
async function runSingleInteractive(repo: string): Promise<void> {
  const numStr = await text({ message: "Nomor PR:", placeholder: "e.g. 12" });
  if (isCancel(numStr) || !String(numStr).trim()) {
    clearLastLines(2);
    return;
  }

  const shouldPublish = await confirm({
    message: "Post hasil review sebagai komentar resmi GitHub?",
    initialValue: false,
  });
  if (isCancel(shouldPublish)) {
    clearLastLines(2);
    return;
  }

  const res = await reviewPR(String(numStr).trim(), { repo, publish: Boolean(shouldPublish) });
  await showReviewResult(res);
}

/** Review semua open PRs via prompt interaktif. */
async function runAutoInteractive(repo: string): Promise<void> {
  const s = spinner();
  s.start("Fetching open PRs...");
  const prs = ghExec([
    "pr", "list", "--repo", repo, "--state", "OPEN",
    "--json", "number,title",
  ]) as Array<{ number: number; title?: string }> | null;
  s.stop(`Found ${prs?.length || 0} open PRs`);
  if (!Array.isArray(prs) || prs.length === 0) {
    note(color.dim("Tidak ada open PR untuk di-review."), "Empty");
    await continuePrompt();
    return;
  }

  const shouldPublish = await confirm({
    message: "Post hasil review ke GitHub sebagai komentar resmi?",
    initialValue: false,
  });
  if (isCancel(shouldPublish)) {
    clearLastLines(2);
    return;
  }

  s.start("Reviewing open PRs...");
  const summary = await autoReviewAll({ repo, publish: Boolean(shouldPublish) });
  s.stop("Done");
  await showBatchSummary(summary);
}

/**
 * Menu interaktif AI Review untuk dipanggil dari TUI.
 * @param repo - Repo aktif; kalau kosong, auto-detect atau minta pilih.
 */
export async function reviewMenu(repo?: string): Promise<void> {
  let activeRepo = repo;
  if (!activeRepo) {
    activeRepo = getCurrentRepo() || undefined;
  }
  if (!activeRepo) {
    note(color.dim("Belum ada repo aktif. Pilih repo dulu:"), "Repo Required");
    const picked = await selectRepo("Pilih repository:");
    if (!picked) {
      clearLastLines(2);
      return;
    }
    return await reviewMenu(picked);
  }

  while (true) {
    const action = await select<{ value: string; label: string; hint?: string }[], string>({
      message: `AI Review — ${color.cyan(activeRepo)}`,
      options: [
        { value: "all", label: "Review Semua Open PRs", hint: "batch" },
        { value: "single", label: "Review PR Tertentu", hint: "manual" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    if (action === "all") {
      await runAutoInteractive(activeRepo);
    } else if (action === "single") {
      await runSingleInteractive(activeRepo);
    }
  }
}