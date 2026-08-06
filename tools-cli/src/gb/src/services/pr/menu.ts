/**
 * pr/menu.ts — GitHub Pull Request TUI menu (TS)
 *
 * Port dari `commands/pr.js` (kecuali reviewMenu). Domain ini handle
 * PR CRUD interaktif: list / view / checkout / approve / merge / close /
 * create. AI review di-delegasi ke `../review` (reviewMenu).
 *
 * Backed by:
 *   - formatPR, truncate -> services/pr/view.ts
 *   - clearLastLines     -> utils/format
 *   - ghExec, ghRaw      -> services/gh
 *   - continuePrompt     -> services/issue/view
 *   - showInPager        -> services/issue/view
 */
import { cancel, isCancel, note, select, spinner, text } from "@clack/prompts";
import color from "picocolors";
import { ghExec, ghRaw } from "../gh";
import { clearLastLines } from "../../utils/format";
import { continuePrompt, showInPager } from "../issue/view";
import { formatPR } from "./view";
import { reviewMenu } from "./review";

interface GHPullRequestSummary {
  number: number;
  title?: string;
  state?: string;
  author?: { login?: string } | null;
  headRefName?: string;
  createdAt?: string;
  [key: string]: unknown;
}

interface GHPullRequestDetail extends GHPullRequestSummary {
  body?: string | null;
  baseRefName?: string;
  mergedAt?: string | null;
  additions?: number;
  deletions?: number;
  files?: Array<{ path?: string; status?: string; additions?: number; deletions?: number }>;
  reviews?: Array<{ author?: { login?: string }; state?: string; body?: string | null }>;
}

/** List PRs by state (default OPEN). */
export async function listPRs(repo: string, state = "OPEN"): Promise<GHPullRequestSummary[]> {
  const s = spinner();
  s.start(`Fetching ${state} PRs...`);
  try {
    const prs = ghExec([
      "pr", "list", "--repo", repo, "--state", state,
      "--json", "number,title,state,author,headRefName,createdAt",
    ]) as GHPullRequestSummary[] | null;
    s.stop(`Found ${prs?.length || 0} PRs`);
    if (!prs || prs.length === 0) {
      note(`No ${state.toLowerCase()} PRs found.`, "PRs");
      return [];
    }
    return prs;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return [];
  }
}

/** View PR detail (pager). */
export async function viewPR(repo: string, prNumber: number | string): Promise<GHPullRequestDetail | null> {
  const s = spinner();
  s.start("Fetching PR details...");
  try {
    const pr = ghExec([
      "pr", "view", String(prNumber), "--repo", repo,
      "--json", "number,title,state,body,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,files,reviews",
    ]) as GHPullRequestDetail | null;
    s.stop("Done");

    if (!pr) {
      note("PR tidak ditemukan.", `PR #${prNumber}`);
      return null;
    }

    let output = `#${pr.number} ${pr.title}\n`;
    output += `State: ${pr.state} | Author: ${pr.author?.login} | Branch: ${pr.headRefName} → ${pr.baseRefName}\n`;
    output += `+${pr.additions ?? 0} -${pr.deletions ?? 0} lines | Created: ${pr.createdAt}\n`;
    if (pr.mergedAt) output += `Merged: ${pr.mergedAt}\n`;
    output += "\n" + "-".repeat(60) + "\n\n";
    output += pr.body || "(no description)";

    if (pr.reviews?.length) {
      output += "\n\n" + "-".repeat(60) + "\nREVIEWS:\n";
      pr.reviews.forEach((r) => {
        output += `  ${r.author?.login || "unknown"}: ${r.state} (${(r.body || "no comment").slice(0, 100)})\n`;
      });
    }

    if (pr.files?.length) {
      output += "\n\n" + "-".repeat(60) + "\nFILES CHANGED:\n";
      pr.files.forEach((f) => {
        const prefix = f.status === "added" ? "+" : f.status === "removed" ? "-" : "~";
        output += `  ${prefix} ${f.path} (+${f.additions ?? 0}/-${f.deletions ?? 0})\n`;
      });
    }

    showInPager(output, `PR #${pr.number}`);
    return pr;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return null;
  }
}

/** Checkout PR lokal. */
export async function checkoutPR(repo: string, prNumber: number | string): Promise<boolean> {
  const s = spinner();
  s.start(`Checking out PR #${prNumber}...`);
  try {
    const out = ghRaw(["pr", "checkout", String(prNumber), "--repo", repo]);
    s.stop("Done");
    note(out || "checked out", "Checkout");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Approve PR via `gh pr review --approve`. */
export async function approvePR(repo: string, prNumber: number | string): Promise<boolean> {
  const s = spinner();
  s.start(`Approving PR #${prNumber}...`);
  try {
    const out = ghRaw(["pr", "review", String(prNumber), "--repo", repo, "--approve"]);
    s.stop("Approved");
    note(out || "approved", "Approval");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Merge PR via `gh pr merge --merge`. */
export async function mergePR(repo: string, prNumber: number | string): Promise<boolean> {
  const s = spinner();
  s.start(`Merging PR #${prNumber}...`);
  try {
    const out = ghRaw(["pr", "merge", String(prNumber), "--repo", repo, "--merge"]);
    s.stop("Merged");
    note(out || "merged", "Merge");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Close PR (with confirmation). */
export async function closePR(repo: string, prNumber: number | string): Promise<boolean> {
  const confirmed = await text({
    message: `Close PR #${prNumber} without merging? (yes/no)`,
    placeholder: "no",
    initialValue: "no",
  });
  if (isCancel(confirmed)) {
    clearLastLines(2);
    return false;
  }
  if (String(confirmed).trim().toLowerCase() !== "yes") {
    note("Cancelled.", "Close");
    return false;
  }

  const s = spinner();
  s.start(`Closing PR #${prNumber}...`);
  try {
    const out = ghRaw(["pr", "close", String(prNumber), "--repo", repo]);
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

/** Create PR interaktif. */
export async function createPR(repo: string): Promise<boolean> {
  const head = await text({
    message: "Branch source (head):",
    placeholder: "feature/my-feature",
  });
  if (isCancel(head)) {
    clearLastLines(2);
    return false;
  }
  const base = await text({
    message: "Branch target (base):",
    placeholder: "main",
    initialValue: "main",
  });
  if (isCancel(base)) {
    clearLastLines(2);
    return false;
  }
  const title = await text({
    message: "Judul PR:",
    placeholder: "Add amazing feature",
  });
  if (isCancel(title)) {
    clearLastLines(2);
    return false;
  }
  const body = await text({
    message: "Deskripsi (optional):",
    placeholder: "Closes #...",
  });
  if (isCancel(body)) {
    clearLastLines(2);
    return false;
  }

  const s = spinner();
  s.start("Creating PR...");
  try {
    const args: Array<string | number> = [
      "pr", "create", "--repo", repo,
      "--head", String(head), "--base", String(base), "--title", String(title),
    ];
    if (String(body).trim()) args.push("--body", String(body));
    const out = ghRaw(args);
    s.stop("PR Created");
    note(out || "created", "New PR");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Pilih PR dari list interaktif. */
export async function selectPR(prs: GHPullRequestSummary[]): Promise<number | null> {
  const selected = await select<{ value: number; label: string }[], number>({
    message: "Pilih PR:",
    options: prs.map((pr) => ({
      value: pr.number,
      label: formatPR(pr),
    })),
  });
  if (isCancel(selected)) {
    clearLastLines(2);
    return null;
  }
  return Number(selected);
}

/** TUI menu utama untuk domain PR. */
export async function prMenu(repo: string): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string; hint?: string }[], string>({
      message: `PR — ${color.cyan(repo)}`,
      options: [
        { value: "listOpen", label: "List Open PRs" },
        { value: "listClosed", label: "List Closed/Merged PRs" },
        { value: "view", label: "View PR Details" },
        { value: "checkout", label: "Checkout PR" },
        { value: "approve", label: "Approve PR" },
        { value: "merge", label: "Merge PR" },
        { value: "close", label: "Close PR" },
        { value: "create", label: "Create PR" },
        { value: "aiReview", label: "Review PR (AI)", hint: "generate + publish" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    if (action === "listOpen" || action === "listClosed") {
      const state = action === "listOpen" ? "OPEN" : "CLOSED";
      const prs = await listPRs(repo, state);
      if (prs.length > 0) {
        const listStr = prs.map((p) => `  ${formatPR(p)}`).join("\n");
        note(listStr, `PRs (${state})`);
      }
      await continuePrompt();
    } else if (
      action === "view" || action === "checkout" ||
      action === "approve" || action === "merge" || action === "close"
    ) {
      const prs = await listPRs(repo, "OPEN");
      if (prs.length === 0) {
        await continuePrompt();
        continue;
      }
      const prNum = await selectPR(prs);
      if (!prNum) continue;

      switch (action) {
        case "view":
          await viewPR(repo, prNum);
          break;
        case "checkout":
          await checkoutPR(repo, prNum);
          break;
        case "approve":
          await approvePR(repo, prNum);
          break;
        case "merge":
          await mergePR(repo, prNum);
          break;
        case "close":
          await closePR(repo, prNum);
          break;
      }
      await continuePrompt();
    } else if (action === "create") {
      await createPR(repo);
      await continuePrompt();
    } else if (action === "aiReview") {
      await reviewMenu(repo);
    }
  }
}