#!/usr/bin/env node
/**
 * gb — GitHub TUI & CLI (TypeScript router)
 *
 * Entrypoint modular yang me-wire command router ke `src/services/`:
 *   - profile        -> services/profile/{view,edit,menu}.ts
 *   - pr (view/checkout/approve/merge/close/create)
 *                  -> services/pr/{view,menu}.ts
 *   - pr review      -> services/pr/review.ts  (+ --live streaming)
 *   - issue view / summarize / analyze
 *                  -> services/issue/{view,summarize,analyze}.ts
 *   - release        -> services/release/menu.ts
 *   - repo           -> services/repo/menu.ts
 *   - auth           -> services/auth/menu.ts
 *   - config         -> services/config/{store,menu}.ts
 *
 * Emit: CommonJS (agar `require`-able dari tools-cli/bin/gb tanpa mengubah
 * `type` package.json — file CJS existing tetap jalan).
 *
 * Dual-Level Help:
 *   Level 1: `gb --help` / `gb help`            -> daftar command makro
 *   Level 2: `gb help <topic>` / `<cmd> --help` -> manual per subcommand
 */
import {
  cancel,
  isCancel,
  note,
  outro,
  select,
  spinner,
} from "@clack/prompts";
import color from "picocolors";
import { ghRaw, getCurrentRepo, selectRepo } from "./services/gh";
import { viewProfile } from "./services/profile/view";
import { editProfile, profileCliFlags } from "./services/profile/edit";
import { profileMenu } from "./services/profile/menu";
import { reviewPR, autoReviewAll } from "./services/pr/review";
import { formatReview } from "./services/pr/view";
import { prMenu } from "./services/pr/menu";
import {
  fetchIssue,
  listIssues,
  viewIssue,
  continuePrompt,
  issueMenu,
} from "./services/issue/view";
import { summarizeIssue } from "./services/issue/summarize";
import { summarizeBacklog } from "./services/issue/analyze";
import { releaseMenu } from "./services/release/menu";
import { repoMenu, viewRepo, openRepo } from "./services/repo/menu";
import { authMenu } from "./services/auth/menu";
import { configMenu } from "./services/config/menu";
import { clearLastLines } from "./utils/format";
import type { GHIssue } from "./types";

process.on("SIGINT", () => {
  cancel("gb terminated.");
  clearLastLines(2);
  process.exit(0);
});

function showBrand(): void {
  console.log(`
${color.bold(color.cyan("+----------------------------------+"))}
${color.bold(color.cyan("|"))}  ${color.bold("gb")} — ${color.dim("GitHub TUI")}   ${color.bold(color.cyan("|"))}
${color.bold(color.cyan("+----------------------------------+"))}
${color.dim("   Your goblin GitHub assistant")}
  `);
}

async function ensureRepo(): Promise<string | null> {
  const repo = getCurrentRepo();
  if (repo) return repo;
  note(color.dim("Belum ada repo aktif. Pilih repo dulu:"), "Repo Required");
  return await selectRepo("Pilih repository:");
}

// ─────────────────────────────────────────────────────────────────────────
// Dual-Level Help
// ─────────────────────────────────────────────────────────────────────────

const HELP_LEVEL1 = `${color.bold("gb")} — GitHub TUI & CLI (modular)

${color.bold("Penggunaan:")}
  gb                          Mode interaktif (TUI menu)
  gb <command> [sub] [flags]  Mode non-interaktif (CLI)

${color.bold("Command:")}
  ${color.cyan("profile")}      Lihat & edit GitHub profile
  ${color.cyan("pr")}           Pull Requests (${color.cyan("pr review")} = AI review)
  ${color.cyan("issue")}        Issues (${color.cyan("issue view")}, ${color.cyan("issue summarize")}, ${color.cyan("issue analyze")})

${color.bold("Dual-Level Help:")}
  gb --help            Level 1: daftar command (ini)
  gb help <topic>      Level 2: manual per subcommand
  gb <cmd> --help      Level 2: manual per subcommand (alias)

${color.dim("Topics: profile, pr, issue. Contoh: gb help pr / gb pr review --help")}
`;

const HELP_PROFILE = `${color.bold("gb profile")} — lihat & edit GitHub profile

${color.bold("Penggunaan:")}
  gb profile              Mode interaktif (TUI menu)
  gb profile view         Lihat profil GitHub saat ini
  gb profile edit         Edit profil secara interaktif
  gb profile --help       Tampilkan bantuan ini

${color.bold("Fast CLI Flags (langsung update tanpa interaksi):")}
  gb profile --name "Nama"      Update display name
  gb profile --bio "Bio Baru"   Update bio
  gb profile --company "PT"     Update company
  gb profile --location "Jkt"   Update location
  gb profile --blog "url"       Update blog/website URL

${color.dim("Gunakan 'gb profile view' untuk memeriksa profil sebelum edit.")}
`;

const HELP_PR_REVIEW = `${color.bold("gb pr review")} — AI code review untuk Pull Request

${color.bold("Penggunaan:")}
  gb pr review <number> [flags]   Review satu PR via AI
  gb pr review --auto | --all [flags]   Review semua open PRs (batch)
  gb pr review --help              Tampilkan bantuan ini

${color.bold("Flags:")}
  --publish         Post hasil review sebagai komentar resmi GitHub PR
  --force           Paksa review ulang meski commit SHA sudah tercatat
  --high/--medium/--low/--eff-auto/--none   Pilih variant model
  --variant <name>  Pilih variant model secara eksplisit
  --model <name>    Override model LLM langsung
  --live            Stream hasil LLM token-by-token (MarkdownStreamFormatter)

${color.bold("Magic omp:")}
  ... omp           Akhiri command dengan "omp" untuk pakai backend omp

${color.bold("Contoh:")}
  gb pr review 12 --high           Review PR #12 (variant high)
  gb pr review 12 --publish        Review & publish ke GitHub
  gb pr review 12 omp              Review via backend omp
  gb pr review --auto --medium     Batch semua open PRs
  gb pr review 12 --live           Review dengan live streaming
`;

const HELP_ISSUE = `${color.bold("gb issue")} — Issues (view / summarize / analyze)

${color.bold("Penggunaan:")}
  gb issue view <number>      Lihat detail issue (+ komentar)
  gb issue summarize <number> Ringkas issue + komentar via LLM
  gb issue analyze [--all]    Analisis severity/statistik issue
  gb issue --help             Tampilkan bantuan ini

${color.bold("Contoh:")}
  gb issue view 42
  gb issue summarize 42
  gb issue analyze            Analisis seluruh issue OPEN
`;

// ─────────────────────────────────────────────────────────────────────────
// Non-interactive CLI router
// ─────────────────────────────────────────────────────────────────────────

function getFlagValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  return idx !== -1 ? argv[idx + 1] : undefined;
}

async function runCli(argv: string[]): Promise<number> {
  const flags = argv.filter((a) => a.startsWith("--"));
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const [cmd, sub, ...rest] = positionals;

  // ---- Dual-Level Help ----
  if (flags.includes("-h") || flags.includes("--help")) {
    if (cmd === "profile") {
      console.log(HELP_PROFILE);
    } else if (cmd === "pr") {
      console.log(HELP_PR_REVIEW);
    } else if (cmd === "issue") {
      console.log(HELP_ISSUE);
    } else {
      console.log(HELP_LEVEL1);
    }
    return 0;
  }
  if (cmd === "help") {
    if (sub === "profile") console.log(HELP_PROFILE);
    else if (sub === "pr") console.log(HELP_PR_REVIEW);
    else if (sub === "issue") console.log(HELP_ISSUE);
    else console.log(HELP_LEVEL1);
    return 0;
  }
  if (argv.length === 1 && (cmd === "-h" || cmd === "--help")) {
    console.log(HELP_LEVEL1);
    return 0;
  }

  // ---- PR review ----
  if (cmd === "pr" && sub === "review") {
    const publish = flags.includes("--publish");
    const auto = flags.includes("--auto") || flags.includes("--all");
    const force = flags.includes("--force");
    const live = flags.includes("--live");

    const model = getFlagValue(argv, "--model") || getFlagValue(argv, "-m");
    const variantVal = getFlagValue(argv, "--variant") || getFlagValue(argv, "-v");
    let variant: string | undefined;
    if (flags.includes("--low")) variant = "low";
    else if (flags.includes("--medium")) variant = "medium";
    else if (flags.includes("--high")) variant = "high";
    else if (flags.includes("--eff-auto")) variant = "auto";
    else if (flags.includes("--none")) variant = "none";
    else if (variantVal) variant = variantVal;
    let useOmp = false;
    let backend: string | undefined;
    if (rest.length && rest[rest.length - 1] === "omp") {
      rest.pop();
      useOmp = true;
      backend = "omp";
    }

    if (auto) {
      const summary = await autoReviewAll({ publish, force, model, variant, useOmp, backend, live });
      printBatchSummary(summary);
      return summary.ok && summary.failed.length === 0 ? 0 : 1;
    }

    const prNumber = rest[0];
    if (!prNumber) {
      console.error(color.red("Nomor PR wajib diisi. Contoh: gb pr review 12 [--publish]"));
      console.error(color.dim("Atau gunakan --auto / --all untuk semua open PRs."));
      return 1;
    }

    const res = await reviewPR(prNumber, { publish, force, model, variant, useOmp, backend, live });
    if (!res.ok) {
      console.error(color.red(res.error || "unknown error"));
      return 1;
    }
    if (res.skipped) {
      console.log(color.yellow(res.reason || "skipped"));
      return 0;
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
      console.log(color.green(`Review PR #${res.prData?.number} dipublikasikan ke GitHub.`));
    } else if (res.publishError) {
      console.error(color.yellow(`Review TIDAK terpublish ke GitHub: ${res.publishError}`));
    }
    return 0;
  }

  // ---- Profile ----
  if (cmd === "profile") {
    const profileFlags = flags.some((f) =>
      ["--name", "--bio", "--company", "--location", "--blog"].includes(f)
    );
    if (profileFlags) {
      return await profileCliFlags({
        name: getFlagValue(argv, "--name"),
        bio: getFlagValue(argv, "--bio"),
        company: getFlagValue(argv, "--company"),
        location: getFlagValue(argv, "--location"),
        blog: getFlagValue(argv, "--blog"),
      });
    }
    if (sub === "view") return await viewProfile();
    if (sub === "edit") return await editProfile();
    if (!sub) {
      await profileMenu();
      return 0;
    }
    console.error(color.red(`Subcommand profile tidak dikenal: ${sub}`));
    console.log(HELP_PROFILE);
    return 1;
  }

  // ---- Issues (view / summarize / analyze) ----
  if (cmd === "issue") {
    const repo = getCurrentRepo();
    if (!repo) {
      console.error(color.red("Tidak ada repo aktif. Jalankan dari dalam repo, atau set repo dulu."));
      return 1;
    }

    if (sub === "view") {
      const num = rest[0];
      if (!num) {
        console.error(color.red("Nomor issue wajib diisi. Contoh: gb issue view 42"));
        return 1;
      }
      await viewIssue(repo, num);
      return 0;
    }

    if (sub === "summarize") {
      const num = rest[0];
      if (!num) {
        console.error(color.red("Nomor issue wajib diisi. Contoh: gb issue summarize 42"));
        return 1;
      }
      const s = spinner();
      s.start("Fetching issue...");
      try {
        const issue = fetchIssue(repo, num);
        s.stop(`Fetched issue #${issue.number} ${issue.title}`);
        console.log("");
        const model = getFlagValue(argv, "--model") || getFlagValue(argv, "-m");
        const variant = getFlagValue(argv, "--variant") || getFlagValue(argv, "-v");
        const result = await summarizeIssue(issue, { model, variant });
        console.log(color.dim(`\n[model: ${result.model || "(default)"} | backend: ${result.backend} | tokens: ${result.tokens.total}]`));
        return 0;
      } catch (err) {
        s.stop("Error");
        console.error(color.red(err instanceof Error ? err.message : String(err)));
        return 1;
      }
    }

    if (sub === "analyze") {
      const s = spinner();
      s.start("Fetching issues...");
      try {
        const issues = (await listIssues(repo, "OPEN")) as GHIssue[];
        s.stop(`Analisis ${issues.length} issue`);
        console.log(summarizeBacklog(issues));
        return 0;
      } catch (err) {
        s.stop("Error");
        console.error(color.red(err instanceof Error ? err.message : String(err)));
        return 1;
      }
    }

    console.error(color.red(`Subcommand issue tidak dikenal: ${sub || "(kosong)"}`));
    console.log(HELP_ISSUE);
    return 1;
  }

  console.error(color.red(`Perintah tidak dikenal: ${argv.join(" ")}`));
  console.log(HELP_LEVEL1);
  return 1;
}

function printBatchSummary(summary: {
  ok: boolean;
  total: number;
  reviewed: number[];
  skipped: number[];
  failed: Array<{ number: number; error: string }>;
  publishFailed: Array<{ number: number; error: string }>;
  error?: string;
}): void {
  if (!summary.ok) {
    console.error(color.red(summary.error || "unknown error"));
    return;
  }
  const parts: string[] = [];
  if (summary.total) parts.push(`total: ${summary.total}`);
  if (summary.reviewed.length) parts.push(color.green(`reviewed: ${summary.reviewed.length}`));
  if (summary.skipped.length) parts.push(color.yellow(`skipped: ${summary.skipped.length}`));
  if (summary.publishFailed.length) parts.push(color.yellow(`publish-failed: ${summary.publishFailed.length}`));
  if (summary.failed.length) parts.push(color.red(`failed: ${summary.failed.length}`));
  console.log(parts.join(" | ") || "Tidak ada open PR.");
  summary.publishFailed.forEach((f) => console.error(color.yellow(`PR #${f.number} gagal publish: ${f.error}`)));
  summary.failed.forEach((f) => console.error(color.red(`PR #${f.number}: ${f.error}`)));
}

// ─────────────────────────────────────────────────────────────────────────
// Interactive TUI (delegasi ke services/*/menu.ts)
// ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  showBrand();

  try {
    ghRaw(["auth", "status"], { silent: true });
  } catch {
    note(color.yellow('gh belum login. Pilih "Auth" untuk login.'), "Auth Required");
  }

  let activeRepo = getCurrentRepo();
  if (activeRepo) {
    note(`Active repo: ${color.cyan(activeRepo)}`, "Active Repo");
  }

  while (true) {
    const mainMenu = await select<{ value: string; label: string; hint?: string }[], string>({
      message: "Pilih menu GitHub:",
      options: [
        { value: "pr", label: "Pull Requests", hint: activeRepo || "pilih repo" },
        { value: "issues", label: "Issues", hint: activeRepo || "pilih repo" },
        { value: "releases", label: "Releases", hint: activeRepo || "pilih repo" },
        { value: "repos", label: "Repos" },
        { value: "auth", label: "Auth" },
        { value: "config", label: "Config", hint: "model & settings" },
        { value: "profile", label: "Profile", hint: "view & edit GitHub profile" },
        { value: "switchRepo", label: "Switch Repo", hint: activeRepo ? "change repo" : "set repo" },
        { value: "repoInfo", label: "Repo Info", hint: activeRepo || "pilih repo" },
        { value: "openRepo", label: "Open in Browser", hint: activeRepo || "pilih repo" },
        { value: "exit", label: "Exit" },
      ],
      maxItems: 10,
    });

    if (isCancel(mainMenu) || mainMenu === "exit") {
      clearLastLines(2);
      outro(color.green("gb selesai!"));
      process.exit(0);
    }

    const needsRepo = ["pr", "issues", "releases", "repoInfo", "openRepo"];
    if (needsRepo.includes(mainMenu)) {
      if (!activeRepo) {
        const repo = await ensureRepo();
        if (!repo) continue;
        activeRepo = repo;
      }
    }

    switch (mainMenu) {
      case "pr":
        await prMenu(activeRepo!);
        break;
      case "issues":
        await issueMenu(activeRepo!);
        break;
      case "releases":
        await releaseMenu(activeRepo!);
        break;
      case "repos":
        await repoMenu();
        break;
      case "auth":
        await authMenu();
        break;
      case "config":
        await configMenu();
        break;
      case "profile":
        await profileMenu();
        break;
      case "switchRepo": {
        const newRepo = await selectRepo("Pilih repository:");
        if (newRepo) {
          activeRepo = newRepo;
          note(`Active repo: ${color.cyan(activeRepo)}`, "Switched");
        }
        break;
      }
      case "repoInfo":
        await viewRepo(activeRepo!);
        await continuePrompt();
        break;
      case "openRepo":
        await openRepo(activeRepo!);
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Bootstrapping
// ─────────────────────────────────────────────────────────────────────────

const cliArgs = process.argv.slice(2);

if (cliArgs.length > 0) {
  runCli(cliArgs)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(color.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    });
} else {
  main().catch((err) => {
    console.error(color.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
}