/**
 * OpenCode Configurator (OCM) — Command: Session Management.
 *
 * Sub-menu interaktif untuk mengelola database session OpenCode (SQLite).
 * User dapat:
 * - Melihat daftar 15 session terakhir.
 * - Export session tertentu ke file Markdown.
 * - Menghapus session secara permanen (dengan konfirmasi).
 *
 * Database session di-cari menggunakan `utils.getWorkspaceDbPath()`.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Membuka menu interaktif manajemen session database.
 */
export async function run(): Promise<void> {
  const activeRoot = utils.getActiveProjectRoot();
  const dbPath = utils.getWorkspaceDbPath(activeRoot);

  if (!dbPath || !fs.existsSync(dbPath)) {
    p.note(color.yellow(`Database session tidak ditemukan untuk workspace: ${activeRoot}`));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  while (true) {
    const action = await p.select({
      message: 'Kelola Database Session OpenCode (SQLite):',
      options: [
        { value: 'list', label: ' Tampilkan Riwayat Session' },
        { value: 'export', label: ' Export Session ke Markdown' },
        { value: 'delete', label: ' Hapus Session Spesifik' },
        { value: 'back', label: ' Back' }
      ]
    }) as string;

    if (p.isCancel(action) || action === 'back') {
      return;
    }

    if (action === 'list') {
      try {
        // Query 15 session terakhir, urut berdasarkan aktivitas terbaru
        const out = execSync(`sqlite3 "${dbPath}" "select session_id, event_count, coalesce(last_event_at, started_at) as last_evt from session_meta order by last_evt desc limit 15" 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (!out) {
          p.note('Belum ada session terdaftar.');
        } else {
          const lines = out.split('\n').map(row => {
            const parts = row.split('|');
            return `- ${color.bold(parts[0])} (${parts[1]} events, Last: ${parts[2]})`;
          }).join('\n');
          p.note(lines, 'Daftar 15 Session Terakhir');
        }
      } catch (e: any) {
        p.cancel(color.red(`Gagal membaca database SQLite: ${e.message}`));
      }
      await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    }

    else if (action === 'export') {
      const sid = await p.text({
        message: 'Masukkan ID Session yang ingin di-export:',
        validate(v) { if (!v.trim()) return 'Session ID tidak boleh kosong!'; }
      }) as string;

      if (p.isCancel(sid)) continue;

      try {
        // Query semua events untuk session ID tersebut, urut berdasarkan event_id
        const events = execSync(`sqlite3 "${dbPath}" "select payload from events where session_id = '${sid.trim()}' order by event_id asc" 2>/dev/null`, { encoding: 'utf8' }).trim();
        if (!events) {
          p.note(color.yellow(`Session ID "${sid.trim()}" tidak ditemukan atau tidak memiliki events.`));
        } else {
          const exportPath = path.join(process.cwd(), `session-export-${sid.trim().slice(0, 8)}.md`);
          fs.writeFileSync(exportPath, events, 'utf8');
          p.outro(color.green(` Session berhasil di-export ke: ${exportPath}`));
        }
      } catch (e: any) {
        p.cancel(color.red(`Gagal meng-export session: ${e.message}`));
      }
    }

    else if (action === 'delete') {
      const sid = await p.text({
        message: 'Masukkan ID Session yang ingin dihapus:',
        validate(v) { if (!v.trim()) return 'Session ID tidak boleh kosong!'; }
      }) as string;

      if (p.isCancel(sid)) continue;

      // Konfirmasi ganda sebelum menghapus permanen
      const confirm = await p.confirm({
        message: `Yakin ingin menghapus session "${sid.trim()}" secara permanen?`
      });

      if (!confirm || p.isCancel(confirm)) continue;

      try {
        // Hapus events dan meta session dalam satu perintah SQLite
        execSync(`sqlite3 "${dbPath}" "delete from events where session_id = '${sid.trim()}'; delete from session_meta where session_id = '${sid.trim()}';"`, { encoding: 'utf8' });
        p.outro(color.green(` Session "${sid.trim()}" berhasil dihapus dari database!`));
      } catch (e: any) {
        p.cancel(color.red(`Gagal menghapus session: ${e.message}`));
      }
    }
  }
}
