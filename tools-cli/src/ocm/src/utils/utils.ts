/**
 * OpenCode Configurator (OCM) — Utilitas Umum.
 *
 * Modul ini menyediakan fungsi-fungsi inti untuk:
 * - Manajemen path konfigurasi (global, system, project-level).
 * - Manipulasi langsung file JSONC (strip komentar, update/delete field
 *   di nested block, insert/ensure block).
 * - Parsing dan modifikasi file referensi model (`models-free.md`).
 * - Deteksi proyek OpenCode di sekitar filesystem.
 *
 * Fungsi-fungsi di sini menjadi fondasi yang dipakai oleh seluruh command
 * di `commands/` dan komponen UI di `ui/`.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import color from 'picocolors';
import { ModelReferenceItem } from '../types/models.js';

/**
 * Resolver path ke file-file konfigurasi OpenCode.
 * Nilainya diinisialisasi dengan default global, lalu bisa diubah
 * melalui `setProjectPaths()`.
 */
export interface PathConfig {
  config: string;
  models: string;
  agents: string;
}

/**
 * Path default dan runtime untuk config, referensi model, dan agents.
 * Diubah oleh `setProjectPaths()` saat user mengganti workspace.
 */
export const paths: PathConfig = {
  config: `${process.env.HOME}/.opencode/opencode.jsonc`,
  models: path.join(__dirname, '../../reference/models-free.md'),
  agents: `${process.env.HOME}/.opencode/agents`
};

/**
 * Menyimpan root proyek yang sedang aktif.
 * Default: `'global_agent'` (user-global ~/.opencode).
 */
let activeProjectRoot = 'global_agent';

/**
 * Mengarahkan ulang `paths` sesuai workspace yang dipilih.
 *
 * Mendukung tiga mode:
 * - `global_agent` / `global` → `~/.opencode`
 * - `global_system`          → `~/.config/opencode`
 * - path proyek              → `{proyek}/.opencode` atau `{proyek}/opencode`
 *
 * @param projectPath - Nama atau path absolut workspace target.
 */
export function setProjectPaths(projectPath: string): void {
  activeProjectRoot = projectPath;
  paths.models = path.join(__dirname, '../../reference/models-free.md');
  
  if (projectPath === 'global_agent' || projectPath === 'global') {
    paths.config = `${process.env.HOME}/.opencode/opencode.jsonc`;
    paths.agents = `${process.env.HOME}/.opencode/agents`;
  } else if (projectPath === 'global_system') {
    paths.config = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
    paths.agents = `${process.env.HOME}/.config/opencode/agents`;
  } else {
    // Coba path `.opencode` dulu, fallback ke `opencode` tanpa dot
    let sub = path.join(projectPath, '.opencode');
    if (!fs.existsSync(sub) || !fs.statSync(sub).isDirectory()) {
      sub = path.join(projectPath, 'opencode');
    }
    paths.config = path.join(sub, 'opencode.jsonc');
    paths.agents = path.join(sub, 'agents');
  }
}

/**
 * Mengembalikan root proyek yang sedang aktif.
 */
export function getActiveProjectRoot(): string {
  return activeProjectRoot;
}

/**
 * Mencari path file database SQLite session untuk workspace tertentu.
 *
 * Cara kerja: scan semua file `.db` di `~/.config/opencode/context-mode/sessions`,
 * lalu cocokkan `project_dir` dari masing-masing database dengan `workspacePath`.
 *
 * @param workspacePath - Path workspace yang ingin dicari session DB-nya.
 * @returns Path lengkap ke file `.db`, atau `null` bila tidak ditemukan.
 */
export function getWorkspaceDbPath(workspacePath: string): string | null {
  const sessionsDir = `${process.env.HOME}/.config/opencode/context-mode/sessions`;
  if (!fs.existsSync(sessionsDir)) return null;
  
  // Resolve path target; workspace global diarahkan ke ~/goblin/.opencode
  let targetPath = workspacePath;
  if (targetPath === 'global_agent' || targetPath === 'global_system' || targetPath === 'global') {
    targetPath = `${process.env.HOME}/goblin/.opencode`;
  }
  targetPath = path.resolve(targetPath);
  
  try {
    const files = fs.readdirSync(sessionsDir);
    for (const file of files) {
      if (file.endsWith('.db')) {
        const fullPath = path.join(sessionsDir, file);
        try {
          // Query SQLite untuk mengambil project_dir dari session_meta
          const out = execSync(`sqlite3 "${fullPath}" "select project_dir from session_meta limit 1" 2>/dev/null`, { encoding: 'utf8' }).trim();
          if (path.resolve(out) === targetPath) {
            return fullPath;
          }
        } catch (e) {
          // Abaikan database yang corrupt / tidak punya tabel session_meta
        }
      }
    }
  } catch (e) {
    // Abaikan error readdir
  }
  
  return null;
}

/**
 * Memindai direktori umum (`~/civil`, `$HOME`, `$OPENCODE_CONFIG_DIR`)
 * untuk menemukan proyek OpenCode (direktori yang memiliki `opencode.jsonc`).
 *
 * @returns Array proyek dengan nama (basename) dan path absolut.
 */
export function findOpenCodeProjects(): Array<{ name: string; path: string }> {
  const rootDirs: string[] = [];
  if (process.env.OPENCODE_CONFIG_DIR) {
    rootDirs.push(process.env.OPENCODE_CONFIG_DIR);
  }
  rootDirs.push(`${process.env.HOME}/civil`, process.env.HOME || '/root');
  
  const projects: Array<{ name: string; path: string }> = [];
  const visited = new Set<string>();
  
  for (const root of rootDirs) {
    if (!fs.existsSync(root)) continue;
    try {
      const items = fs.readdirSync(root, { withFileTypes: true });
      for (const item of items) {
        if (!item.isDirectory()) continue;
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        
        const fullPath = path.join(root, item.name);
        if (visited.has(fullPath)) continue;
        visited.add(fullPath);
        
        // Cek keberadaan opencode.jsonc di subdirektori .opencode atau opencode
        const sub1 = path.join(fullPath, '.opencode', 'opencode.jsonc');
        const sub2 = path.join(fullPath, 'opencode', 'opencode.jsonc');
        if (fs.existsSync(sub1) || fs.existsSync(sub2)) {
          projects.push({ name: item.name, path: fullPath });
        }
      }
    } catch (e) {
      // Abaikan error readdir (misal permission denied)
    }
  }
  
  return projects;
}

/**
 * Menghapus komentar `//` dan `/* ... * /` dari string JSONC.
 *
 * Komentar single-line dihapus dengan pola `\/\/.*$`,
 * komentar multi-line dihapus dengan regex yang mencocokkan
 * `/*` dan `* /` (`\/\*[\s\S]*?\*\/`).
 *
 * @param jsoncStr - String JSONC mentah (bisa mengandung komentar).
 * @returns String JSON murni tanpa komentar.
 */
export function stripComments(jsoncStr: string): string {
  // 1. Strip multi-line comments
  let str = jsoncStr.replace(/\/\*[\s\S]*?\*\//g, '');
  // 2. Strip single-line comments safely without removing URLs like http:// or https://
  str = str.replace(/(^|[^:"'])(\/\/.*$)/gm, '$1');
  // 3. Strip trailing commas in objects and arrays to prevent JSON parse error
  str = str.replace(/,\s*([\}\]])/g, '$1');
  return str;
}

/**
 * Mencari rentang karakter blok kurung kurawal bersarang berdasarkan path.
 *
 * Contoh: `findNestedBlockRange(text, ['agents', 'coder'])` akan mencari
 * blok `"agents": { ... "coder": { ... } ... }` dan mengembalikan
 * posisi `{` dan `}` dari blok terdalam (`coder`).
 *
 * @param text    - String JSONC asli.
 * @param pathArr - Array key untuk menelusuri nested block.
 * @returns `{ start, end }` indeks blok terdalam, atau `null` bila tidak ditemukan.
 */
export function findNestedBlockRange(text: string, pathArr: string[]): { start: number; end: number } | null {
  let searchIndex = 0;
  for (let i = 0; i < pathArr.length; i++) {
    const key = pathArr[i];
    // Cari pola `"key": {` — cocok dengan quote tunggal atau ganda
    const regex = new RegExp(`(["'])${key}\\1\\s*:\\s*\\{`);
    const match = text.slice(searchIndex).match(regex);
    if (!match || match.index === undefined) return null;
    
    // Hitung brace balance untuk menemukan tutup `}` yang tepat
    const braceStart = searchIndex + match.index + match[0].length - 1;
    let braceCount = 1;
    let braceEnd = braceStart + 1;
    while (braceEnd < text.length && braceCount > 0) {
      if (text[braceEnd] === '{') braceCount++;
      else if (text[braceEnd] === '}') braceCount--;
      braceEnd++;
    }
    if (braceCount !== 0) return null; // Brace tidak balance — format rusak
    
    if (i === pathArr.length - 1) {
      return { start: braceStart, end: braceEnd };
    }
    searchIndex = braceStart + 1;
  }
  return null;
}

/**
 * Memperbarui (update) nilai suatu field di dalam nested block JSONC.
 *
 * Jika field sudah ada, nilainya diganti. Jika belum ada, field baru
 * ditambahkan ke dalam block.
 *
 * @param text     - String JSONC asli.
 * @param pathArr  - Path ke nested block induk (misal `['agent', 'coder']`).
 * @param key      - Nama field yang akan diupdate.
 * @param newValue - Nilai baru dalam bentuk string JSON (misal `"\"gpt-4\""`, `"50"`).
 * @returns String JSONC yang sudah dimodifikasi.
 */
export function updateNestedField(text: string, pathArr: string[], key: string, newValue: string): string {
  const range = findNestedBlockRange(text, pathArr);
  if (!range) return text;
  const blockText = text.slice(range.start, range.end);
  // Cocokkan field dengan nilai: string, number, boolean, atau array
  const fieldRegex = new RegExp(`(["'])${key}\\1\\s*:\\s*(\\d+|true|false|["'].*?["']|\\[[\\s\\S]*?\\])`);
  if (fieldRegex.test(blockText)) {
    const updatedBlock = blockText.replace(fieldRegex, `$1${key}$1: ${newValue}`);
    return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
  } else {
    // Field belum ada — tambahkan sebagai baris baru di awal block
    const updatedBlock = blockText.slice(0, 1) + `\n  "${key}": ${newValue},` + blockText.slice(1);
    return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
  }
}

/**
 * Menghapus suatu field dari nested block JSONC.
 *
 * @param text    - String JSONC asli.
 * @param pathArr - Path ke nested block induk.
 * @param key     - Nama field yang akan dihapus.
 * @returns String JSONC tanpa field tersebut (jika ditemukan).
 */
export function deleteNestedField(text: string, pathArr: string[], key: string): string {
  const range = findNestedBlockRange(text, pathArr);
  if (!range) return text;
  const blockText = text.slice(range.start, range.end);
  // Hapus baris field beserta koma sebelumnya
  const fieldRegex = new RegExp(`[\\r\\n]?\\s*(["'])${key}\\1\\s*:\\s*(\\d+|true|false|["'].*?["']|\\[[\\s\\S]*?\\])\\s*,?`);
  if (fieldRegex.test(blockText)) {
    const updatedBlock = blockText.replace(fieldRegex, '');
    return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
  }
  return text;
}

/**
 * Memastikan bahwa nested block untuk suatu path benar-benar ada di JSONC.
 * Jika blok di level tertentu belum ada, ia akan dibuat dengan `{}`.
 *
 * @param text    - String JSONC asli.
 * @param pathArr - Path bertingkat yang perlu dipastikan keberadaannya.
 * @returns String JSONC dengan semua block yang diperlukan sudah tersedia.
 */
export function ensureNestedBlock(text: string, pathArr: string[]): string {
  let currentText = text;
  for (let i = 0; i < pathArr.length; i++) {
    const subPath = pathArr.slice(0, i + 1);
    const range = findNestedBlockRange(currentText, subPath);
    if (!range) {
      const parentPath = pathArr.slice(0, i);
      const keyToAdd = pathArr[i];
      if (parentPath.length === 0) {
        // Sisipkan block di level root (sebelum `}` terakhir)
        const insertPos = currentText.lastIndexOf('}');
        if (insertPos !== -1) {
          currentText = currentText.slice(0, insertPos) + `,\n  "${keyToAdd}": {}\n` + currentText.slice(insertPos);
        }
      } else {
        // Sisipkan block di dalam parent yang sudah ada
        const parentRange = findNestedBlockRange(currentText, parentPath);
        if (parentRange) {
          const blockText = currentText.slice(parentRange.start, parentRange.end);
          const updatedBlock = blockText.slice(0, 1) + `\n  "${keyToAdd}": {},` + blockText.slice(1);
          currentText = currentText.slice(0, parentRange.start) + updatedBlock + currentText.slice(parentRange.end);
        }
      }
    }
  }
  return currentText;
}

/**
 * Memperbarui satu field dalam blok agent (baik `agent` maupun `agents`).
 *
 * Fungsi ini otomatis mendeteksi apakah file config menggunakan key `agent`
 * atau `agents`, lalu:
 * 1. Memastikan nested block agentName tersedia.
 * 2. Mengupdate field yang diminta dengan nilai baru.
 *
 * @param originalText - String JSONC asli.
 * @param agentName    - Nama agent yang akan diupdate.
 * @param field        - Nama field (misal `model`, `steps`, `prompt`).
 * @param val          - Nilai baru untuk field tersebut.
 * @param isNumber     - Jika `true`, nilai diperlakukan sebagai number (tanpa quote).
 * @returns String JSONC yang sudah dimodifikasi.
 */
export function updateAgentField(originalText: string, agentName: string, field: string, val: string | number, isNumber = false): string {
  let blockName = 'agents';
  if (!findNestedBlockRange(originalText, ['agents', agentName])) {
    if (findNestedBlockRange(originalText, ['agent', agentName])) {
      blockName = 'agent';
    } else {
      // Cek block mana yang ada, default ke 'agent' bila keduanya tidak ditemukan
      if (findNestedBlockRange(originalText, ['agents'])) {
        blockName = 'agents';
      } else if (findNestedBlockRange(originalText, ['agent'])) {
        blockName = 'agent';
      } else {
        blockName = 'agent';
      }
      // Buat block agent jika belum ada
      originalText = ensureNestedBlock(originalText, [blockName, agentName]);
    }
  }
  
  const valStr = isNumber ? String(val) : JSON.stringify(val);
  return updateNestedField(originalText, [blockName, agentName], field, valStr);
}

/**
 * Membaca dan mem-parsing file referensi model (`models-free.md`).
 *
 * Format baris yang dikenali:
 * - `# Judul Utama`      → heading (tanpa provider/status).
 * - `## Nama Provider`   → heading + provider.
 * - `### Status`         → heading + status.
 * - `- [x] \`id\` # alias` → model entry.
 *
 * @returns Array item {@link ModelReferenceItem} hasil parsing.
 */
export function parseModelsFile(): ModelReferenceItem[] {
  if (!fs.existsSync(paths.models)) return [];
  const content = fs.readFileSync(paths.models, 'utf8');
  const lines = content.split('\n');
  const result: ModelReferenceItem[] = [];
  
  // State tracking untuk provider dan status section terakhir
  let currentProvider = '';
  let currentStatus = '';
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      result.push({ type: 'heading', text: line });
    } else if (trimmed.startsWith('## ')) {
      currentProvider = trimmed.replace('## ', '').trim();
      result.push({ type: 'heading', text: line, provider: currentProvider });
    } else if (trimmed.startsWith('### ')) {
      currentStatus = trimmed.replace('### ', '').trim();
      result.push({ type: 'heading', text: line, status: currentStatus });
    } else if (trimmed.startsWith('- [')) {
      // Parse checklist markdown: - [x] `modelId` # alias
      const match = trimmed.match(/- \[([ xX])\] `([^`]+)`(?: # (.*))?/);
      if (match) {
        result.push({
          type: 'model',
          text: line,
          provider: currentProvider,
          status: currentStatus,
          modelId: match[2],
          alias: match[3] ? match[3].trim() : ''
        });
      } else {
        result.push({ type: 'text', text: line });
      }
    } else {
      result.push({ type: 'text', text: line });
    }
  }
  return result;
}

/**
 ** Menulis kembali array {@link ModelReferenceItem} ke file referensi model.
 *
 * @param parsedLines - Array item hasil parsing (bisa sudah dimodifikasi).
 */
export function saveModelsFile(parsedLines: ModelReferenceItem[]): void {
  const content = parsedLines.map(l => l.text).join('\n');
  fs.writeFileSync(paths.models, content, 'utf8');
}

/**
 * Menyisipkan model baru ke dalam array hasil parsing, terurut berdasarkan
 * provider dan status. Jika provider/status section belum ada, akan dibuat.
 *
 * Strategi penyisipan:
 * 1. Cari index heading provider.
 * 2. Di dalam provider, cari heading status.
 * 3. Sisipkan model setelah model terakhir di status tersebut.
 *
 * @param parsedLines - Array item hasil parsing (di-mutasi langsung).
 * @param provider    - Nama provider untuk model baru.
 * @param status      - Status model (`Stabil`, `Error`, dsb).
 * @param modelId     - ID model lengkap (misal `google/gemini-2.0-flash`).
 * @param alias       - Nama tampilan alias (opsional).
 */
export function insertModel(parsedLines: ModelReferenceItem[], provider: string, status: string, modelId: string, alias: string): void {
  const newLineText = `- [x] \`${modelId}\`${alias ? ` # ${alias}` : ''}`;
  const newItem: ModelReferenceItem = {
    type: 'model',
    text: newLineText,
    provider,
    status,
    modelId,
    alias
  };
  
  let providerIdx = parsedLines.findIndex(l => l.type === 'heading' && l.provider === provider);
  if (providerIdx === -1) {
    // Provider belum ada — buat section baru di akhir
    parsedLines.push({ type: 'text', text: '' });
    parsedLines.push({ type: 'heading', text: `## ${provider}`, provider });
    parsedLines.push({ type: 'heading', text: `### ${status}`, status });
    parsedLines.push(newItem);
    return;
  }
  
  // Cari heading status di dalam blok provider
  let statusIdx = -1;
  for (let i = providerIdx + 1; i < parsedLines.length; i++) {
    const l = parsedLines[i];
    if (l.type === 'heading' && l.provider && l.provider !== provider) break;
    if (l.type === 'heading' && l.status === status) {
      statusIdx = i;
      break;
    }
  }
  
  if (statusIdx !== -1) {
    // Status ditemukan — sisipkan setelah model terakhir di status tsb
    let insertAt = statusIdx + 1;
    while (insertAt < parsedLines.length && parsedLines[insertAt].type === 'model') {
      insertAt++;
    }
    parsedLines.splice(insertAt, 0, newItem);
  } else {
    // Status belum ada — buat heading status baru setelah provider
    let insertAt = providerIdx + 1;
    while (insertAt < parsedLines.length && !(parsedLines[insertAt].type === 'heading' && parsedLines[insertAt].provider && parsedLines[insertAt].provider !== provider)) {
      insertAt++;
    }
    parsedLines.splice(insertAt, 0, { type: 'heading', text: `### ${status}`, status });
    parsedLines.splice(insertAt + 1, 0, newItem);
  }
}
