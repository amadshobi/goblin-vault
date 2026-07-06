const p = require('@clack/prompts');
const color = require('picocolors');
const { ghExec, ghRaw } = require('../utils/gh');
const { formatRelease, clearLastLines } = require('../utils/display');

async function listReleases(repo, limit = 20) {
  const s = p.spinner();
  s.start('Fetching releases...');
  try {
    const releases = ghExec(`release list --repo "${repo}" --limit ${limit} --json tagName,name,isDraft,isPrerelease,publishedAt`);
    s.stop(`Found ${releases?.length || 0} releases`);
    if (!releases || releases.length === 0) {
      p.note('No releases found.');
      return [];
    }
    return releases;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return [];
  }
}

async function viewRelease(repo, tagName) {
  const s = p.spinner();
  s.start('Fetching release details...');
  try {
    const release = ghRaw(`release view "${tagName}" --repo "${repo}"`);
    s.stop('Done');
    
    p.note(release, `Release: ${tagName}`);
    return release;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return null;
  }
}

async function createRelease(repo) {
  const tag = await p.text({ message: 'Tag name:', placeholder: 'v1.0.0' });
  if (p.isCancel(tag)) { clearLastLines(2); return; }
  const name = await p.text({ message: 'Release name:', placeholder: 'v1.0.0', initialValue: tag });
  if (p.isCancel(name)) { clearLastLines(2); return; }
  const notes = await p.text({ message: 'Release notes (optional):', placeholder: 'What changed in this release' });
  if (p.isCancel(notes)) { clearLastLines(2); return; }

  const isPrerelease = await p.confirm({ message: 'Pre-release?', initialValue: false });
  if (p.isCancel(isPrerelease)) { clearLastLines(2); return; }

  const s = p.spinner();
  s.start('Creating release...');
  try {
    let cmd = `release create "${tag}" --repo "${repo}" --title "${name.replace(/"/g, '\\"')}"`;
    if (notes.trim()) cmd += ` --notes "${notes.replace(/"/g, '\\"')}"`;
    if (isPrerelease) cmd += ' --prerelease';
    const out = ghRaw(cmd);
    s.stop('Release Created');
    p.note(out, 'New Release');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function releaseMenu(repo) {
  while (true) {
    const action = await p.select({
      message: `Releases — ${color.cyan(repo)}`,
      options: [
        { value: 'list', label: 'List Releases' },
        { value: 'view', label: 'View Release' },
        { value: 'create', label: 'Create Release' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    if (action === 'list') {
      const releases = await listReleases(repo);
      if (releases.length > 0) {
        const listStr = releases.map(r => `  ${formatRelease(r)}`).join('\n');
        p.note(listStr, 'Releases');
      }
      await continuePrompt();
    } else if (action === 'view') {
      const releases = await listReleases(repo);
      if (releases.length === 0) { await continuePrompt(); continue; }
      const tag = await selectRelease(releases);
      if (!tag) continue;
      await viewRelease(repo, tag);
      await continuePrompt();
    } else if (action === 'create') {
      await createRelease(repo);
      await continuePrompt();
    }
  }
}

async function selectRelease(releases) {
  const choices = releases.map(r => ({
    value: r.tagName || r.tag_name,
    label: formatRelease(r),
  }));
  const selected = await p.select({
    message: 'Pilih Release:',
    options: choices,
  });
  if (p.isCancel(selected)) { clearLastLines(2); return null; }
  return selected;
}

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

module.exports = { releaseMenu };
