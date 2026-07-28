/**
 * OpenCode Configurator (OCM) — Command: System Settings.
 *
 * Sub-menu interaktif untuk mengubah toggle/pengaturan sistem di
 * file config OpenCode. Mendukung berbagai tipe pengaturan:
 * - Boolean (enable/disable MCP server, compaction).
 * - Number (fraksi keep/buffer compaction).
 * - Enum (mode autoupdate, mode share session).
 *
 * Perubahan dilakukan langsung pada file JSONC melalui utility
 * `utils.updateNestedField`, `utils.deleteNestedField`, dan
 * `utils.ensureNestedBlock`.
 */

import fs from 'fs';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Definisi satu item toggle/setting yang bisa diubah.
 */
interface ToggleItem {
  /** Key unik untuk identifikasi di menu */
  key: string;
  /** Path ke nested block di JSONC (misal `['mcp', 'github']`) */
  pathArr: string[];
  /** Nama field di dalam block */
  fieldName: string;
  /** Label yang ditampilkan di menu */
  label: string;
  /** Tipe data — menentukan cara input dan format nilai */
  type: 'boolean' | 'string' | 'number' | 'enum';
  /** Opsi untuk tipe `enum` */
  options?: string[];
}

/**
 * Membuka menu interaktif pengaturan sistem.
 */
export async function run(): Promise<void> {
  const configPath = utils.paths.config;
  if (!fs.existsSync(configPath)) {
    p.note(color.yellow(`File config tidak ditemukan di: ${configPath}`));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  // Daftar semua setting yang bisa diubah
  const toggles: ToggleItem[] = [
    { key: 'mcp_github', pathArr: ['mcp', 'github'], fieldName: 'enabled', label: 'MCP: GitHub Server', type: 'boolean' },
    { key: 'mcp_context7', pathArr: ['mcp', 'context7'], fieldName: 'enabled', label: 'MCP: Context7 Server', type: 'boolean' },
    { key: 'mcp_sequential', pathArr: ['mcp', 'server-sequential'], fieldName: 'enabled', label: 'MCP: Sequential Thinking', type: 'boolean' },
    { key: 'compaction_auto', pathArr: ['compaction'], fieldName: 'auto', label: 'Compaction: Auto Trigger', type: 'boolean' },
    { key: 'compaction_prune', pathArr: ['compaction'], fieldName: 'prune', label: 'Compaction: Prune Extra', type: 'boolean' },
    { key: 'compaction_keep', pathArr: ['compaction'], fieldName: 'keep', label: 'Compaction: Keep Fraction (0.0 - 1.0)', type: 'number' },
    { key: 'compaction_buffer', pathArr: ['compaction'], fieldName: 'buffer', label: 'Compaction: Buffer Fraction (0.0 - 1.0)', type: 'number' },
    { key: 'autoupdate', pathArr: [], fieldName: 'autoupdate', label: 'System Auto-Update Mode', type: 'enum', options: ['default', 'true', 'false', 'notify'] },
    { key: 'share_mode', pathArr: [], fieldName: 'share', label: 'Session Share Mode', type: 'enum', options: ['default', 'manual', 'auto', 'disabled'] }
  ];

  while (true) {
    let content = fs.readFileSync(configPath, 'utf8');
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(utils.stripComments(content));
    } catch (e: any) {
      p.cancel(color.red(`Gagal membaca config JSONC: ${e.message}`));
      return;
    }

    // Baca nilai saat ini dari setiap toggle
    const currentValues: Record<string, any> = {};
    toggles.forEach(t => {
      let curr = config;
      for (const pSegment of t.pathArr) {
        curr = curr ? curr[pSegment] : undefined;
      }
      currentValues[t.key] = curr ? curr[t.fieldName] : undefined;
    });

    const menuOptions = toggles.map(t => {
      const val = currentValues[t.key];
      let valStr = color.dim('Not Set');
      if (val !== undefined) {
        if (t.type === 'boolean') {
          valStr = val === true ? color.green('Enabled') : color.red('Disabled');
        } else {
          valStr = color.cyan(String(val));
        }
      }
      return { value: t.key, label: `${t.label}: ${valStr}` };
    });

    menuOptions.push({ value: 'back', label: color.yellow(' Back to Main Menu') });

    const selectedKey = await p.select({
      message: 'Pilih setting yang ingin diubah:',
      options: menuOptions
    }) as string;

    if (p.isCancel(selectedKey) || selectedKey === 'back') {
      return;
    }

    const item = toggles.find(t => t.key === selectedKey);
    if (!item) continue;

    let newValue: any = null;
    let shouldDelete = false;

    if (item.type === 'boolean') {
      const currentBool = currentValues[item.key] === true;
      const ans = await p.select({
        message: `Ubah ${item.label}:`,
        options: [
          { value: 'toggle', label: `Toggle menjadi -> ${!currentBool ? 'Enabled' : 'Disabled'}` },
          { value: 'unset', label: 'Unset / Hapus dari config' },
          { value: 'cancel', label: 'Batal' }
        ]
      }) as string;

      if (p.isCancel(ans) || ans === 'cancel') continue;
      if (ans === 'unset') {
        shouldDelete = true;
      } else {
        newValue = !currentBool;
      }
    } else if (item.type === 'number') {
      const ans = await p.text({
        message: `Masukkan nilai angka desimal baru untuk ${item.label} (misal: 0.5):`,
        initialValue: String(currentValues[item.key] ?? '0.5'),
        validate(val) {
          const num = Number(val);
          if (isNaN(num)) return 'Harus berupa angka desimal!';
        }
      }) as string;

      if (p.isCancel(ans)) continue;
      newValue = Number(ans);
    } else if (item.type === 'enum' && item.options) {
      const ans = await p.select({
        message: `Pilih opsi untuk ${item.label}:`,
        options: item.options.map(o => ({ value: o, label: o }))
      }) as string;

      if (p.isCancel(ans)) continue;
      newValue = ans;
    }

    let updatedContent = content;
    if (item.pathArr.length > 0) {
      updatedContent = utils.ensureNestedBlock(updatedContent, item.pathArr);
    }

    if (shouldDelete) {
      updatedContent = utils.deleteNestedField(updatedContent, item.pathArr, item.fieldName);
    } else {
      const formattedValue = item.type === 'string' || item.type === 'enum' ? JSON.stringify(newValue) : String(newValue);
      updatedContent = utils.updateNestedField(updatedContent, item.pathArr, item.fieldName, formattedValue);
    }

    try {
      fs.writeFileSync(configPath, updatedContent, 'utf8');
      p.outro(color.green(` Setting ${item.label} telah diperbarui!`));
    } catch (e: any) {
      p.cancel(color.red(`Gagal menyimpan config: ${e.message}`));
    }
  }
}
