const color = require('picocolors');

/**
 * Truncate string to max length with ellipsis.
 */
function truncate(str, maxLen = 50) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

/**
 * Format a PR object for display in a list.
 */
function formatPR(pr) {
  const stateIcon = pr.state === 'OPEN' ? color.green('[OPEN]') : pr.state === 'MERGED' ? color.magenta('[MERGE]') : color.red('[CLOSE]');
  const title = truncate(pr.title, 60);
  const author = pr.author?.login || 'unknown';
  const number = `#${pr.number}`;
  return `${stateIcon} ${color.cyan(number.padEnd(7))} ${color.bold(title)} — ${color.dim(author)}`;
}

/**
 * Format an Issue object for display.
 */
function formatIssue(issue) {
  const stateIcon = issue.state === 'OPEN' ? color.green('[OPEN]') : color.red('[CLOS]');
  const title = truncate(issue.title, 60);
  const number = `#${issue.number}`;
  return `${stateIcon} ${color.cyan(number.padEnd(7))} ${color.bold(title)}`;
}

/**
 * Format a Release for display.
 */
function formatRelease(release) {
  const isDraft = release.isDraft ? color.yellow(' [DRAFT]') : '';
  const isPrerelease = release.isPrerelease ? color.dim(' [pre]') : '';
  const tag = color.green(release.tagName || release.tag_name || '?');
  return `${tag}${isDraft}${isPrerelease} — ${truncate(release.name || '(no name)', 50)}`;
}

/**
 * Format a Repo for display.
 */
function formatRepo(repo) {
  const vis = repo.isPrivate ? color.dim('[PRIV]') : color.cyan('[PUB]');
  const stars = repo.stargazerCount ? ` *${repo.stargazerCount}` : '';
  return `${vis} ${color.cyan(repo.nameWithOwner)}${stars}`;
}

/**
 * Open content in pager (less/bat) or just log it.
 */
function showInPager(content, title = '') {
  const fs = require('fs');
  const path = require('path');
  const tmpFile = path.join('/tmp', `gh-blin-${Date.now()}.tmp`);
  const header = title ? `${title}\n${'-'.repeat(60)}\n\n` : '';
  fs.writeFileSync(tmpFile, header + content, 'utf8');

  const { execSync } = require('child_process');
  // Try bat first, fallback to less
  const cmd = process.env.PAGER || (tryCmd('bat') ? `bat -p --file-name "${title || 'preview'}"` : tryCmd('batcat') ? `batcat -p --file-name "${title || 'preview'}"` : 'less -R');
  
  try {
    execSync(`${cmd} "${tmpFile}"`, { stdio: 'inherit' });
  } catch (_) {
    // fallback: just print
    console.log(content);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

function tryCmd(cmd) {
  try {
    require('child_process').execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Clear the last N lines from terminal (ANSI escape).
 */
function clearLastLines(numLines = 2) {
  for (let i = 0; i < numLines; i++) {
    process.stdout.write('\x1b[1A\x1b[2K');
  }
}

module.exports = { truncate, formatPR, formatIssue, formatRelease, formatRepo, showInPager, clearLastLines };
