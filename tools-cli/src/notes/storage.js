const fs = require('fs');
const path = require('path');

// Resolve notes directory relative to the project root
// ~/civil/goblin-vault-scripts/notes/
const NOTES_DIR = path.resolve(__dirname, '../../../../notes');

function ensureNotesDir() {
  if (!fs.existsSync(NOTES_DIR)) {
    fs.mkdirSync(NOTES_DIR, { recursive: true });
  }
}

function getDatePrefix() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

function getAllNotes() {
  ensureNotesDir();
  const files = fs.readdirSync(NOTES_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();  // newest first
  return files;
}

function getNotePath(filename) {
  return path.join(NOTES_DIR, filename);
}

function readNote(filename) {
  const filepath = getNotePath(filename);
  return fs.readFileSync(filepath, 'utf8');
}

function saveNote(filename, content) {
  ensureNotesDir();
  const filepath = getNotePath(filename);
  // Prevent path traversal
  if (path.relative(NOTES_DIR, filepath).startsWith('..')) {
    throw new Error('Invalid filename');
  }
  fs.writeFileSync(filepath, content, 'utf8');
  return filepath;
}

function deleteNote(filename) {
  const filepath = getNotePath(filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

function getNoteTitle(filename) {
  // Parse judul dari filename: DD-MM-YY_judul.md -> judul
  const withoutExt = filename.replace(/\.md$/, '');
  const parts = withoutExt.split('_');
  // Hapus prefix tanggal (DD-MM-YY)
  parts.shift();
  return parts.join('_') || withoutExt;
}

module.exports = {
  NOTES_DIR,
  ensureNotesDir,
  getDatePrefix,
  getAllNotes,
  getNotePath,
  readNote,
  saveNote,
  deleteNote,
  getNoteTitle,
};
