/**
 * release/menu.ts — GitHub Releases TUI menu (TS)
 *
 * Interaktif menu untuk list/view/create release di repo aktif.
 * Domain ini standalone — tidak depend ke service lain di luar `services/gh`
 * dan `utils/format`.
 */
import { cancel, isCancel, note, select, spinner, text } from "@clack/prompts";
import color from "picocolors";
import { ghExec, ghRaw } from "../gh";
import { clearLastLines } from "../../utils/format";
import { continuePrompt } from "../issue/view";

interface GHRelease {
  tagName?: string;
  tag_name?: string;
  name?: string;
  isDraft?: boolean;
  isPrerelease?: boolean;
  publishedAt?: string;
}

/** Truncate string polos untuk display (ANSI-agnostic). */
function truncate(str: string | null | undefined, maxLen = 50): string {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 3) + "..." : str;
}

/** Format release untuk list display. */
export function formatRelease(release: GHRelease): string {
  const isDraft = release.isDraft ? color.yellow(" [DRAFT]") : "";
  const isPrerelease = release.isPrerelease ? color.dim(" [pre]") : "";
  const tag = color.green(release.tagName || release.tag_name || "?");
  return `${tag}${isDraft}${isPrerelease} — ${truncate(release.name || "(no name)", 50)}`;
}

/** List releases (default 20). */
export async function listReleases(repo: string, limit = 20): Promise<GHRelease[]> {
  const s = spinner();
  s.start("Fetching releases...");
  try {
    const releases = ghExec([
      "release", "list", "--repo", repo, "--limit", String(limit),
      "--json", "tagName,name,isDraft,isPrerelease,publishedAt",
    ]) as GHRelease[] | null;
    s.stop(`Found ${releases?.length || 0} releases`);
    if (!releases || releases.length === 0) {
      note("No releases found.", "Releases");
      return [];
    }
    return releases;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return [];
  }
}

/** View satu release (raw text via pager fallback ke note). */
export async function viewRelease(repo: string, tagName: string): Promise<string | null> {
  const s = spinner();
  s.start("Fetching release details...");
  try {
    const release = ghRaw(["release", "view", tagName, "--repo", repo]) || "";
    s.stop("Done");
    note(release, `Release: ${tagName}`);
    return release;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return null;
  }
}

/** Create release interaktif. */
export async function createRelease(repo: string): Promise<boolean> {
  const tag = await text({ message: "Tag name:", placeholder: "v1.0.0" });
  if (isCancel(tag)) {
    clearLastLines(2);
    return false;
  }
  const name = await text({
    message: "Release name:",
    placeholder: "v1.0.0",
    initialValue: String(tag),
  });
  if (isCancel(name)) {
    clearLastLines(2);
    return false;
  }
  const notes = await text({
    message: "Release notes (optional):",
    placeholder: "What changed in this release",
  });
  if (isCancel(notes)) {
    clearLastLines(2);
    return false;
  }

  const isPrerelease = await text({
    message: "Pre-release? (yes/no, default no):",
    placeholder: "no",
    initialValue: "no",
  });
  if (isCancel(isPrerelease)) {
    clearLastLines(2);
    return false;
  }
  const isPre = String(isPrerelease).trim().toLowerCase() === "yes";

  const s = spinner();
  s.start("Creating release...");
  try {
    const args: Array<string | number> = ["release", "create", String(tag), "--repo", repo, "--title", String(name)];
    if (String(notes).trim()) args.push("--notes", String(notes));
    if (isPre) args.push("--prerelease");
    const out = ghRaw(args);
    s.stop("Release Created");
    note(out || "created", "New Release");
    return true;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(err instanceof Error ? err.message : String(err)));
    clearLastLines(2);
    return false;
  }
}

/** Pilih release dari list interaktif. */
async function selectRelease(releases: GHRelease[]): Promise<string | null> {
  const selected = await select<{ value: string; label: string }[], string>({
    message: "Pilih Release:",
    options: releases.map((r) => ({
      value: r.tagName || r.tag_name || "",
      label: formatRelease(r),
    })),
  });
  if (isCancel(selected)) {
    clearLastLines(2);
    return null;
  }
  return String(selected);
}

/** TUI menu utama untuk domain release. */
export async function releaseMenu(repo: string): Promise<void> {
  while (true) {
    const action = await select<{ value: string; label: string }[], string>({
      message: `Releases — ${color.cyan(repo)}`,
      options: [
        { value: "list", label: "List Releases" },
        { value: "view", label: "View Release" },
        { value: "create", label: "Create Release" },
        { value: "back", label: "Back" },
      ],
    });
    if (isCancel(action) || action === "back") {
      clearLastLines(2);
      break;
    }

    if (action === "list") {
      const releases = await listReleases(repo);
      if (releases.length > 0) {
        const listStr = releases.map((r) => `  ${formatRelease(r)}`).join("\n");
        note(listStr, "Releases");
      }
      await continuePrompt();
    } else if (action === "view") {
      const releases = await listReleases(repo);
      if (releases.length === 0) {
        await continuePrompt();
        continue;
      }
      const tag = await selectRelease(releases);
      if (!tag) continue;
      await viewRelease(repo, tag);
      await continuePrompt();
    } else if (action === "create") {
      await createRelease(repo);
      await continuePrompt();
    }
  }
}