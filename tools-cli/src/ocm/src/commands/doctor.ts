/**
 * OpenCode Configurator (OCM) — Command: Doctor / Diagnostic.
 *
 * Menganalisis file konfigurasi `opencode.jsonc` untuk mendeteksi
 * isu-isu umum seperti:
 * - `default_agent` yang merujuk ke agent tidak terdaftar.
 * - Model agent yang tidak diverifikasi di provider/referensi lokal.
 * - Syntax error pada file JSONC.
 *
 * Mode `--fix` dapat memperbaiki isu tertentu secara otomatis.
 */

import fs from 'fs';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Opsi untuk command doctor.
 */
interface DoctorOptions {
  /** Jika true, jalankan auto-fix untuk isu yang bisa diperbaiki */
  fix?: boolean;
}

/**
 * Menjalankan diagnosa terhadap file config OpenCode.
 *
 * @param options - Opsi eksekusi (termasuk mode fix).
 */
export async function run(options: DoctorOptions = {}): Promise<void> {
  const configPath = utils.paths.config;
  console.log(`\n ${color.bold('Memulai Diagnosis OpenCode Config...')}`);
  console.log(`Target: ${color.dim(configPath)}\n`);

  if (!fs.existsSync(configPath)) {
    console.log(color.red('[ERROR] Gagal membaca file config!'));
    console.log(` Detail : ENOENT: no such file or directory, open '${configPath}'\n`);
    return;
  }

  let originalContent = '';
  try {
    originalContent = fs.readFileSync(configPath, 'utf8');
  } catch (e: any) {
    console.log(color.red(`[ERROR] Gagal membaca file config: ${e.message}`));
    return;
  }

  let config: Record<string, any> = {};
  try {
    config = JSON.parse(utils.stripComments(originalContent));
  } catch (e: any) {
    console.log(color.red('[ERROR] File config opencode.jsonc rusak (Syntax Error)!'));
    console.log(` Detail : ${e.message}`);
    console.log(` Fix    : Buka file config lalu perbaiki kurung/koma yang salah.\n`);
    return;
  }

  // Kumpulkan isu-isu yang ditemukan
  const issues: Array<{ severity: 'WARN' | 'ERR'; code: string; message: string; fixable: boolean }> = [];

  const defaultAgent = config.default_agent;
  const agentBlock = config.agent || config.agents || {};
  const agentNames = Object.keys(agentBlock);

  // Cek apakah default_agent merujuk ke agent yang valid
  if (defaultAgent && !agentBlock[defaultAgent]) {
    issues.push({
      severity: 'WARN',
      code: 'INVALID_DEFAULT_AGENT',
      message: `default_agent "${defaultAgent}" merujuk ke agent yang tidak terdaftar di config.`,
      fixable: true
    });
  }

  // Kumpulkan semua model ID yang valid dari provider dan referensi
  const registeredProviders = config.provider || {};
  const validProviderModels = new Set<string>();
  Object.keys(registeredProviders).forEach(pKey => {
    const pObj = registeredProviders[pKey];
    if (pObj && pObj.models) {
      Object.keys(pObj.models).forEach(mKey => validProviderModels.add(mKey));
      Object.values(pObj.models).forEach((mVal: any) => {
        if (typeof mVal === 'string') validProviderModels.add(mVal);
        else if (mVal && mVal.id) validProviderModels.add(mVal.id);
      });
    }
  });

  const parsedModels = utils.parseModelsFile();
  parsedModels.filter(m => m.type === 'model' && m.modelId).forEach(m => validProviderModels.add(m.modelId!));

  // Cek model setiap agent terhadap daftar model yang valid
  agentNames.forEach(aName => {
    const aObj = agentBlock[aName];
    if (aObj && aObj.model) {
      if (validProviderModels.size > 0 && !validProviderModels.has(aObj.model)) {
        issues.push({
          severity: 'WARN',
          code: 'UNVERIFIED_MODEL',
          message: `Agent "${aName}" menggunakan model "${aObj.model}" yang tidak terdaftar di provider models lokal/referensi.`,
          fixable: false
        });
      }
    }
  });

  if (issues.length === 0) {
    console.log(color.green(' Hasil Diagnosis: Config sehat wal afiat boss \n'));
    if (!options.fix) {
      await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
    }
    return;
  }

  console.log(color.yellow(` Ditemukan ${issues.length} catatan pada config:`));
  issues.forEach((iss, i) => {
    const badge = iss.severity === 'ERR' ? color.red('[ERROR]') : color.yellow('[WARN]');
    console.log(` ${i + 1}. ${badge} ${iss.message}`);
  });
  console.log('');

  if (options.fix) {
    let fixedContent = originalContent;
    let fixCount = 0;

    for (const iss of issues) {
      if (iss.code === 'INVALID_DEFAULT_AGENT' && agentNames.length > 0) {
        // Perbaiki: arahkan default_agent ke agent pertama yang tersedia
        fixedContent = utils.updateNestedField(fixedContent, [], 'default_agent', JSON.stringify(agentNames[0]));
        fixCount++;
      }
    }

    if (fixCount > 0) {
      try {
        fs.writeFileSync(configPath, fixedContent, 'utf8');
        console.log(color.green(` Auto-Fix Sukses: ${fixCount} isu telah diperbaiki otomatis!\n`));
      } catch (e: any) {
        console.log(color.red(` Gagal menyimpan perbaikan config: ${e.message}\n`));
      }
    } else {
      console.log(color.dim(' Tidak ada isu yang bisa diperbaiki secara otomatis.\n'));
    }
  } else {
    await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
  }
}
