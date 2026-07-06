const p = require('@clack/prompts');
const color = require('picocolors');
const { ghExec, ghRaw, getCurrentRepo } = require('../utils/gh');
const { formatPR, showInPager } = require('../utils/display');
const { clearLastLines } = require('../utils/display');

async function listPRs(repo, state = 'OPEN') {
  const s = p.spinner();
  s.start(`Fetching ${state} PRs...`);
  try {
    const prs = ghExec(`pr list --repo "${repo}" --state ${state} --json number,title,state,author,headRefName,createdAt`);
    s.stop(`Found ${prs?.length || 0} PRs`);
    if (!prs || prs.length === 0) {
      p.note(`No ${state.toLowerCase()} PRs found.`);
      return [];
    }
    return prs;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return [];
  }
}

async function viewPR(repo, prNumber) {
  const s = p.spinner();
  s.start('Fetching PR details...');
  try {
    const pr = ghExec(`pr view ${prNumber} --repo "${repo}" --json number,title,state,body,author,headRefName,baseRefName,createdAt,mergedAt,additions,deletions,files,reviews`);
    s.stop('Done');
    
    let output = `#${pr.number} ${pr.title}\n`;
    output += `State: ${pr.state} | Author: ${pr.author?.login} | Branch: ${pr.headRefName} → ${pr.baseRefName}\n`;
    output += `+${pr.additions} -${pr.deletions} lines | Created: ${pr.createdAt}\n`;
    if (pr.mergedAt) output += `Merged: ${pr.mergedAt}\n`;
    output += '\n' + '-'.repeat(60) + '\n\n';
    output += pr.body || '(no description)';

    if (pr.reviews?.length) {
      output += '\n\n' + '-'.repeat(60) + '\nREVIEWS:\n';
      pr.reviews.forEach(r => {
        output += `  ${r.author?.login}: ${r.state} (${r.body?.slice(0, 100) || 'no comment'})\n`;
      });
    }

    if (pr.files?.length) {
      output += '\n\n' + '-'.repeat(60) + '\nFILES CHANGED:\n';
      pr.files.forEach(f => {
        output += `  ${f.status === 'added' ? '+' : f.status === 'removed' ? '-' : '~'} ${f.path} (+${f.additions}/-${f.deletions})\n`;
      });
    }
    
    showInPager(output, `PR #${pr.number}`);
    return pr;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return null;
  }
}

async function checkoutPR(repo, prNumber) {
  const s = p.spinner();
  s.start(`Checking out PR #${prNumber}...`);
  try {
    const out = ghRaw(`pr checkout ${prNumber} --repo "${repo}"`);
    s.stop('Done');
    p.note(out, 'Checkout');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function approvePR(repo, prNumber) {
  const s = p.spinner();
  s.start(`Approving PR #${prNumber}...`);
  try {
    const out = ghRaw(`pr review ${prNumber} --repo "${repo}" --approve`);
    s.stop('Approved');
    p.note(out, 'Approval');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function mergePR(repo, prNumber) {
  const s = p.spinner();
  s.start(`Merging PR #${prNumber}...`);
  try {
    const out = ghRaw(`pr merge ${prNumber} --repo "${repo}" --merge`);
    s.stop('Merged');
    p.note(out, 'Merge');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function closePR(repo, prNumber) {
  const confirmed = await p.confirm({
    message: `Close PR #${prNumber} without merging?`,
  });
  if (p.isCancel(confirmed) || !confirmed) { clearLastLines(2); return false; }

  const s = p.spinner();
  s.start(`Closing PR #${prNumber}...`);
  try {
    const out = ghRaw(`pr close ${prNumber} --repo "${repo}"`);
    s.stop('Closed');
    p.note(out, 'Close');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function createPR(repo) {
  const head = await p.text({ message: 'Branch source (head):', placeholder: 'feature/my-feature' });
  if (p.isCancel(head)) { clearLastLines(2); return; }
  const base = await p.text({ message: 'Branch target (base):', placeholder: 'main', initialValue: 'main' });
  if (p.isCancel(base)) { clearLastLines(2); return; }
  const title = await p.text({ message: 'Judul PR:', placeholder: 'Add amazing feature' });
  if (p.isCancel(title)) { clearLastLines(2); return; }
  const body = await p.text({ message: 'Deskripsi (optional):', placeholder: 'Closes #...' });
  if (p.isCancel(body)) { clearLastLines(2); return; }

  const s = p.spinner();
  s.start('Creating PR...');
  try {
    let cmd = `pr create --repo "${repo}" --head "${head}" --base "${base}" --title "${title.replace(/"/g, '\\"')}"`;
    if (body.trim()) cmd += ` --body "${body.replace(/"/g, '\\"')}"`;
    const out = ghRaw(cmd);
    s.stop('PR Created');
    p.note(out, 'New PR');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function prMenu(repo) {
  while (true) {
    const action = await p.select({
      message: `PR — ${color.cyan(repo)}`,
      options: [
        { value: 'listOpen', label: 'List Open PRs' },
        { value: 'listClosed', label: 'List Closed/Merged PRs' },
        { value: 'view', label: 'View PR Details' },
        { value: 'checkout', label: 'Checkout PR' },
        { value: 'approve', label: 'Approve PR' },
        { value: 'merge', label: 'Merge PR' },
        { value: 'close', label: 'Close PR' },
        { value: 'create', label: 'Create PR' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    if (action === 'listOpen' || action === 'listClosed') {
      const state = action === 'listOpen' ? 'OPEN' : 'CLOSED';
      const prs = await listPRs(repo, state);
      if (prs.length > 0) {
        const listStr = prs.map(p => `  ${formatPR(p)}`).join('\n');
        p.note(listStr, `PRs (${state})`);
      }
      await continuePrompt();
    } else if (action === 'view' || action === 'checkout' || action === 'approve' || action === 'merge' || action === 'close') {
      const prs = await listPRs(repo, 'OPEN');
      if (prs.length === 0) { await continuePrompt(); continue; }
      const prNum = await selectPR(prs);
      if (!prNum) continue;

      switch (action) {
        case 'view': await viewPR(repo, prNum); break;
        case 'checkout': await checkoutPR(repo, prNum); break;
        case 'approve': await approvePR(repo, prNum); break;
        case 'merge': await mergePR(repo, prNum); break;
        case 'close': await closePR(repo, prNum); break;
      }
      await continuePrompt();
    } else if (action === 'create') {
      await createPR(repo);
      await continuePrompt();
    }
  }
}

async function selectPR(prs) {
  const choices = prs.map(pr => ({
    value: pr.number,
    label: formatPR(pr),
  }));
  const selected = await p.select({
    message: 'Pilih PR:',
    options: choices,
  });
  if (p.isCancel(selected)) { clearLastLines(2); return null; }
  return selected;
}

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

module.exports = { prMenu };
