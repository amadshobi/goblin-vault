/**
 * OpenCode Configurator (OCM) — Command: Provider & API Key Management.
 *
 * Sub-menu interaktif untuk mengelola API Key dan kredensial AI provider
 * yang disimpan di file `~/.secrets.env`. Mendukung DeepSeek, OpenRouter,
 * GitHub PAT, Gemini, OpenAI, dan Anthropic.
 *
 * User dapat melihat status ketersediaan key, mengubah nilai key yang sudah
 * ada, atau menambah key baru.
 */

import fs from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import color from 'picocolors';

/**
 * Membuka menu interaktif kelola API Key provider.
 *
 * File `.secrets.env` dibaca, di-parse untuk mengekstrak variabel `export`,
 * lalu user bisa memilih provider dan memasukkan nilai key baru.
 * Perubahan langsung ditulis kembali ke file.
 */
export async function run(): Promise<void> {
  const secretPath = path.join(process.env.HOME || '/root', '.secrets.env');
  
  if (!fs.existsSync(secretPath)) {
    p.note(color.yellow(`File rahasia kreden .secrets.env tidak ditemukan di: ${secretPath}`));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  // Daftar API key yang dikenal
  const keys = [
    { env: 'DEEPSEEK_API_KEY', name: 'DeepSeek' },
    { env: 'OPENROUTER_API_KEY', name: 'OpenRouter' },
    { env: 'GITHUB_PERSONAL_ACCESS_TOKEN', name: 'GitHub PAT' },
    { env: 'GEMINI_API_KEY', name: 'Google Gemini' },
    { env: 'OPENAI_API_KEY', name: 'OpenAI' },
    { env: 'ANTHROPIC_API_KEY', name: 'Anthropic' }
  ];

  while (true) {
    let secretsContent = fs.readFileSync(secretPath, 'utf8');
    const envVars: Record<string, string> = {};

    // Parse baris `export KEY=VALUE` dari file .secrets.env
    secretsContent.split('\n').forEach(line => {
      if (line.trim().startsWith('export ')) {
        const parts = line.replace('export ', '').split('=');
        if (parts.length >= 2) {
          // Gabungkan kembali nilai yang mungkin mengandung =
          envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    });

    const options = keys.map(k => {
      const isSet = !!envVars[k.env];
      const status = isSet ? color.green('[TERSEDIA]') : color.red('[KOSONG]');
      return { value: k.env, label: `${k.name} (${k.env}): ${status}` };
    });

    options.push({ value: 'back', label: color.yellow(' Back to Main Menu') });

    const chosenEnv = await p.select({
      message: 'Kelola API Key & Kredensial Provider (~/.secrets.env):',
      options
    }) as string;

    if (p.isCancel(chosenEnv) || chosenEnv === 'back') {
      return;
    }

    const keyObj = keys.find(k => k.env === chosenEnv);
    const currVal = envVars[chosenEnv] || '';

    const newVal = await p.text({
      message: `Masukkan API Key baru untuk ${keyObj ? keyObj.name : chosenEnv}:`,
      initialValue: currVal,
      placeholder: 'Paste token / API Key di sini...'
    }) as string;

    if (p.isCancel(newVal)) continue;

    // Update atau tambah baris export di file
    const exportLine = `export ${chosenEnv}="${newVal.trim()}"`;
    let newSecretsContent = secretsContent;

    const regex = new RegExp(`^export\\s+${chosenEnv}=.*$`, 'm');
    if (regex.test(newSecretsContent)) {
      // Ganti baris yang sudah ada
      newSecretsContent = newSecretsContent.replace(regex, exportLine);
    } else {
      // Tambah baris baru di akhir file
      newSecretsContent += `\n${exportLine}\n`;
    }

    try {
      fs.writeFileSync(secretPath, newSecretsContent, 'utf8');
      p.outro(color.green(` Kredensial ${chosenEnv} berhasil diperbarui di ~/.secrets.env!`));
    } catch (e: any) {
      p.cancel(color.red(`Gagal menyalin kredensial ke file: ${e.message}`));
    }
  }
}
