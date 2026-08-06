/**
 * repo/menu.ts — GitHub Repos TUI menu (TS)
 *
 * Interaktif menu untuk list/view/clone/open repo. Domain ini standalone —
 * tidak depend ke service lain di luar `services/gh` dan `utils/format`.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { cancel, isCancel, note, select, spinner, text } from "@clack/prompts";
import color from "picocolors";
import { ghExec, ghRaw } from "../gh";
import { clearLastLines } from "../../utils/format";
import { continuePrompt } from "../issue/view";

interface GHRepo {
  nameWithOwner: string;
  isPrivate?: boolean;
  stargazerCount?: number;
  description?: string | null;
  url?: string;
  forkCount?: number;
  primaryLanguage?: { name: string } | null;
  defaultBranch?: string;
  homepageUrl?: string | null;
}

/** Format repo untuk list display. */
export function formatRepo(repo: GHRepo): string {
  const vis = repo.isPrivate ? color.dim("[PRIV]") : color.cyan("[PUB]");
  const stars = repo.stargazerCount ? ` *${repo.stargazerCount}` : "";
  return `${vis} ${color.cyan(repo.nameWithOwner)}${stars}`;
}

/** List repos user (limit default 50). */
export async function listRepos(limit = 50): Promise<GHRepo[]> {
  const s = spinner();
  s.start("Fetching repos...");
  try {
    const repos = ghExec([
      "repo", "list", "--limit", String(limit),
      "--json", "nameWithOwner,isPrivate,stargazerCount,description",
    ]) as GHRepo[] | null;
    s.stop(`Found ${repos?.length || 0} repos`);
    return repos || [];
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return [];
  }
}

/** Clone repo ke dir tertentu (default `~/projects/<name>`). */
export async function cloneRepo(repo: string): Promise<boolean> {
  const defaultDir = `~/projects/${repo.split("/")[1] || "repo"}`;
  const dir = await text({
    message: "Directory tujuan:",
    placeholder: defaultDir,
    initialValue: defaultDir,
  });
  if (isCancel(dir)) {
    clearLastLines(2);
    return false;
  }

  let resolvedPath = String(dir).trim();
  if (resolvedPath.startsWith("~")) {
    resolvedPath = path.join(process.env.HOME || "", resolvedPath.slice(1));
  }

  const s = spinner();
  s.start(`Cloning ${repo}...`);
  try {
    const r = spawnSync("gh", ["repo", "clone", repo, resolvedPath], {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
    });
    if (r.status !== 0) {
      throw new Error((r.stderr || r.stdout || "").trim() || `gh repo clone exit ${r.status}`);
    }
    const out = r.stdout || "";
    s.stop("Cloned");
    note(out, "Clone");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** View repo details (boxed note). */
export async function viewRepo(repo: string): Promise<GHRepo | null> {
  const s = spinner();
  s.start("Fetching repo details...");
  try {
    const r = ghExec([
      "repo", "view", repo,
      "--json", "nameWithOwner,description,url,isPrivate,stargazerCount,forkCount,primaryLanguage,homepageUrl,defaultBranch",
    ]) as GHRepo | null;
    s.stop("Done");
    if (!r) {
      note("Repo tidak ditemukan.", "Repository Info");
      return null;
    }

    let output = `${r.nameWithOwner}\n`;
    output += `${"-".repeat(50)}\n`;
    output += `${r.description || "(no description)"}\n\n`;
    output += `URL: ${r.url || "(no url)"}\n`;
    output += `Visibility: ${r.isPrivate ? "Private" : "Public"}\n`;
    output += `Stars: ${r.stargazerCount ?? 0} | Forks: ${r.forkCount ?? 0}\n`;
    if (r.primaryLanguage) output += `Language: ${r.primaryLanguage.name}\n`;
    if (r.defaultBranch) output += `Default branch: ${r.defaultBranch}\n`;
    if (r.homepageUrl) output += `Homepage: ${r.homepageUrl}\n`;

    note(output, "Repository Info");
    return r;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return null;
  }
}

/** Open repo di browser via `gh repo view --web`. */
export async function openRepo(repo: string): Promise<boolean> {
  const s = spinner();
  s.start(`Opening ${repo} in browser...`);
  try {
    ghRaw(["repo", "view", repo, "--web"]);
    s.stop("Opened in browser");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Pilih repo interaktif dari list. */
async function pickRepo(repos: GHRepo[]): Promise<string | null> {
  const selected = await select<{ value: string; label: string }[], string>({
    message: "Pilih repository:",
    options: repos.map((r) => ({
      value: r.nameWithOwner,
      label: `${r.nameWithOwner}${r.stargazerCount ? ` ${r.stargazerCount}` : ""}`,
    })),
    maxItems: 15,
  });
  if (isCancel(selected)) {
    clearLastLines(2);
    return null;
  }
  return String(selected);
}

/** TUI menu utama untuk domain repo. */
export async function repoMenu(): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string }[], string>({
      message: "Repos",
      options: [
        { value: "list", label: "List Repos" },
        { value: "view", label: "View Repo Details" },
        { value: "clone", label: "Clone Repo" },
        { value: "open", label: "Open in Browser" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    if (action === "list") {
      const repos = await listRepos();
      if (repos.length > 0) {
        const listStr = repos.map((r) => `  ${formatRepo(r)}`).join("\n");
        note(listStr, "Your Repos");
      }
      await continuePrompt();
    } else if (action === "view" || action === "clone" || action === "open") {
      const repos = await listRepos();
      if (repos.length === 0) {
        await continuePrompt();
        continue;
      }
      const repo = await pickRepo(repos);
      if (!repo) continue;

      switch (action) {
        case "view":
          await viewRepo(repo);
          break;
        case "clone":
          await cloneRepo(repo);
          break;
        case "open":
          await openRepo(repo);
          break;
      }
      await continuePrompt();
    }
  }
}