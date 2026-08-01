/**
 * gh-blin review scheduler — track PR review history in a local JSON log.
 *
 * Log file: ~/.config/goblin-vault/gh-blin-reviews.json
 * (lokasi bisa di-override via env XDG_CONFIG_HOME).
 *
 * Shape log:
 * {
 *   "<owner>/<repo>": {
 *     "<prNumber>": {
 *       "lastReviewedAt": "<ISO-8601>",
 *       "headSha": "<commit sha>",
 *       "status": "<review status>",
 *       "published": true,
 *       "model": "<model LLM yang dipakai>",
 *       "variant": "<high|medium|low|null>",
 *       "backend": "<opencode|openai>",
 *       "tokens": { "prompt": <n>, "completion": <n>, "total": <n> },
 *       ...metadata lain
 *     }
 *   }
 * }
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

/** Config folder: $XDG_CONFIG_HOME/goblin-vault atau ~/.config/goblin-vault */
function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'goblin-vault');
}

function logFilePath() {
  return path.join(configDir(), 'gh-blin-reviews.json');
}

/**
 * Load review log dari disk. Return {} kalau file belum ada.
 * @returns {object} Raw review log.
 * @throws {Error} Kalau file ada tapi tidak bisa dibaca/parsed (corrupt).
 */
function loadReviewLog() {
  const file = logFilePath();
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw new Error(`gh-blin: gagal membaca review log ${file}: ${err.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('root log bukan object');
  } catch (err) {
    throw new Error(`gh-blin: review log corrupt di ${file}: ${err.message}`);
  }
}

/**
 * Persist review log ke disk. Membuat folder config otomatis jika belum ada,
 * dan menulis secara atomik (tmp file + rename) agar file tidak korup saat crash.
 * @param {object} log - Review log object.
 * @throws {Error} Kalau log bukan plain object.
 */
function saveReviewLog(log) {
  if (!log || typeof log !== 'object' || Array.isArray(log)) {
    throw new Error('gh-blin: saveReviewLog membutuhkan plain object log.');
  }
  const file = logFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(log, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Cek apakah sebuah PR (pada commit headSha tertentu) sudah pernah di-review.
 * Kalau headSha disediakan dan tercatat, tapi berbeda dari yang di log →
 * PR sudah berubah (ada commit baru) → anggap belum di-review.
 * @param {string} repo - Format owner/name.
 * @param {number|string} prNumber
 * @param {string} [headSha] - Commit SHA yang mau dicek.
 * @returns {boolean}
 */
function hasBeenReviewed(repo, prNumber, headSha) {
  const log = loadReviewLog();
  const entry = log[repo]?.[String(prNumber)];
  if (!entry) return false;
  if (headSha && entry.headSha && entry.headSha !== headSha) return false;
  return true;
}

/**
 * Catat bahwa sebuah PR sudah di-review. Metadata disimpan per-PR;
 * lastReviewedAt selalu di-set otomatis.
 * @param {string} repo - Format owner/name.
 * @param {number|string} prNumber
 * @param {object} [metadata] - e.g. { headSha, status, model, variant, backend, tokens: {prompt, completion, total} }.
 * @returns {object} Entry yang baru tersimpan.
 * @throws {Error} Kalau repo/prNumber tidak valid.
 */
function recordReview(repo, prNumber, metadata = {}) {
  if (!repo || typeof repo !== 'string') {
    throw new Error('gh-blin: recordReview membutuhkan repo (format owner/name).');
  }
  if (prNumber == null) {
    throw new Error('gh-blin: recordReview membutuhkan prNumber.');
  }

  const log = loadReviewLog();
  const repoLog = { ...(log[repo] || {}) };
  const entry = {
    lastReviewedAt: new Date().toISOString(),
    ...metadata,
  };
  repoLog[String(prNumber)] = entry;
  saveReviewLog({ ...log, [repo]: repoLog });
  return entry;
}

module.exports = { loadReviewLog, saveReviewLog, hasBeenReviewed, recordReview };
