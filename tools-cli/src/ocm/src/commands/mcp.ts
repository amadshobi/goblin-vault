/**
 * OpenCode Configurator (OCM) — Command: MCP Server Management.
 *
 * Sub-menu interaktif untuk mengelola server MCP (Model Context Protocol)
 * di file config global system (`~/.config/opencode/opencode.jsonc`).
 *
 * Fitur:
 * - Mendaftar semua server MCP beserta status aktif/nonaktif.
 * - Toggle enable/disable server.
 * - Menambah server MCP kustom dengan command dan args.
 */

import fs from 'fs';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';
import { MCPServerConfig } from '../types/config.js';

/**
 * Membuka menu interaktif manajemen MCP server.
 *
 * Selalu beroperasi pada konfigurasi global system (`global_system`),
 * karena MCP server bersifat system-wide, bukan per-proyek.
 *
 * @returns Promise string 'main_menu' untuk kembali ke loop utama.
 */
export async function run(): Promise<string> {
  utils.setProjectPaths('global_system');
  const configPath = utils.paths.config;
  
  if (!fs.existsSync(configPath)) {
    p.note(color.yellow('File global system config tidak ditemukan.'));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return 'main_menu';
  }
  
  while (true) {
    let content = fs.readFileSync(configPath, 'utf8');
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(utils.stripComments(content));
    } catch (e: any) {
      p.cancel(color.red(`Gagal parse JSONC global system config: ${e.message}`));
      return 'main_menu';
    }
    
    // Filter hanya entri MCP yang berupa objek (bukan string/null)
    const mcpBlock: Record<string, MCPServerConfig> = config.mcp || {};
    const serverNames = Object.keys(mcpBlock).filter(k => typeof mcpBlock[k] === 'object' && mcpBlock[k] !== null);
    
    const action = await p.select({
      message: 'Kelola MCP Servers (Model Context Protocol):',
      options: [
        { value: 'list', label: ` Daftar Server Terdaftar (${serverNames.length})` },
        { value: 'toggle', label: ' Toggle Aktif/Nonaktif Server' },
        { value: 'add', label: ' Tambah Custom MCP Server' },
        { value: 'back', label: ' Back' }
      ]
    }) as string;
    
    if (p.isCancel(action) || action === 'back') {
      return 'main_menu';
    }
    
    if (action === 'list') {
      if (serverNames.length === 0) {
        p.note('Belum ada MCP server yang dikonfigurasi.');
      } else {
        const details = serverNames.map(name => {
          const s = mcpBlock[name];
          // Default: aktif jika enabled tidak diset dan disabled tidak true
          const isEnabled = s.enabled === true || (s.enabled === undefined && s.disabled !== true);
          const status = isEnabled ? color.green('[AKTIF]') : color.red('[NONAKTIF]');
          return `${color.bold(name)}: ${status}\n Command: ${s.command || 'N/A'}\n Args: ${JSON.stringify(s.args || [])}`;
        }).join('\n\n');
        
        p.note(details, 'Daftar MCP Server & Status');
      }
      await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    }
    
    else if (action === 'toggle') {
      if (serverNames.length === 0) {
        p.note(color.yellow('Belum ada MCP server untuk di-toggle.'));
        await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
        continue;
      }
      
      const chosenServer = await p.select({
        message: 'Pilih MCP server yang ingin di-toggle:',
        options: serverNames.map(name => {
          const s = mcpBlock[name];
          const isEnabled = s.enabled === true || (s.enabled === undefined && s.disabled !== true);
          const status = isEnabled ? '(Aktif)' : '(Nonaktif)';
          return { value: name, label: `${name} ${status}` };
        })
      }) as string;
      
      if (p.isCancel(chosenServer)) continue;
      
      const serverConfig = mcpBlock[chosenServer];
      const isCurrentlyEnabled = serverConfig.enabled === true || (serverConfig.enabled === undefined && serverConfig.disabled !== true);
      const newEnabledVal = !isCurrentlyEnabled;
      
      content = utils.ensureNestedBlock(content, ['mcp', chosenServer]);
      content = utils.updateNestedField(content, ['mcp', chosenServer], 'enabled', String(newEnabledVal));
      // Jika field `disabled` ada, hapus karena sudah digantikan oleh `enabled`
      if (serverConfig.disabled !== undefined) {
        content = utils.deleteNestedField(content, ['mcp', chosenServer], 'disabled');
      }
      
      try {
        fs.writeFileSync(configPath, content, 'utf8');
        p.outro(color.green(` Server "${chosenServer}" berhasil di-toggle menjadi ${newEnabledVal ? 'Aktif' : 'Nonaktif'}! `));
      } catch (e: any) {
        p.cancel(color.red(`Gagal menulis file config: ${e.message}`));
      }
    }
    
    else if (action === 'add') {
      const name = await p.text({
        message: 'Masukkan nama MCP server baru (misal: filesystem):',
        validate(val) {
          if (!val.trim()) return 'Nama server tidak boleh kosong!';
          if (mcpBlock[val.trim()]) return 'Nama server sudah digunakan!';
        }
      }) as string;
      
      if (p.isCancel(name)) continue;
      
      const command = await p.text({
        message: 'Masukkan command binary (misal: node, npx, python):',
        validate(val) {
          if (!val.trim()) return 'Command tidak boleh kosong!';
        }
      }) as string;
      
      if (p.isCancel(command)) continue;
      
      const argsStr = await p.text({
        message: 'Masukkan argumen command (pisahkan dengan koma jika banyak):',
        placeholder: 'e.g. @modelcontextprotocol/server-filesystem, /home/user'
      }) as string;
      
      if (p.isCancel(argsStr)) continue;
      
      // Parse argumen yang dipisah koma
      const args = argsStr.trim() ? argsStr.split(',').map(s => s.trim()) : [];
      
      content = utils.ensureNestedBlock(content, ['mcp', name]);
      content = utils.updateNestedField(content, ['mcp', name], 'command', JSON.stringify(command));
      content = utils.updateNestedField(content, ['mcp', name], 'args', JSON.stringify(args));
      content = utils.updateNestedField(content, ['mcp', name], 'enabled', 'true');
      
      try {
        fs.writeFileSync(configPath, content, 'utf8');
        p.outro(color.green(` MCP Server "${name}" berhasil ditambahkan ke config! `));
      } catch (e: any) {
        p.cancel(color.red(`Gagal menulis file config: ${e.message}`));
      }
    }
  }
}
