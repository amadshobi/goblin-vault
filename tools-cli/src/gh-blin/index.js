#!/usr/bin/env node

const p = require('@clack/prompts');
const color = require('picocolors');
const { getCurrentRepo, selectRepo } = require('./utils/gh');
const { prMenu } = require('./commands/pr');
const { issueMenu } = require('./commands/issue');
const { repoMenu } = require('./commands/repo');
const { releaseMenu } = require('./commands/release');
const { authMenu } = require('./commands/auth');
const { clearLastLines } = require('./utils/display');

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
    ghRaw('auth status 2>&1', { silent: true });
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

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

main().catch(err => {
  console.error(color.red(err.message || err));
  process.exit(1);
});
