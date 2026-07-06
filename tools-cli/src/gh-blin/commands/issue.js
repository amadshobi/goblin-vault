const p = require('@clack/prompts');
const color = require('picocolors');
const { ghExec, ghRaw } = require('../utils/gh');
const { formatIssue, showInPager, clearLastLines } = require('../utils/display');

async function listIssues(repo, state = 'OPEN') {
  const s = p.spinner();
  s.start(`Fetching ${state} issues...`);
  try {
    const issues = ghExec(`issue list --repo "${repo}" --state ${state} --json number,title,state,author,createdAt,labels`);
    s.stop(`Found ${issues?.length || 0} issues`);
    if (!issues || issues.length === 0) {
      p.note(`No ${state.toLowerCase()} issues found.`);
      return [];
    }
    return issues;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return [];
  }
}

async function viewIssue(repo, issueNumber) {
  const s = p.spinner();
  s.start('Fetching issue details...');
  try {
    const issue = ghExec(`issue view ${issueNumber} --repo "${repo}" --json number,title,state,body,author,createdAt,labels,comments`);
    s.stop('Done');
    
    let output = `#${issue.number} ${issue.title}\n`;
    output += `State: ${issue.state} | Author: ${issue.author?.login} | Created: ${issue.createdAt}\n`;
    if (issue.labels?.length) {
      output += `Labels: ${issue.labels.map(l => l.name).join(', ')}\n`;
    }
    output += '\n' + '-'.repeat(60) + '\n\n';
    output += issue.body || '(no description)';

    if (issue.comments?.length) {
      output += '\n\n' + '-'.repeat(60) + '\nCOMMENTS:\n';
      issue.comments.slice(0, 5).forEach(c => {
        output += `\n${color.bold(c.author?.login)} (${c.createdAt}):\n`;
        output += `  ${(c.body || '(no body)').slice(0, 200)}`;
        if (c.body?.length > 200) output += '...';
        output += '\n';
      });
      if (issue.comments.length > 5) output += `\n...and ${issue.comments.length - 5} more comments`;
    }
    
    showInPager(output, `Issue #${issue.number}`);
    return issue;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return null;
  }
}

async function createIssue(repo) {
  const title = await p.text({ message: 'Judul Issue:', placeholder: 'Bug: something broke' });
  if (p.isCancel(title)) { clearLastLines(2); return; }
  const body = await p.text({ message: 'Deskripsi (optional):', placeholder: 'Steps to reproduce...' });
  if (p.isCancel(body)) { clearLastLines(2); return; }

  const s = p.spinner();
  s.start('Creating issue...');
  try {
    let cmd = `issue create --repo "${repo}" --title "${title.replace(/"/g, '\\"')}"`;
    if (body.trim()) cmd += ` --body "${body.replace(/"/g, '\\"')}"`;
    const out = ghRaw(cmd);
    s.stop('Issue Created');
    p.note(out, 'New Issue');
    return true;
  } catch (err) {
    s.stop('Error');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function closeIssue(repo, issueNumber) {
  const confirmed = await p.confirm({
    message: `Close issue #${issueNumber}?`,
  });
  if (p.isCancel(confirmed) || !confirmed) { clearLastLines(2); return false; }

  const s = p.spinner();
  s.start(`Closing issue #${issueNumber}...`);
  try {
    const out = ghRaw(`issue close ${issueNumber} --repo "${repo}"`);
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

async function issueMenu(repo) {
  while (true) {
    const action = await p.select({
      message: `Issues — ${color.cyan(repo)}`,
      options: [
        { value: 'listOpen', label: 'List Open Issues' },
        { value: 'listClosed', label: 'List Closed Issues' },
        { value: 'view', label: 'View Issue' },
        { value: 'create', label: 'Create Issue' },
        { value: 'close', label: 'Close Issue' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    if (action === 'listOpen' || action === 'listClosed') {
      const state = action === 'listOpen' ? 'OPEN' : 'CLOSED';
      const issues = await listIssues(repo, state);
      if (issues.length > 0) {
        const listStr = issues.map(i => `  ${formatIssue(i)}`).join('\n');
        p.note(listStr, `Issues (${state})`);
      }
      await continuePrompt();
    } else if (action === 'view' || action === 'close') {
      const issues = await listIssues(repo, 'OPEN');
      if (issues.length === 0) { await continuePrompt(); continue; }
      const issueNum = await selectIssue(issues);
      if (!issueNum) continue;

      switch (action) {
        case 'view': await viewIssue(repo, issueNum); break;
        case 'close': await closeIssue(repo, issueNum); break;
      }
      await continuePrompt();
    } else if (action === 'create') {
      await createIssue(repo);
      await continuePrompt();
    }
  }
}

async function selectIssue(issues) {
  const choices = issues.map(i => ({
    value: i.number,
    label: formatIssue(i),
  }));
  const selected = await p.select({
    message: 'Pilih Issue:',
    options: choices,
  });
  if (p.isCancel(selected)) { clearLastLines(2); return null; }
  return selected;
}

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

module.exports = { issueMenu };
