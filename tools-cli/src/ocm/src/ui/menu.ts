/**
 * OpenCode Configurator (OCM) — Menu Interaktif Utama.
 *
 * Menyediakan loop interaktif TUI (Text User Interface) berbasis
 * `@clack/prompts` untuk menavigasi seluruh fitur OCM. User dapat
 * memilih aksi dari daftar autocomplete, yang akan memanggil command
 * yang sesuai di `commands/`.
 *
 * Loop ini juga mendukung:
 * - `startAction` untuk langsung masuk ke sub-menu tertentu dari CLI.
 * - Fitur "Switch Workspace" untuk berganti proyek OpenCode.
 * - Dashboard otomatis yang menampilkan status workspace di setiap iterasi.
 */

import * as p from '@clack/prompts';
import color from 'picocolors';
import path from 'path';
import fs from 'fs';

import * as utils from '../utils/utils.js';
import { getDashboardLines } from './dashboard.js';

import * as agentCmd from '../commands/agent.js';
import * as refCmd from '../commands/reference.js';
import * as settingsCmd from '../commands/settings.js';
import * as doctorCmd from '../commands/doctor.js';
import * as sessionCmd from '../commands/session.js';
import * as runCmd from '../commands/run.js';
import * as providersCmd from '../commands/providers.js';
import * as modelsCmd from '../commands/models.js';
import * as mcpCmd from '../commands/mcp.js';

/**
 * Memulai loop interaktif TUI utama.
 *
 * Jika `startAction` diset, loop akan langsung menjalankan aksi tersebut
 * (misal langsung masuk ke menu agent). Jika `null`, akan menampilkan
 * dashboard dan menu pemilihan aksi.
 *
 * @param startAction - Nama aksi yang akan langsung dijalankan (optional).
 */
export async function runInteractiveLoop(startAction: string | null = null): Promise<void> {
  // Clear screen dan tampilkan header
  process.stdout.write('\x1b[H\x1b[2J');
  p.intro(color.cyan(' OpenCode Config Manager (TS Engine)'));
  
  // Deteksi apakah CWD adalah proyek OpenCode
  let defaultProject = 'global_agent';
  const cwd = process.cwd();
  const cwdSub1 = path.join(cwd, '.opencode');
  const cwdSub2 = path.join(cwd, 'opencode');
  if (fs.existsSync(path.join(cwdSub1, 'opencode.jsonc')) || fs.existsSync(path.join(cwdSub2, 'opencode.jsonc'))) {
    defaultProject = cwd;
  }
  
  utils.setProjectPaths(defaultProject);
  
  let action: string | null = startAction;
  
  while (true) {
    // Tampilkan dashboard hanya jika tidak ada startAction yang pending
    if (!action) {
      try {
        const dbLines = getDashboardLines();
        console.log('');
        dbLines.forEach(line => console.log('  ' + line));
        console.log('');
      } catch (err) {
        // Dashboard error — tetap lanjut ke menu
      }

      action = await p.autocomplete({
        message: 'Pilih Aksi (Ketik untuk mencari):',
        options: [
          { value: 'run', label: 'Run', hint: 'Execute opencode langsung dengan prompt' },
          { value: 'agent', label: 'Configure Agent', hint: 'model, steps, prompt, mode, permissions' },
          { value: 'session', label: 'Session Management', hint: 'list, export, delete' },
          { value: 'settings', label: 'System Toggles', hint: 'MCP, Compaction, Plugins' },
          { value: 'mcp', label: 'MCP Server Management', hint: 'toggle enabled, add servers' },
          { value: 'providers', label: 'Provider & API Key Management', hint: 'Manage credentials' },
          { value: 'models', label: 'Model Browser & Comparison', hint: 'Browse and compare models' },
          { value: 'reference', label: 'Reference Models Manager', hint: 'models-free.md' },
          { value: 'doctor', label: 'Doctor', hint: 'Diagnostics & Auto-Fix' },
          { value: 'switch', label: 'Switch Project / Workspace', hint: 'Ganti active workspace' },
          { value: 'exit', label: 'Exit', hint: 'Keluar dari aplikasi' }
        ]
      }) as string;
    }

    if (p.isCancel(action) || action === 'exit') {
      p.cancel('done');
      process.exit(0);
    }

    if (action === 'switch') {
      const projects = utils.findOpenCodeProjects();
      const workspaceOptions: Array<{ value: string; label: string }> = [
        { value: 'global_agent', label: ' Global Agent (~/.opencode)' },
        { value: 'global_system', label: ' Global System (~/.config/opencode)' }
      ];
      
      let cwdProject = null;
      if (defaultProject !== 'global_agent') {
        cwdProject = projects.find(p => p.path === defaultProject) || { name: path.basename(defaultProject), path: defaultProject };
        workspaceOptions.push({
          value: defaultProject,
          label: ` Current Project: ${cwdProject.name} (${defaultProject})`
        });
      }
      
      for (const proj of projects) {
        if (proj.path === defaultProject) continue;
        workspaceOptions.push({
          value: proj.path,
          label: ` ${proj.name} (${proj.path})`
        });
      }
      
      const newWorkspace = await p.autocomplete({
        message: 'Pilih Workspace (Ketik untuk mencari):',
        options: workspaceOptions
      }) as string;
      
      if (p.isCancel(newWorkspace)) {
        process.stdout.write('\x1b[H\x1b[2J');
        p.intro(color.cyan(' OpenCode Configurator '));
        action = null;
        continue;
      }
      
      utils.setProjectPaths(newWorkspace);
     
      process.stdout.write('\x1b[H\x1b[2J');
      p.intro(color.cyan(' OpenCode Config Manager '));
      action = null;
      continue;
    }

    try {
      if (action === 'agent') {
        await agentCmd.run();
      } else if (action === 'session') {
        await sessionCmd.run();
      } else if (action === 'settings') {
        await settingsCmd.run();
      } else if (action === 'mcp') {
        await mcpCmd.run();
      } else if (action === 'providers') {
        await providersCmd.run();
      } else if (action === 'models') {
        await modelsCmd.run();
      } else if (action === 'reference') {
        await refCmd.run();
      } else if (action === 'doctor') {
        await doctorCmd.run({ fix: true });
      } else if (action === 'run') {
        await runCmd.run();
      }
    } catch (err: any) {
      p.cancel(color.red(`Terjadi kesalahan saat menjalankan perintah: ${err.message}`));
    }
    
    // Clear screen untuk kembali ke menu utama
    process.stdout.write('\x1b[H\x1b[2J');
    p.intro(color.cyan(' OpenCode Config Manager'));
    action = null;
  }
}
