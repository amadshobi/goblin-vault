/**
 * profile/view.ts — view GitHub profile (TS)
 *
 * Port dari `commands/profile.js` (bagian view). Engine profile view:
 *   fetchProfile -> displayProfile (ANSI box card) -> viewProfile
 *
 * Visual helpers (stripAnsi, visualLength, padVisual, truncateVisual,
 * clearLastLines) di-import dari `../../utils/format` (shared cross-domain).
 */
import { cancel, spinner } from "@clack/prompts";
import color from "picocolors";
import { ghApi } from "../gh";
import type { GHUser } from "../../types";
import { clearLastLines, padVisual, truncateVisual } from "../../utils/format";

/** Fetch authenticated user profile via GitHub REST API. */
export async function fetchProfile(): Promise<GHUser | null> {
  const s = spinner();
  s.start("Fetching profile...");
  try {
    const profile = ghApi<GHUser>("/user");
    s.stop("Profile fetched");
    return profile;
  } catch (err) {
    s.stop("Error");
    cancel(color.red(`Gagal fetch profile: ${err instanceof Error ? err.message : String(err)}`));
    clearLastLines(2);
    return null;
  }
}

/** Display profile dalam format ANSI box/card. */
export function displayProfile(profile: GHUser): void {
  const width = 56;
  const innerW = width - 2;
  const bar = color.dim("─".repeat(width));

  const rows = [
    { label: "Name", value: profile.name || "(not set)" },
    { label: "Bio", value: profile.bio || "(not set)" },
    { label: "Company", value: profile.company || "(not set)" },
    { label: "Location", value: profile.location || "(not set)" },
    { label: "Blog", value: profile.blog || "(not set)" },
    { label: "Twitter", value: profile.twitter_username || "(not set)" },
    { label: "Email", value: profile.email || "(not set)" },
    { label: "Type", value: profile.type || "(not set)" },
  ];

  const stats = [
    `Repos: ${profile.public_repos ?? "?"}`,
    `Followers: ${profile.followers ?? "?"}`,
    `Following: ${profile.following ?? "?"}`,
  ];

  const header = `║${color.bold(color.cyan(padVisual(truncateVisual(profile.login || profile.name || "Profile", width), width)))}║`;
  const statsLine = `║${color.dim(padVisual(truncateVisual(stats.join("  "), width), width))}║`;

  const dataLines = rows
    .filter((r) => r.value && r.value !== "(not set)")
    .map((r) => {
      const label = color.bold(`${r.label}:`);
      const val = truncateVisual(String(r.value), innerW - r.label.length - 3);
      return `║  ${label} ${padVisual(val, innerW - r.label.length - 3)} ║`;
    });

  const lines = [
    `╔${bar}╗`,
    header,
    statsLine,
    `║${bar}║`,
    ...dataLines,
    `╚${bar}╝`,
  ];

  console.log(lines.join("\n"));
}

/** View profile mode. */
export async function viewProfile(): Promise<number> {
  const profile = await fetchProfile();
  if (!profile) return 1;
  displayProfile(profile);
  return 0;
}