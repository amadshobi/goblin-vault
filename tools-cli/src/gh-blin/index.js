#!/usr/bin/env node

const p = require('@clack/prompts');
const color = require('picocolors');
const { getCurrentRepo, selectRepo } = require('./utils/gh');
const { prMenu } = require('./commands/pr');
const { issueMenu } = require('./commands/issue');
const { repoMenu } = require('./commands/repo');
const { releaseMenu } = require('./commands/release');
const { authMenu } = require('./commands/auth');
const { configMenu } = require('./commands/config');
const { profileMenu } = require('./commands/profile');
const { clearLastLines, formatReview } = require('./utils/display');
const { continuePrompt } = require('./utils/prompt');

process.on('SIGINT', () => {
  p.cancel('gh-blin terminated.');
  clearLastLines(2);
  process.exit(0);
});

function showBrand() {
  console.log(`
${color.bold(color.cyan('+----------------------------------+'))}
${color.bold(color.cyan('|'))}  ${color.bold('gh-blin')} — ${color.dim('GitHub TUI')}   ${color.bold(color.cyan('|'))}
${color.bold(color.cyan('+----------------------------------+'))}
${color.dim('   Your goblin GitHub assistant')}
  `);
}

async function ensureRepo() {
  const repo = getCurrentRepo();
  if (repo) return repo;
  p.note(color.dim('Belum ada repo aktif. Pilih repo dulu:'), 'Repo Required');
  return await selectRepo('Pilih repository:');
}

async function main() {
  showBrand();

  // Check if gh is authenticated
  try {
    const { ghRaw } = require('./utils/gh');
    ghRaw(['auth', 'status'], { silent: true });
  } catch (_) {
    p.note(color.yellow('gh belum login. Pilih "Auth" untuk login.'), 'Auth Required');
  }

  // Detect current repo from CWD
  let activeRepo = getCurrentRepo();
  if (activeRepo) {
    p.note(`Active repo: ${color.cyan(activeRepo)}`, 'Active Repo');
  }

  while (true) {
    const mainMenu = await p.select({
      message: 'Pilih menu GitHub:',
      options: [
        { value: 'pr', label: 'Pull Requests', hint: activeRepo || 'pilih repo' },
        { value: 'issues', label: 'Issues', hint: activeRepo || 'pilih repo' },
        { value: 'releases', label: 'Releases', hint: activeRepo || 'pilih repo' },
        { value: 'repos', label: 'Repos' },
        { value: 'auth', label: 'Auth' },
        { value: 'config', label: 'Config', hint: 'model & settings' },
        { value: 'profile', label: 'Profile', hint: 'view & edit GitHub profile' },
        { value: 'switchRepo', label: 'Switch Repo', hint: activeRepo ? 'change repo' : 'set repo' },
        { value: 'repoInfo', label: 'Repo Info', hint: activeRepo || 'pilih repo' },
        { value: 'openRepo', label: 'Open in Browser', hint: activeRepo || 'pilih repo' },
        { value: 'exit', label: 'Exit' },
      ],
      maxItems: 10,
    });

    if (p.isCancel(mainMenu) || mainMenu === 'exit') {
      clearLastLines(2);
      p.outro(color.green('gh-blin selesai!'));
      process.exit(0);
    }

    // For menu items that need a repo, prompt if not set
    const needsRepo = ['pr', 'issues', 'releases', 'repoInfo', 'openRepo'];
    if (needsRepo.includes(mainMenu)) {
      if (!activeRepo) {
        const repo = await ensureRepo();
        if (!repo) continue;
        activeRepo = repo;
      }
    }

    switch (mainMenu) {
      case 'pr':
        await prMenu(activeRepo);
        break;
      case 'issues':
        await issueMenu(activeRepo);
        break;
      case 'releases':
        await releaseMenu(activeRepo);
        break;
      case 'repos':
        await repoMenu();
        break;
      case 'auth':
        await authMenu();
        break;
      case 'config':
        await configMenu();
        break;
      case 'profile':
        await profileMenu();
        break;
      case 'switchRepo': {
        const newRepo = await selectRepo('Pilih repository:');
        if (newRepo) {
          activeRepo = newRepo;
          p.note(`Active repo: ${color.cyan(activeRepo)}`, 'Switched');
        }
        break;
      }
      case 'repoInfo': {
        const { viewRepo } = require('./commands/repo');
        await viewRepo(activeRepo);
        await continuePrompt();
        break;
      }
      case 'openRepo': {
        const { openRepo } = require('./commands/repo');
        await openRepo(activeRepo);
        break;
      }
    }
  }
}

const CLI_HELP = `gh-blin — non-interactive mode

Usage:
  gh-blin pr review <number> [flags]   Review satu PR via AI
  gh-blin pr review --auto [flags]     Review semua open PRs (batch)
  gh-blin pr review --all [flags]      (alias dari --auto)
  gh-blin config set <key> <value>     Set config (e.g. variant, model, variants.high)
  gh-blin config get [key]             Lihat config (satu key / seluruh JSON)
  gh-blin config list                  Daftar seluruh config
  gh-blin profile                      Lihat & edit GitHub profile
  gh-blin profile --help               Bantuan profile (opsi flags & contoh)
  gh-blin --help                       Tampilkan bantuan ini

Flags:
  --publish          Post hasil review sebagai komentar resmi GitHub PR
  --force            Paksa review ulang meski commit SHA sudah tercatat
  --high             Gunakan variant model 'high' (claude-3-5-sonnet) [Default Utama]
  --medium           Gunakan variant model 'medium' (goblin-nexus/gemini-3.5-flash)
  --low              Gunakan variant model 'low' (gemini-2.5-flash)
  --eff-auto         Gunakan variant model 'auto' (google/gemini-2.0-flash-001)
  --none             Gunakan variant model 'none' (deepseek/deepseek-chat, thinking off)
  --variant <name>   Pilih variant model ('high', 'medium', 'low', 'auto', atau 'none')
  --model <name>     Override nama model LLM secara langsung (mis. 'gpt-4o')

Magic omp:
  ... omp            Akhiri command dengan "omp" untuk pakai backend omp (prompt optimizer).

Examples:
  gh-blin pr review 12                             Review PR #12 memakai default variant (high)
  gh-blin pr review 12 --high                      Review PR #12 memakai variant high
  gh-blin pr review 12 --medium --publish          Review PR #12 memakai variant medium & publish ke GitHub
  gh-blin pr review 12 --low                       Review PR #12 memakai variant low
  gh-blin pr review 12 omp                         Review PR #12 pakai backend omp
  gh-blin pr review 12 omp --eff-auto              Review PR #12 pakai backend omp dengan variant auto
  gh-blin pr review --auto --high                  Batch review semua open PRs dengan variant high
  gh-blin pr review 12 --model gpt-4o              Override model secara langsung
  gh-blin config set variant medium                Set default active variant ke medium
  gh-blin config set variants.high claude-3-7     Set custom model untuk variant high
  gh-blin profile view                             Lihat profil GitHub
  gh-blin profile --name "Nama"                    Update display name`;

const CONFIG_HELP = `gh-blin config — kelola config

Usage:
  gh-blin config set <key> <value>   Set key config
  gh-blin config get [key]           Tampilkan value key, atau seluruh config JSON
  gh-blin config list                Tampilkan seluruh config sebagai daftar

Contoh Penggunaan:
  gh-blin config set variant medium               Set default active variant ke 'medium'
  gh-blin config set variants.high claude-3-7    Set custom model untuk variant 'high'
  gh-blin config set variants.low gemini-1.5-pro Set custom model untuk variant 'low'
  gh-blin config set model gemini-2.5-flash       Set legacy model key
  gh-blin config get variant                      Lihat active variant
  gh-blin config get                              Lihat seluruh config (JSON)
  gh-blin config list                             Daftar seluruh config

Config disimpan di: ~/.config/goblin-vault/gh-blin-config.json
(overridable via env XDG_CONFIG_HOME)`;

const PROFILE_HELP = `gh-blin profile — lihat & edit GitHub profile

Usage:
  gh-blin profile                      Mode interaktif (TUI menu)
  gh-blin profile view                 Lihat profil GitHub saat ini
  gh-blin profile edit                 Edit profil secara interaktif
  gh-blin profile --help               Tampilkan bantuan ini

Fast CLI Flags (langsung update tanpa interaksi):
  gh-blin profile --name "Nama"        Update display name
  gh-blin profile --bio "Bio Baru"     Update bio
  gh-blin profile --company "PT. XYZ"  Update company
  gh-blin profile --location "Jakarta" Update location
  gh-blin profile --blog "https://…"   Update blog/website URL

Fields yang bisa diupdate:
  --name             Display name / full name
  --bio              Bio / deskripsi singkat
  --company          Nama perusahaan / organisasi
  --location         Lokasi (kota, negara)
  --blog             Blog atau website URL
  --twitter_username Twitter/X handle (hanya interactive mode)

Contoh Penggunaan:
  gh-blin profile view                           Lihat profil
  gh-blin profile                                Menu interaktif
  gh-blin profile edit                           Edit interaktif
  gh-blin profile --name "Bambang"               Langsung ubah nama
  gh-blin profile --bio "Builder goblin"         Langsung ubah bio
  gh-blin profile --company "Goblin Corp"        Langsung ubah company
  gh-blin profile --blog "https://blog.example"  Langsung ubah website

Notes:
  - Interactive mode menampilkan profil saat ini, lalu memilih field untuk diedit.
  - Fast flags mode langsung PATCH ke GitHub tanpa konfirmasi.
  - Gunakan 'gh-blin profile view' untuk memeriksa profil sebelum edit.`;

async function runCli(argv) {
  const flags = argv.filter(a => a.startsWith('--'));
  const positionals = argv.filter(a => !a.startsWith('--'));

  if (flags.includes('-h') || flags.includes('--help')) {
    if (positionals[0] === 'config') {
      console.log(CONFIG_HELP);
      return 0;
    }
    if (positionals[0] === 'profile') {
      console.log(PROFILE_HELP);
      return 0;
    }
    console.log(CLI_HELP);
    return 0;
  }

  const publish = flags.includes('--publish');
  const auto = flags.includes('--auto') || flags.includes('--all');
  const force = flags.includes('--force');
  const modelFlagIndex = argv.indexOf('--model');
  const model = modelFlagIndex !== -1 ? argv[modelFlagIndex + 1] : undefined;

  const variantFlagIndex = argv.indexOf('--variant');
  const variantVal = variantFlagIndex !== -1 ? argv[variantFlagIndex + 1] : undefined;

  let variant;
  if (flags.includes('--low')) {
    variant = 'low';
  } else if (flags.includes('--medium')) {
    variant = 'medium';
  } else if (flags.includes('--high')) {
    variant = 'high';
  } else if (flags.includes('--eff-auto')) {
    variant = 'auto';
  } else if (flags.includes('--none')) {
    variant = 'none';
  } else if (variantVal && typeof variantVal === 'string' && !variantVal.startsWith('--')) {
    variant = variantVal;
  }

  // M3: Precedence warning — flag --model dan flag variant diset bersamaan.
  // Explicit --model SELALU meng-override preset variant (lihat ai.js).
  const hasVariantFlag =
    flags.includes('--high') || flags.includes('--medium') || flags.includes('--low') ||
    flags.includes('--eff-auto') || flags.includes('--none') || variantFlagIndex !== -1;
  if (model && hasVariantFlag) {
    console.log(color.yellow(
      `⚠️  Warning: Flag --model dan --variant diset bersamaan. ` +
      `Flag --model '${model}' akan meng-override preset variant.`
    ));
  }

  const [cmd, sub, ...rest] = positionals;

  // Deteksi "3 huruf sakti" `omp`: kalau argumen posisional terakhir setelah
  // `pr review <number>` adalah 'omp', pop lalu aktifkan backend omp.
  let useOmp = false;
  let backend;
  if (rest.length && rest[rest.length - 1] === 'omp') {
    rest.pop();
    useOmp = true;
    backend = 'omp';
  }

  if (cmd === 'pr' && sub === 'review') {
    const { reviewPR, autoReviewAll } = require('./commands/review');

    if (auto) {
      const summary = await autoReviewAll({ publish, force, model, variant, useOmp, backend });
      printBatchSummary(summary);
      return summary.ok && summary.failed.length === 0 ? 0 : 1;
    }

    const prNumber = rest[0];
    if (!prNumber) {
      console.error(color.red('Nomor PR wajib diisi. Contoh: gh-blin pr review 12 [--publish]'));
      console.error(color.dim('Atau gunakan --auto / --all untuk semua open PRs.'));
      return 1;
    }

    const res = await reviewPR(prNumber, { publish, force, model, variant, useOmp, backend });
    if (!res.ok) {
      console.error(color.red(res.error));
      return 1;
    }
    if (res.skipped) {
      console.log(color.yellow(res.reason));
      return 0;
    }
    console.log(formatReview(res.review, res.prData, {
      model: res.model,
      variant: res.variant,
      backend: res.backend,
      tokens: res.tokens,
    }));
    if (res.published) {
      console.log(color.green(`Review PR #${res.prData.number} dipublikasikan ke GitHub.`));
    } else if (res.publishError) {
      console.error(color.yellow(`Review TIDAK terpublish ke GitHub: ${res.publishError}`));
    }
    return 0;
  }

  if (cmd === 'config') {
    const { configSet, configGet, configList, formatConfigValue } = require('./commands/config');
    const op = sub;

    if (op === 'set') {
      const [key, value] = rest;
      if (!key || value === undefined) {
        console.error(color.red('Penggunaan: gh-blin config set <key> <value>'));
        console.error(color.dim('Contoh: gh-blin config set model gemini-2.5-flash'));
        return 1;
      }
      const res = configSet(key, value);
      if (!res.ok) {
        console.error(color.red(res.error));
        return 1;
      }
      console.log(color.green(`Config di-set: ${res.key} = ${formatConfigValue(res.value)}`));
      return 0;
    }

    if (op === 'get') {
      const res = configGet(rest[0]);
      if (!res.ok) {
        console.error(color.red(res.error));
        return 1;
      }
      if (res.config) {
        console.log(JSON.stringify(res.config, null, 2));
        return 0;
      }
      if (!res.found) {
        console.error(color.yellow(`Config key "${rest[0]}" tidak di-set.`));
        return 1;
      }
      console.log(String(res.value));
      return 0;
    }

    if (op === 'list') {
      const res = configList();
      if (!res.ok) {
        console.error(color.red(res.error));
        return 1;
      }
      const keys = Object.keys(res.config);
      if (!keys.length) {
        console.log(color.dim('Config kosong. Belum ada key yang di-set.'));
        return 0;
      }
      console.log(`Config (${keys.length} key):`);
      for (const k of keys) {
        console.log(`  ${color.cyan(k)} = ${formatConfigValue(res.config[k])}`);
      }
      return 0;
    }

    console.error(color.red(`Subcommand config tidak dikenal: ${op || '(kosong)'}`));
    console.log(CONFIG_HELP);
    return 1;
  }

  // --- Help subcommand (gh-blin help <topic>) ---
  if (cmd === 'help') {
    if (sub === 'profile') {
      console.log(PROFILE_HELP);
      return 0;
    }
    if (sub === 'config') {
      console.log(CONFIG_HELP);
      return 0;
    }
    console.log(CLI_HELP);
    return 0;
  }

  // --- Profile subcommand ---
  if (cmd === 'profile') {
    const { viewProfile, editProfile, profileCliFlags } = require('./commands/profile');

    // Detect CLI flags mode: --name, --bio, --company, --location, --blog
    const hasProfileFlags = flags.some(f =>
      ['--name', '--bio', '--company', '--location', '--blog'].includes(f)
    );

    if (hasProfileFlags) {
      const getFlag = (name) => {
        const idx = argv.indexOf(name);
        return idx !== -1 ? argv[idx + 1] : undefined;
      };
      return await profileCliFlags({
        name: getFlag('--name'),
        bio: getFlag('--bio'),
        company: getFlag('--company'),
        location: getFlag('--location'),
        blog: getFlag('--blog'),
      });
    }

    // Subcommands: view, edit
    if (sub === 'view') {
      return await viewProfile();
    }

    if (sub === 'edit') {
      return await editProfile();
    }

    // Default: interactive TUI menu (no subcommand / no flags)
    if (!sub) {
      const { profileMenu } = require('./commands/profile');
      await profileMenu();
      return 0;
    }

    console.error(color.red(`Subcommand profile tidak dikenal: ${sub}`));
    console.log(PROFILE_HELP);
    return 1;
  }

  console.error(color.red(`Perintah tidak dikenal: ${argv.join(' ')}`));
  console.log(CLI_HELP);
  return 1;
}

function printBatchSummary(summary) {
  if (!summary.ok) {
    console.error(color.red(summary.error));
    return;
  }
  const parts = [];
  if (summary.total) parts.push(`total: ${summary.total}`);
  if (summary.reviewed.length) parts.push(color.green(`reviewed: ${summary.reviewed.length}`));
  if (summary.skipped.length) parts.push(color.yellow(`skipped: ${summary.skipped.length}`));
  if (summary.publishFailed.length) parts.push(color.yellow(`publish-failed: ${summary.publishFailed.length}`));
  if (summary.failed.length) parts.push(color.red(`failed: ${summary.failed.length}`));
  console.log(parts.join(' | ') || 'Tidak ada open PR.');
  if (summary.publishFailed.length) {
    summary.publishFailed.forEach(f => console.error(color.yellow(`PR #${f.number} gagal publish: ${f.error}`)));
  }
  if (summary.failed.length) {
    summary.failed.forEach(f => console.error(color.red(`PR #${f.number}: ${f.error}`)));
  }
}

const cliArgs = process.argv.slice(2);
if (cliArgs.length > 0) {
  runCli(cliArgs)
    .then(code => process.exit(code))
    .catch(err => {
      console.error(color.red(err.message || err));
      process.exit(1);
    });
} else {
  main().catch(err => {
    console.error(color.red(err.message || err));
    process.exit(1);
  });
}
