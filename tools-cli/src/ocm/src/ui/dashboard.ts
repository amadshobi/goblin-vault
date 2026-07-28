/**
 * OpenCode Configurator (OCM) — Dashboard UI.
 *
 * Menghasilkan baris-baris informasi yang ditampilkan di bagian atas
 * layar dashboard utama. Informasi meliputi workspace aktif, lokasi
 * file config, default agent & model, session terakhir, dan status
 * API key provider.
 *
 * Dipanggil oleh `menu.ts` setiap kali menu utama di-render.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import color from 'picocolors';
import * as utils from '../utils/utils.js';

/**
 * Menghasilkan array baris informasi untuk dashboard utama.
 *
 * Data yang dikumpulkan:
 * - Workspace aktif dan path config.
 * - Default agent dan model dari file config (dengan override dari agent).
 * - Session terakhir yang aktif (dari database SQLite).
 * - Status API key dari environment dan `.secrets.env`.
 *
 * @returns Array string siap cetak, masing-masing dengan format `label: value`.
 */
export function getDashboardLines(): string[] {
  const activeRoot = utils.getActiveProjectRoot();
  const configPath = utils.paths.config;
  
  let label = activeRoot;
  if (activeRoot === 'global_system') label = ' Global System (~/.config/opencode)';
  else if (activeRoot === 'global_agent' || activeRoot === 'global') label = ' Global Agent (~/.opencode)';
  else label = ` Project: ${path.basename(activeRoot)}`;
  
  const lines: string[] = [];
  lines.push(`Active Workspace: ${color.yellow(label)}`);
  lines.push(`Config File     : ${color.dim(configPath)}`);
  
  let defaultAgent = 'default';
  let defaultModel = 'N/A';
  if (fs.existsSync(configPath)) {
    try {
      const originalContent = fs.readFileSync(configPath, 'utf8');
      const cleanJson = utils.stripComments(originalContent);
      const config = JSON.parse(cleanJson);
      
      defaultAgent = config.default_agent || 'N/A';
      defaultModel = config.model || 'N/A';
      
      // Override model dengan model dari agent default (jika diset per-agent)
      const agentBlock = config.agent || config.agents || {};
      if (defaultAgent !== 'N/A' && agentBlock[defaultAgent]) {
        if (agentBlock[defaultAgent].model) {
          defaultModel = agentBlock[defaultAgent].model;
        }
      }
    } catch (e) {
      // Config mungkin belum ada atau rusak — pakai nilai default
    }
  }
  
  lines.push(`Default Agent   : ${color.green(defaultAgent)}`);
  lines.push(`Active Model    : ${color.cyan(defaultModel)}`);
  
  const dbPath = utils.getWorkspaceDbPath(activeRoot);
  let sessionInfo = color.dim('No sessions found');
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      // Ambil session terbaru dari database SQLite
      const out = execSync(`sqlite3 "${dbPath}" "select session_id, event_count, coalesce(last_event_at, started_at) as last_evt from session_meta order by last_evt desc limit 1" 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (out) {
        const parts = out.split('|');
        const sid = parts[0];
        const count = parts[1];
        const date = parts[2];
        sessionInfo = `${color.bold(sid.slice(0, 16))}... (${count} events, Last: ${date})`;
      }
    } catch (e) {
      // Database SQLite mungkin terkunci atau corrupt
    }
  }
  lines.push(`Last Session    : ${sessionInfo}`);
  
  // Gabungkan env vars dari process.env dengan file .secrets.env
  const envs: Record<string, string> = { ...process.env };
  try {
    const secretPath = path.join(process.env.HOME || '/root', '.secrets.env');
    if (fs.existsSync(secretPath)) {
      const secrets = fs.readFileSync(secretPath, 'utf8').split('\n');
      for (const line of secrets) {
        if (line.trim().startsWith('export ')) {
          const parts = line.replace('export ', '').split('=');
          if (parts.length >= 2) envs[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
      }
    }
  } catch(e) {
    // File .secrets.env mungkin tidak ada atau tidak bisa dibaca
  }

  // Daftar API key provider yang dicek statusnya
  const keys = [
    { env: 'DEEPSEEK_API_KEY', label: 'DeepSeek' },
    { env: 'OPENROUTER_API_KEY', label: 'OpenR' },
    { env: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub' },
    { env: 'GEMINI_API_KEY', label: 'Gemini' },
    { env: 'OPENAI_API_KEY', label: 'OpenAI' },
    { env: 'ANTHROPIC_API_KEY', label: 'Anthropic' }
  ];
  const envStatuses = keys.map(k => {
    const isSet = envs[k.env] || '';
    return isSet ? color.green(`[✓] ${k.label}`) : color.red(`[ ] ${k.label}`);
  }).join(' ');
  
  lines.push(`API Keys status : ${envStatuses}`);
  
  return lines;
}
