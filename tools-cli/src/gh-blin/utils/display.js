const color = require('picocolors');

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/** Buang semua ANSI styling codes dari string. */
function stripAnsi(str) {
  return String(str).replace(ANSI_PATTERN, '');
}

/** Hitung lebar visual string (tanpa menghitung ANSI codes). */
function visualWidth(str) {
  return stripAnsi(str).length;
}

/**
 * Truncate ke maxLen karakter VISUAL, tetap mempertahankan ANSI codes
 * (tidak pernah memotong di tengah escape sequence). Tambah '...' + reset
 * warna kalau terpotong.
 */
function truncateVisual(str, maxLen) {
  if (!str) return '';
  if (visualWidth(str) <= maxLen) return String(str);
  const limit = Math.max(0, maxLen - 3);
  let out = '';
  let visible = 0;
  const tokens = String(str).match(/\x1b\[[0-9;]*m|[^\x1b]/g) || [];
  for (const tok of tokens) {
    if (tok[0] === '\x1b') {
      out += tok; // ANSI tidak menambah lebar visual
      continue;
    }
    if (visible >= limit) break;
    out += tok;
    visible++;
  }
  const reset = ANSI_PATTERN.test(str) ? '\x1b[0m' : '';
  return out + '...' + reset;
}

/** Pad string ke targetLen karakter VISUAL (ANSI codes diabaikan). */
function padVisual(str, targetLen) {
  const pad = targetLen - visualWidth(str);
  return pad > 0 ? str + ' '.repeat(pad) : String(str);
}

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
 * Format a review block for terminal display: bordered box with PR header,
 * stats line, and the review text inside. Alignment dihitung dari lebar
 * VISUAL (ANSI styling codes tidak menggeser border).
 * @param {string} reviewText - The review body/comment to display.
 * @param {object} [prData] - PR context {number, title, author, state, additions, deletions, files, createdAt}.
 * @param {object} [meta] - AI metadata untuk footer: {model, backend, tokens:{total}}.
 * @returns {string} Formatted string ready for console.log.
 */
function formatReview(reviewText, prData = {}, meta = {}) {
  const width = 60;
  const bar = color.dim('─'.repeat(width));

  // Header: #num + title
  const num = prData.number != null ? `#${prData.number}` : '';
  const title = truncate(prData.title || '(no title)', 40);
  const headerLine = `║${color.bold(color.cyan(padVisual(truncateVisual(`${num} ${title}`.trim(), width), width)))}║`;

  // Stats: author, state, additions/deletions, files, created
  const stats = [];
  if (prData.author?.login) stats.push(`author: ${prData.author.login}`);
  if (prData.state) stats.push(`state: ${prData.state}`);
  if (typeof prData.additions === 'number') stats.push(`+${prData.additions}`);
  if (typeof prData.deletions === 'number') stats.push(`-${prData.deletions}`);
  if (Array.isArray(prData.files)) stats.push(`files: ${prData.files.length}`);
  if (prData.createdAt) stats.push(`created: ${truncate(prData.createdAt, 10)}`);
  const statsText = stats.length ? truncateVisual(stats.join('  '), width) : ' '.repeat(width);
  const statsLine = `║${color.dim(padVisual(statsText, width))}║`;

  // Review body boxed — ukur & pad berdasarkan lebar visual
  const bodyLines = String(reviewText || '(no review comment)').split('\n');
  const body = bodyLines
    .map(line => `║ ${padVisual(truncateVisual(line, width - 2), width - 2)} ║`)
    .join('\n');

  // Footer AI metadata (opsional): model + backend + total tokens
  const footer = [];
  if (meta && (meta.model != null || meta.tokens?.total != null)) {
    const model = meta.model || '(default)';
    const backend = meta.backend ? ` (${meta.backend})` : '';
    const tokens = meta.tokens?.total != null
      ? ` · tokens: ${meta.tokens.total.toLocaleString('id-ID')}`
      : '';
    const footerText = truncateVisual(`Model: ${model}${backend}${tokens}`, width);
    footer.push(`║${color.dim(padVisual(footerText, width))}║`);
  }

  return [
    `╔${bar}╗`,
    headerLine,
    statsLine,
    `║${bar}║`,
    body,
    ...footer,
    `╚${bar}╝`,
  ].join('\n');
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

module.exports = { stripAnsi, visualWidth, truncateVisual, padVisual, truncate, formatPR, formatIssue, formatRelease, formatRepo, formatReview, showInPager, clearLastLines };
