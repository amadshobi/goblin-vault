/**
 * OpenCode Configurator (OCM) — Command: Model Browser.
 *
 * Menampilkan daftar model AI yang terdaftar di file referensi
 * `models-free.md` dalam format yang mudah dibaca. Setiap model
 * ditampilkan dengan alias/nama, badge status, provider, dan model ID.
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Membaca dan menampilkan daftar model dari file referensi.
 *
 * Output dikelompokkan per model dengan informasi:
 * - Nama/Alias (bold) + badge status (STABIL / status lain).
 * - Provider.
 * - Model ID (dim/digelapkan).
 */
export async function run(): Promise<void> {
  const parsedLines = utils.parseModelsFile();
  const models = parsedLines.filter(l => l.type === 'model' && l.modelId);

  if (models.length === 0) {
    p.note(color.yellow('Belum ada referensi model yang terdaftar di models-free.md'));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  const formattedDetails = models.map(m => {
    const statusBadge = m.status === 'Stabil' ? color.green('[STABIL]') : color.yellow(`[${m.status || 'UNKNOWN'}]`);
    return `${color.bold(m.alias || m.modelId)} ${statusBadge}\n Provider : ${m.provider || 'N/A'}\n Model ID : ${color.dim(m.modelId!)}`;
  }).join('\n\n');

  p.note(formattedDetails, `Browser Referensi Model (${models.length} Model)`);
  await p.select({ message: 'Kembali ke menu utama?', options: [{ value: 'back', label: 'Kembali' }] });
}
