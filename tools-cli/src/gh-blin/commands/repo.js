const p = require('@clack/prompts');
const color = require('picocolors');
const { execSync } = require('child_process');
const { ghExec, ghRaw } = require('../utils/gh');
const { formatRepo, clearLastLines } = require('../utils/display');

async function listRepos(limit = 50) {
  const s = p.spinner();
  s.start('Fetching repos...');
  try {
    const repos = ghExec(`repo list --limit ${limit} --json nameWithOwner,isPrivate,stargazerCount,description`);
    s.stop(`Found ${repos?.length || 0} repos`);
    return repos || [];
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return [];
  }
}

async function cloneRepo(repo) {
  const dir = await p.text({
    message: 'Directory tujuan:',
    placeholder: `~/projects/${repo.split('/')[1]}`,
    initialValue: `~/projects/${repo.split('/')[1]}`,
  });
  if (p.isCancel(dir)) { clearLastLines(2); return; }

  let resolvedPath = dir.trim();
  if (resolvedPath.startsWith('~')) {
    resolvedPath = require('path').join(process.env.HOME, resolvedPath.slice(1));
  }

  const s = p.spinner();
  s.start(`Cloning ${repo}...`);
  try {
    const out = execSync(`gh repo clone "${repo}" "${resolvedPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
    });
    s.stop('Cloned');
    p.note(out, 'Clone');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message || err.stderr?.trim()));
    clearLastLines(2);
    return false;
  }
}

async function viewRepo(repo) {
  const s = p.spinner();
  s.start('Fetching repo details...');
  try {
    const r = ghExec(`repo view "${repo}" --json nameWithOwner,description,url,isPrivate,stargazerCount,forkCount,primaryLanguage,homepageUrl,defaultBranch`);
    s.stop('Done');
    
    let output = `${r.nameWithOwner}\n`;
    output += `${'-'.repeat(50)}\n`;
    output += `${r.description || '(no description)'}\n\n`;
    output += `URL: ${r.url}\n`;
    output += `Visibility: ${r.isPrivate ? 'Private' : 'Public'}\n`;
    output += `Stars: ${r.stargazerCount} | Forks: ${r.forkCount}\n`;
    if (r.primaryLanguage) output += `Language: ${r.primaryLanguage.name}\n`;
    if (r.defaultBranch) output += `Default branch: ${r.defaultBranch}\n`;
    if (r.homepageUrl) output += `Homepage: ${r.homepageUrl}\n`;
    
    p.note(output, 'Repository Info');
    return r;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return null;
  }
}

async function openRepo(repo) {
  const s = p.spinner();
  s.start(`Opening ${repo} in browser...`);
  try {
    ghRaw(`repo view "${repo}" --web`);
    s.stop('Opened in browser');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function repoMenu() {
  while (true) {
    const action = await p.select({
      message: 'Repos',
      options: [
        { value: 'list', label: 'List Repos' },
        { value: 'view', label: 'View Repo Details' },
        { value: 'clone', label: 'Clone Repo' },
        { value: 'open', label: 'Open in Browser' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    if (action === 'list') {
      const repos = await listRepos();
      if (repos.length > 0) {
        const listStr = repos.map(r => `  ${formatRepo(r)}`).join('\n');
        p.note(listStr, 'Your Repos');
      }
      await continuePrompt();
    } else if (action === 'view' || action === 'clone' || action === 'open') {
      const repos = await listRepos();
      if (repos.length === 0) { await continuePrompt(); continue; }
      const repo = await selectRepo(repos);
      if (!repo) continue;

      switch (action) {
        case 'view': await viewRepo(repo); break;
        case 'clone': await cloneRepo(repo); break;
        case 'open': await openRepo(repo); break;
      }
      await continuePrompt();
    }
  }
}

async function selectRepo(repos) {
  const choices = repos.map(r => ({
    value: r.nameWithOwner,
    label: `${r.nameWithOwner}${r.stargazerCount ? ` ${r.stargazerCount}` : ''}`,
  }));
  const selected = await p.select({
    message: 'Pilih repository:',
    options: choices,
    maxItems: 15,
  });
  if (p.isCancel(selected)) { clearLastLines(2); return null; }
  return selected;
}

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

module.exports = { repoMenu };
