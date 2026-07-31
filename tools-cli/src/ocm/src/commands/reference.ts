/**
 * OpenCode Configurator (OCM) — Command: Reference Models Manager.
 *
 * Sub-menu interaktif untuk mengelola file referensi model AI
 * (`reference/models-free.md`). User dapat:
 * - Melihat daftar model yang terdaftar.
 * - Menambah model baru (dengan provider, status, model ID, alias).
 * - Menghapus model yang sudah tidak relevan.
 *
 * Berinteraksi langsung dengan `utils.parseModelsFile`, `utils.insertModel`,
 * dan `utils.saveModelsFile`.
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Membuka menu interaktif manajemen referensi model.
 */
export async function run(): Promise<void> {
  while (true) {
    const parsedLines = utils.parseModelsFile();
    const action = await p.select({
      message: 'Kelola Model Referensi (models-free.md):',
      options: [
        { value: 'list', label: ' Tampilkan Daftar Model Referensi' },
        { value: 'add', label: ' Tambah Model Referensi Baru' },
        { value: 'delete', label: ' Hapus Model Referensi' },
        { value: 'back', label: ' Back' }
      ]
    }) as string;

    if (p.isCancel(action) || action === 'back') {
      return;
    }

    if (action === 'list') {
      const models = parsedLines.filter(l => l.type === 'model' && l.modelId);
      if (models.length === 0) {
        p.note('Belum ada model referensi yang tersimpan.');
      } else {
        const text = models.map(m => `- [${m.provider || 'Other'}] ${color.bold(m.alias || m.modelId)} (${m.modelId})`).join('\n');
        p.note(text, 'Daftar Model Referensi');
      }
      await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    }

    else if (action === 'add') {
      const provider = await p.text({
        message: 'Masukkan nama Provider (misal: OpenRouter, DeepSeek, Gemini):',
        validate(v) { if (!v.trim()) return 'Provider tidak boleh kosong!'; }
      }) as string;
      if (p.isCancel(provider)) continue;

      const status = await p.select({
        message: 'Pilih status stabilitas model:',
        options: [
          { value: 'Stabil', label: 'Stabil (Recommended)' },
          { value: 'Error', label: 'Error / Issue' }
        ]
      }) as string;
      if (p.isCancel(status)) continue;

      const modelId = await p.text({
        message: 'Masukkan Model ID lengkap (misal: google/gemini-2.0-flash-exp:free):',
        validate(v) { if (!v.trim()) return 'Model ID tidak boleh kosong!'; }
      }) as string;
      if (p.isCancel(modelId)) continue;

      const alias = await p.text({
        message: 'Masukkan Nama Display / Alias model (opsional):',
        placeholder: 'e.g. Gemini 2.0 Flash (Free)'
      }) as string;
      if (p.isCancel(alias)) continue;

      try {
        utils.insertModel(parsedLines, provider.trim(), status, modelId.trim(), alias.trim());
        utils.saveModelsFile(parsedLines);
        p.outro(color.green(` Sukses menambahkan model "${modelId}" ke referensi!`));
      } catch (e: any) {
        p.cancel(color.red(`Gagal menyimpan file referensi: ${e.message}`));
      }
    }

    else if (action === 'delete') {
      const models = parsedLines.filter(l => l.type === 'model' && l.modelId);
      if (models.length === 0) {
        p.note('Belum ada model untuk dihapus.');
        await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
        continue;
      }

      const chosenModelId = await p.select({
        message: 'Pilih model yang ingin dihapus dari referensi:',
        options: models.map(m => ({ value: m.modelId!, label: `${m.alias || m.modelId} (${m.provider})` }))
      }) as string;

      if (p.isCancel(chosenModelId)) continue;

      const idx = parsedLines.findIndex(l => l.type === 'model' && l.modelId === chosenModelId);
      if (idx !== -1) {
        parsedLines.splice(idx, 1);
        try {
          utils.saveModelsFile(parsedLines);
          p.outro(color.green(` Model "${chosenModelId}" berhasil dihapus dari referensi!`));
        } catch (e: any) {
          p.cancel(color.red(`Gagal menyimpan perbaikan: ${e.message}`));
        }
      }
    }
  }
}
