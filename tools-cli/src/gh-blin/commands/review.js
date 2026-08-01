/**
 * gh-blin AI review command — orchestrate PR review flow:
 *   fetch metadata + diff (gh / ghApi) → generate AI review (utils/ai.js)
 *   → record log (utils/scheduler.js) → display (utils/display.js).
 *
 * Public API:
 *   reviewPR(prNumber, options)   — manual review 1 PR
 *   autoReviewAll(options)        — batch / scheduled review of all open PRs
 *   reviewMenu()                  — interactive TUI menu
 */
const p = require('@clack/prompts');
const color = require('picocolors');
const { ghExec, ghRaw, ghApi, getCurrentRepo, selectRepo } = require('../utils/gh');
const { generateReview } = require('../utils/ai');
const { hasBeenReviewed, recordReview } = require('../utils/scheduler');
const { formatReview, clearLastLines } = require('../utils/display');
const { continuePrompt } = require('../utils/prompt');

/**
 * Fetch PR metadata via `gh pr view` (JSON fields incl. headRefOid = head SHA).
 * @param {string} repo - Format owner/name.
 * @param {number|string} prNumber
 * @returns {object} prData normalized untuk AI review & display.
 * @throws {Error} Kalau PR tidak ditemukan / gh error.
 */
function fetchPRData(repo, prNumber) {
  const pr = ghExec([
    'pr', 'view', String(prNumber), '--repo', repo,
    '--json', 'number,title,body,state,author,headRefName,headRefOid,baseRefName,createdAt,additions,deletions,files',
  ]);
  if (!pr || !pr.number) {
    throw new Error(`PR #${prNumber} tidak ditemukan di ${repo}.`);
  }
  return {
    repo,
    number: pr.number,
    title: pr.title || '(no title)',
    body: pr.body || '',
    state: pr.state,
    author: pr.author || {},
    headRefName: pr.headRefName,
    headSha: pr.headRefOid,
    baseRefName: pr.baseRefName,
    createdAt: pr.createdAt,
    additions: pr.additions,
    deletions: pr.deletions,
    files: pr.files || [],
  };
}

/**
 * Fetch PR diff sebagai raw text.
 * @returns {string}
 * @throws {Error} Kalau gh gagal.
 */
function getPRDiff(repo, prNumber) {
  return ghRaw(['pr', 'diff', String(prNumber), '--repo', repo]) || '';
}

/**
 * Post review sebagai komentar resmi GitHub PR via REST (ghApi POST).
 * Tidak melempar exception pada kegagalan publish — kembalikan detail error
 * supaya caller bisa menampilkan notifikasi tanpa kehilangan hasil review.
 * @returns {{ ok: boolean, id?: number, error?: string }}
 */
function publishReview(repo, prNumber, reviewText) {
  try {
    const res = ghApi(`/repos/${repo}/pulls/${prNumber}/reviews`, {
      method: 'POST',
      body: { body: reviewText, event: 'COMMENT' },
    });
    if (res?.id) {
      return { ok: true, id: res.id };
    }
    // Response 2xx tapi tanpa ID, atau shape error API — tangkap detail pesannya.
    const apiErr = res?.message || 'response tanpa review ID';
    return { ok: false, error: `GitHub API mengembalikan response tanpa review ID: ${String(apiErr).slice(0, 200)}` };
  } catch (err) {
    // ghApi throw (HTTP error / jaringan) — jangan biarkan jadi silent failure.
    return { ok: false, error: err.message };
  }
}

/**
 * Review satu PR: fetch metadata + diff, generate review AI, publish (opsional),
 * dan catat ke review log.
 * @param {number|string} prNumber
 * @param {object} [options]
 * @param {string} [options.repo] - Repo aktif; default auto-detect dari CWD.
 * @param {boolean} [options.publish] - Post review sebagai komentar resmi GitHub.
 * @param {boolean} [options.force] - Review ulang walau SHA sudah tercatat.
 * @param {string} [options.model] - Model override (CLI flag `--model`), di-resolve via config.
 * @returns {object} { ok, skipped?, reason?, review?, prompt?, model?, backend?, tokens?,
 *                    prData?, published?, publishError?, error? }
 */
async function reviewPR(prNumber, options = {}) {
  const repo = options.repo || getCurrentRepo();
  if (!repo) {
    return { ok: false, error: 'Tidak ada repo aktif. Pilih repo dulu.' };
  }
  const n = Number(prNumber);
  if (!Number.isInteger(n) || n <= 0) {
    return { ok: false, prNumber, error: `Nomor PR tidak valid: "${prNumber}"` };
  }

  try {
    const prData = fetchPRData(repo, n);

    // Skip kalau commit head SHA ini sudah pernah di-review (kecuali --force).
    if (!options.force && hasBeenReviewed(repo, n, prData.headSha)) {
      return {
        ok: true,
        skipped: true,
        prData,
        reason: `PR #${n} sudah di-review untuk commit ${String(prData.headSha || '').slice(0, 7)}. Gunakan --force untuk review ulang.`,
      };
    }

    const diff = getPRDiff(repo, n);
    const { review, prompt, model, backend, tokens } = generateReview(prData, diff, options);

    const result = {
      ok: true, skipped: false, review, prompt, model, backend, tokens,
      prData, published: false, publishError: null,
    };
    if (options.publish) {
      const pub = publishReview(repo, n, review);
      result.published = pub.ok;
      if (!pub.ok) result.publishError = pub.error || 'unknown error';
    }

    const reviewMeta = {
      headSha: prData.headSha,
      status: prData.state,
      published: result.published,
      model,
      backend,
      tokens,
    };
    if (result.publishError) reviewMeta.publishError = result.publishError;
    recordReview(repo, n, reviewMeta);

    return result;
  } catch (err) {
    return { ok: false, prNumber: n, error: err.message };
  }
}

/**
 * Batch / scheduled review semua open PRs.
 * Skips PR yang SHA-nya sudah tercatat di review log (kecuali --force).
 * @param {object} [options] - Sama seperti reviewPR + optional repo.
 * @returns {object} Summary { ok, total, reviewed[], skipped[], failed[{number,error}], publishFailed[{number,error}] }
 */
async function autoReviewAll(options = {}) {
  const repo = options.repo || getCurrentRepo();
  if (!repo) {
    return { ok: false, error: 'Tidak ada repo aktif. Pilih repo dulu.' };
  }

  const prs = ghExec(['pr', 'list', '--repo', repo, '--state', 'OPEN', '--json', 'number,title,headRefOid']);
  if (!Array.isArray(prs) || prs.length === 0) {
    return { ok: true, total: 0, reviewed: [], skipped: [], failed: [], publishFailed: [] };
  }

  const summary = { ok: true, total: prs.length, reviewed: [], skipped: [], failed: [], publishFailed: [] };
  for (const pr of prs) {
    if (!options.force && hasBeenReviewed(repo, pr.number, pr.headRefOid)) {
      summary.skipped.push(pr.number);
      continue;
    }
    const res = await reviewPR(pr.number, { repo, publish: options.publish, force: options.force });
    if (res.ok && !res.skipped) {
      summary.reviewed.push(pr.number);
      if (res.publishError) summary.publishFailed.push({ number: pr.number, error: res.publishError });
    } else if (res.ok && res.skipped) {
      summary.skipped.push(pr.number);
    } else {
      summary.failed.push({ number: pr.number, error: res.error });
    }
  }
  return summary;
}

/** Tampilkan hasil satu review ke terminal (interaktif). */
async function showReviewResult(res) {
  if (!res.ok) {
    p.cancel(color.red(res.error));
    clearLastLines(2);
    return;
  }
  if (res.skipped) {
    p.note(color.yellow(res.reason), 'Skipped');
    await continuePrompt();
    return;
  }
  console.log(formatReview(res.review, res.prData, {
    model: res.model,
    backend: res.backend,
    tokens: res.tokens,
  }));
  if (res.published) {
    p.note(color.green(`Review PR #${res.prData.number} dipublikasikan ke GitHub.`), 'Published');
  } else if (res.publishError) {
    p.note(color.yellow(`Review gagal dipublish ke GitHub: ${res.publishError}`), 'Publish Failed');
  }
  await continuePrompt();
}

/** Tampilkan ringkasan batch review (interaktif). */
async function showBatchSummary(summary) {
  if (!summary.ok) {
    p.cancel(color.red(summary.error));
    clearLastLines(2);
    return;
  }
  const parts = [];
  if (summary.reviewed.length) parts.push(`${color.green('Reviewed: ' + summary.reviewed.length)}`);
  if (summary.skipped.length) parts.push(`${color.yellow('Skipped: ' + summary.skipped.length)}`);
  if (summary.publishFailed.length) parts.push(`${color.yellow('Publish Failed: ' + summary.publishFailed.length)}`);
  if (summary.failed.length) parts.push(`${color.red('Failed: ' + summary.failed.length)}`);
  p.note(parts.join('  ') || color.dim('Tidak ada open PR.'), 'Summary');
  if (summary.publishFailed.length) {
    summary.publishFailed.forEach(f => p.note(color.yellow(f.error), `PR #${f.number} gagal publish`));
  }
  if (summary.failed.length) {
    summary.failed.forEach(f => p.note(color.red(f.error), `PR #${f.number} gagal`));
  }
  await continuePrompt();
}

/** Review satu PR via prompt interaktif. */
async function runSingleInteractive(repo) {
  const numStr = await p.text({ message: 'Nomor PR:', placeholder: 'e.g. 12' });
  if (p.isCancel(numStr) || !numStr.trim()) { clearLastLines(2); return; }

  const shouldPublish = await p.confirm({
    message: 'Post hasil review sebagai komentar resmi GitHub?',
    initialValue: false,
  });
  if (p.isCancel(shouldPublish)) { clearLastLines(2); return; }

  const res = await reviewPR(numStr.trim(), { repo, publish: shouldPublish });
  await showReviewResult(res);
}

/** Review semua open PRs via prompt interaktif. */
async function runAutoInteractive(repo) {
  const s = p.spinner();
  s.start('Fetching open PRs...');
  const prs = ghExec(['pr', 'list', '--repo', repo, '--state', 'OPEN', '--json', 'number,title']);
  s.stop(`Found ${prs?.length || 0} open PRs`);
  if (!Array.isArray(prs) || prs.length === 0) {
    p.note(color.dim('Tidak ada open PR untuk di-review.'), 'Empty');
    await continuePrompt();
    return;
  }

  const shouldPublish = await p.confirm({
    message: 'Post hasil review ke GitHub sebagai komentar resmi?',
    initialValue: false,
  });
  if (p.isCancel(shouldPublish)) { clearLastLines(2); return; }

  s.start('Reviewing open PRs...');
  const summary = await autoReviewAll({ repo, publish: shouldPublish });
  s.stop('Done');
  await showBatchSummary(summary);
}

/**
 * Menu interaktif AI Review untuk dipanggil dari TUI.
 * @param {string} [repo] - Repo aktif; kalau kosong, auto-detect atau minta pilih.
 */
async function reviewMenu(repo) {
  const activeRepo = repo || getCurrentRepo();
  if (!activeRepo) {
    p.note(color.dim('Belum ada repo aktif. Pilih repo dulu:'), 'Repo Required');
    const picked = await selectRepo('Pilih repository:');
    if (!picked) { clearLastLines(2); return; }
    return await reviewMenu(picked);
  }

  while (true) {
    const action = await p.select({
      message: `AI Review — ${color.cyan(activeRepo)}`,
      options: [
        { value: 'all', label: 'Review Semua Open PRs', hint: 'batch' },
        { value: 'single', label: 'Review PR Tertentu', hint: 'manual' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    if (action === 'all') {
      await runAutoInteractive(activeRepo);
    } else if (action === 'single') {
      await runSingleInteractive(activeRepo);
    }
  }
}

module.exports = { reviewPR, autoReviewAll, reviewMenu };
