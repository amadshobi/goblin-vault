const fs = require('fs');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

async function run() {
 utils.setProjectPaths('global_system');
 const configPath = utils.paths.config;
 
 if (!fs.existsSync(configPath)) {
 p.note(color.yellow('File global system config tidak ditemukan.'));
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 return 'main_menu';
 }
 
 while (true) {
 let content = fs.readFileSync(configPath, 'utf8');
 let config = {};
 try {
 config = JSON.parse(utils.stripComments(content));
 } catch (e) {
 p.cancel(color.red(`Gagal parse JSONC global system config: ${e.message}`));
 return 'main_menu';
 }
 
 const mcpBlock = config.mcp || {};
 const serverNames = Object.keys(mcpBlock).filter(k => typeof mcpBlock[k] === 'object' && mcpBlock[k] !== null);
 
 const action = await p.select({
 message: 'Kelola MCP Servers (Model Context Protocol):',
 options: [
 { value: 'list', label: ` Daftar Server Terdaftar (${serverNames.length})` },
 { value: 'toggle', label: ' Toggle Aktif/Nonaktif Server' },
 { value: 'add', label: ' Tambah Custom MCP Server' },
 { value: 'back', label: ' Back' }
 ]
 });
 
 if (p.isCancel(action) || action === 'back') {
 return 'main_menu';
 }
 
 if (action === 'list') {
 if (serverNames.length === 0) {
 p.note('Belum ada MCP server yang dikonfigurasi.');
 } else {
 const details = serverNames.map(name => {
 const s = mcpBlock[name];
 const status = s.disabled === true ? color.red('[NONAKTIF]') : color.green('[AKTIF]');
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
 const status = mcpBlock[name].disabled === true ? '(Nonaktif)' : '(Aktif)';
 return { value: name, label: `${name} ${status}` };
 })
 });
 
 if (p.isCancel(chosenServer)) continue;
 
 const serverConfig = mcpBlock[chosenServer];
 const isCurrentlyDisabled = serverConfig.disabled === true;
 const newDisabledVal = !isCurrentlyDisabled;
 
 content = utils.ensureNestedBlock(content, ['mcp', chosenServer]);
 content = utils.updateNestedField(content, ['mcp', chosenServer], 'disabled', String(newDisabledVal));
 
 try {
 fs.writeFileSync(configPath, content, 'utf8');
 p.outro(color.green(` Server "${chosenServer}" berhasil di-toggle menjadi ${newDisabledVal ? 'Nonaktif' : 'Aktif'}! `));
 } catch (e) {
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
 });
 
 if (p.isCancel(name)) continue;
 
 const command = await p.text({
 message: 'Masukkan command binary (misal: node, npx, python):',
 validate(val) {
 if (!val.trim()) return 'Command tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(command)) continue;
 
 const argsStr = await p.text({
 message: 'Masukkan argumen command (pisahkan dengan koma jika banyak):',
 placeholder: 'e.g. @modelcontextprotocol/server-filesystem, /home/user'
 });
 
 if (p.isCancel(argsStr)) continue;
 
 const args = argsStr.trim() ? argsStr.split(',').map(s => s.trim()) : [];
 
 content = utils.ensureNestedBlock(content, ['mcp', name]);
 content = utils.updateNestedField(content, ['mcp', name], 'command', JSON.stringify(command));
 content = utils.updateNestedField(content, ['mcp', name], 'args', JSON.stringify(args));
 content = utils.updateNestedField(content, ['mcp', name], 'disabled', 'false');
 
 try {
 fs.writeFileSync(configPath, content, 'utf8');
 p.outro(color.green(` MCP Server "${name}" berhasil ditambahkan ke config! `));
 } catch (e) {
 p.cancel(color.red(`Gagal menulis file config: ${e.message}`));
 }
 }
 }
}

module.exports = { run };
