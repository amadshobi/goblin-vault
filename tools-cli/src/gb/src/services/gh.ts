/**
 * gh.ts — GitHub Client service (TS)
 *
 * Port dari `utils/gh.js`. Membungkus binary `gh` via spawnSync (array argv,
 * tanpa shell) sehingga aman dari shell injection. Menyediakan:
 *   - ghSpawn / ghExec / ghRaw  : jalankan `gh` (argv, JSON, raw)
 *   - ghApi                     : GitHub REST API via `gh api` (stdin payload)
 *   - getCurrentRepo            : repo aktif dari CWD
 *   - selectRepo                : pilih repo interaktif (Clack)
 *
 * Service ini TIDAK bergantung pada UI layer lain — reusable & self-contained.
 */
import { spawnSync } from "node:child_process";
import { cancel, note, select, spinner, isCancel } from "@clack/prompts";
import color from "picocolors";
import type { GHExecOptions, GHApiOptions } from "../types";
import { clearLastLines } from "../utils/format";

const GH_TIMEOUT = 30_000;
const SUPPORTED_METHODS = ["GET", "POST", "PATCH", "DELETE"] as const;

/**
 * Low-level runner: spawn `gh` with an argv array (no shell).
 * @throws {Error} Kalau `gh` error dan tidak `silent`.
 */
export function ghSpawn(args: Array<string | number>, opts: GHExecOptions = {}): string | null {
  if (!Array.isArray(args) || args.some((a) => typeof a !== "string" && typeof a !== "number")) {
    throw new Error("ghSpawn: args harus berupa array argv (string/number), bukan string command.");
  }
  const r = spawnSync("gh", args.map(String), {
    input: opts.input,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: opts.timeout || GH_TIMEOUT,
  });
  if (r.error) {
    if (opts.silent) return null;
    throw new Error(`gh error: ${r.error.message}`);
  }
  if (r.status !== 0) {
    if (opts.silent) return null;
    const msg = (r.stderr || r.stdout || "").trim() || `exit ${r.status}`;
    throw new Error(`gh error: ${msg}`);
  }
  return r.stdout || "";
}

/** Run `gh` with JSON output and parse. Returns parsed JSON, raw string, or null. */
export function ghExec(args: Array<string | number>, opts: GHExecOptions = {}): unknown {
  const out = ghSpawn(args, opts);
  if (opts.raw) return out;
  if (out == null) return null;
  try {
    const trimmed = out.trim();
    return trimmed ? JSON.parse(trimmed) : null;
  } catch (err) {
    throw new Error(`gh error: gagal parse output: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Run `gh` and return raw output (display, diffs, paging). */
export function ghRaw(args: Array<string | number>, opts: GHExecOptions = {}): string | null {
  return ghExec(args, { ...opts, raw: true }) as string | null;
}

/**
 * Call GitHub REST API via `gh api`. Payload body dikirim via stdin (`--input -`).
 */
export function ghApi<T = unknown>(endpoint: string, opts: GHApiOptions = {}): T {
  if (!endpoint || typeof endpoint !== "string") {
    throw new Error("ghApi: endpoint wajib diisi (e.g. /repos/{owner}/{repo}/issues)");
  }
  const method = (opts.method || "GET").toUpperCase();
  if (!SUPPORTED_METHODS.includes(method as (typeof SUPPORTED_METHODS)[number])) {
    throw new Error(`ghApi: method "${opts.method}" tidak didukung. Gunakan GET, POST, PATCH, atau DELETE.`);
  }

  const args: Array<string | number> = ["api", endpoint];
  if (method !== "GET") args.push("-X", method);

  const execOpts: GHExecOptions = {};
  if (opts.body != null) {
    args.push("--input", "-");
    execOpts.input = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  } else if (opts.fields) {
    for (const [key, value] of Object.entries(opts.fields)) {
      args.push("--field", `${key}=${value}`);
    }
  }

  const out = ghSpawn(args, { ...execOpts, silent: opts.silent, timeout: opts.timeout });
  if (opts.raw) return out as T;
  if (out == null) return null as T;
  try {
    const trimmed = out.trim();
    return (trimmed ? JSON.parse(trimmed) : null) as T;
  } catch (err) {
    throw new Error(`gh api error: gagal parse output: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Get current repository (owner/name) from CWD. */
export function getCurrentRepo(): string | null {
  const out = ghRaw(["repo", "view", "--json", "nameWithOwner"], { silent: true });
  if (out) {
    try {
      const parsed = JSON.parse(out) as { nameWithOwner?: string };
      if (parsed?.nameWithOwner) return parsed.nameWithOwner;
    } catch {
      // ignore — fall through to null
    }
  }
  return null;
}

/** Pick a repository interactively via Clack. */
export async function selectRepo(message = "Pilih repository:"): Promise<string | null> {
  const s = spinner();
  s.start("Fetching repos...");
  try {
    const repos = ghExec(["repo", "list", "--limit", "50", "--json", "nameWithOwner"]) as
      Array<{ nameWithOwner: string }> | null;
    s.stop("Repos fetched");
    if (!repos || repos.length === 0) {
      cancel(color.red("Tidak ada repository ditemukan."));
      clearLastLines(2);
      return null;
    }
    const selected = await select({
      message,
      options: repos.map((r) => ({ value: r.nameWithOwner, label: r.nameWithOwner })),
    });
    if (isCancel(selected)) {
      clearLastLines(2);
      return null;
    }
    return selected as string;
  } catch (err) {
    s.stop("Error");
    note(color.red(`Gagal fetch repos: ${err instanceof Error ? err.message : String(err)}`), "Error");
    clearLastLines(2);
    return null;
  }
}