const fs = require('fs');
const readline = require('readline');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

function hasPath(obj, pathArr) {
 let curr = obj;
 for (const key of pathArr) {
 if (!curr || typeof curr !== 'object' || !(key in curr)) return false;
 curr = curr[key];
 }
 return true;
}

function getPath(obj, pathArr) {
 let curr = obj;
 for (const key of pathArr) {
 curr = curr[key];
 }
 return curr;
}

async function run() {
 const originalContent = fs.readFileSync(utils.paths.config, 'utf8');
 let config;
 try {
 const cleanJson = utils.stripComments(originalContent);
 config = JSON.parse(cleanJson);
 } catch (err) {
 p.cancel(color.red(`Gagal memproses JSONC: ${err.message}`));
 process.exit(1);
 }
 
 const toggles = [
 // Group 2: Process & Server Settings
 { key: 'autoupdate', pathArr: [], fieldName: 'autoupdate', label: 'Sys: Autoupdate', type: 'select', options: ['default', 'true', 'false', 'notify'] },
 
 // Group 3: Ambient Instructions
 { key: 'instructions', pathArr: [], fieldName: 'instructions', label: 'Sys: Ambient Instructions', type: 'array' },
 
 // Group 4: Plugins List
 { key: 'plugin', pathArr: [], fieldName: 'plugin', label: 'Sys: Plugins List', type: 'array' },
 
 // Group 6: Sharing & Identity
 { key: 'share', pathArr: [], fieldName: 'share', label: 'Sys: Share Mode', type: 'select', options: ['default', 'manual', 'auto', 'disabled'] },
 { key: 'username', pathArr: [], fieldName: 'username', label: 'Sys: Username Override', type: 'text' },
 
 // Group 7: Model Fallback
 { key: 'model', pathArr: [], fieldName: 'model', label: 'Sys: Default Fallback Model', type: 'model_select' },
 
 // Group 8: Default Agent
 { key: 'default_agent', pathArr: [], fieldName: 'default_agent', label: 'Sys: Default Agent', type: 'agent_select' },

 // Group 9: MCP Servers
 { key: 'mcp_github', pathArr: ['mcp', 'github'], fieldName: 'enabled', label: 'MCP: GitHub Server', type: 'boolean' },
 { key: 'mcp_context7', pathArr: ['mcp', 'context7'], fieldName: 'enabled', label: 'MCP: Context7 Server', type: 'boolean' },
 { key: 'mcp_sequential', pathArr: ['mcp', 'server-sequential'], fieldName: 'enabled', label: 'MCP: Sequential Thinking', type: 'boolean' },
 
 // Group 10: Compaction
 { key: 'compaction_auto', pathArr: ['compaction'], fieldName: 'auto', label: 'Compaction: Auto', type: 'boolean' },
 { key: 'compaction_prune', pathArr: ['compaction'], fieldName: 'prune', label: 'Compaction: Prune', type: 'boolean' },
 { key: 'compaction_buffer', pathArr: ['compaction'], fieldName: 'buffer', label: 'Compaction: Buffer Tokens', type: 'number' },
 { key: 'compaction_reserved', pathArr: ['compaction'], fieldName: 'reserved', label: 'Compaction: Reserved Tokens', type: 'number' },
 { key: 'compaction_keep_tokens', pathArr: ['compaction', 'keep'], fieldName: 'tokens', label: 'Compaction: Keep Tokens', type: 'number' },
 
 // Group 5: Tool Output Bounding
 { key: 'tool_output_max_lines', pathArr: ['tool_output'], fieldName: 'max_lines', label: 'Tool Output: Max Lines', type: 'number' },
 { key: 'tool_output_max_bytes', pathArr: ['tool_output'], fieldName: 'max_bytes', label: 'Tool Output: Max Bytes', type: 'number' },
 
 // Group 8: Agents Disable States
 { key: 'agent_build_disabled', pathArr: ['agent', 'build'], fieldName: 'disable', label: 'Agent: Build Disable', type: 'select', options: ['default', 'disable', 'enable'] },
 { key: 'agent_plan_disabled', pathArr: ['agent', 'plan'], fieldName: 'disable', label: 'Agent: Plan Disable', type: 'select', options: ['default', 'disable', 'enable'] },
 { key: 'agent_general_disabled', pathArr: ['agent', 'general'], fieldName: 'disable', label: 'Agent: General Disable', type: 'select', options: ['default', 'disable', 'enable'] }
 ];
 
 const items = [];
 
 for (const t of toggles) {
 let actualPathArr = t.pathArr;
 
 // Support agent key mapping
 if (t.key.startsWith('agent_')) {
 const agentName = t.key.split('_')[1]; // build, plan, general
 if (hasPath(config, ['agents', agentName])) {
 actualPathArr = ['agents', agentName];
 } else if (hasPath(config, ['agent', agentName])) {
 actualPathArr = ['agent', agentName];
 } else {
 // Only show agent disable configs if the agent actually exists in the file
 continue;
 }
 }
 
 let fieldName = t.fieldName;
 if (t.key.startsWith('agent_')) {
 const hasDisabledField = hasPath(config, [...actualPathArr, 'disabled']);
 fieldName = hasDisabledField ? 'disabled' : 'disable';
 }
 
 // Read value from parsed JSON, default to empty/false if not set
 let rawVal = hasPath(config, [...actualPathArr, fieldName]) ? getPath(config, [...actualPathArr, fieldName]) : undefined;
 let mappedValue;
 
 if (t.type === 'boolean') {
 mappedValue = rawVal === true;
 } else if (t.type === 'select') {
 if (rawVal === true) mappedValue = 'disable';
 else if (rawVal === false) mappedValue = 'enable';
 else if (rawVal === undefined) mappedValue = 'default';
 else mappedValue = String(rawVal);
 } else if (t.type === 'number') {
 mappedValue = rawVal !== undefined ? Number(rawVal) : 0;
 } else if (t.type === 'array') {
 mappedValue = Array.isArray(rawVal) ? [...rawVal] : [];
 } else {
 mappedValue = rawVal !== undefined ? rawVal : '';
 }
 
 items.push({
 ...t,
 pathArr: actualPathArr,
 fieldName: fieldName,
 value: mappedValue,
 originalValue: Array.isArray(mappedValue) ? [...mappedValue] : mappedValue
 });
 }
 
 let cursor = 0;
 let actionResult = 'main_menu';
 
 await new Promise((resolve) => {
 process.stdin.setRawMode(true);
 process.stdin.resume();
 readline.emitKeypressEvents(process.stdin);
 
 function printBorderLine(content, width = 54) {
 const visibleLen = content.replace(/\u001b\[\d+m/g, '').length;
 const pad = ' '.repeat(Math.max(0, width - visibleLen));
 console.log(`│ ${content}${pad} │`);
 }

 function draw() {
 process.stdout.write('\x1b[H\x1b[2J');
 
 console.log(color.cyan('┌────────────────────────────────────────────────────────┐'));
 printBorderLine(`${color.bold('OpenCode Configurator ')}`);
 printBorderLine('');
 printBorderLine('Gunakan Panah ↑/↓ untuk navigasi.');
 printBorderLine('[Space] = Toggle Boolean | [Enter] = Edit Value');
 printBorderLine('[Esc] = Simpan & Keluar');
 console.log(color.cyan('├────────────────────────────────────────────────────────┤'));
 
 items.forEach((item, index) => {
 const isSelected = index === cursor;
 const pointer = isSelected ? color.cyan('▸ ') : ' ';
 
 let displayValue = '';
 const labelPadded = item.label.padEnd(28);
 
 if (item.type === 'boolean') {
 const checkbox = item.value ? color.green('[x] True') : color.red('[ ] False');
 displayValue = `${labelPadded}: ${checkbox}`;
 } else if (item.type === 'select') {
 let valColor = color.dim;
 if (item.value === 'disable') valColor = color.red;
 if (item.value === 'enable') valColor = color.green;
 displayValue = `${labelPadded}: ${valColor(`(${item.value})`)}`;
 } else if (item.type === 'number') {
 displayValue = `${labelPadded}: ${color.yellow(item.value || '0')}`;
 } else if (item.type === 'array') {
 displayValue = `${labelPadded}: ${color.cyan(`(${item.value.length} items)`)}`;
 } else {
 const valText = item.value ? `"${item.value}"` : 'default';
 displayValue = `${labelPadded}: ${color.magenta(valText)}`;
 }
 
 printBorderLine(`${pointer}${displayValue}`);
 });
 console.log(color.cyan('└────────────────────────────────────────────────────────┘'));
 }
 
 async function keyHandler(str, key) {
 if (key.name === 'up') {
 cursor = (cursor - 1 + items.length) % items.length;
 draw();
 } else if (key.name === 'down') {
 cursor = (cursor + 1) % items.length;
 draw();
 } else if (key.name === 'space') {
 const item = items[cursor];
 if (item.type === 'boolean') {
 item.value = !item.value;
 draw();
 }
 } else if (key.name === 'return') {
 const item = items[cursor];
 
 // Suspend raw mode
 process.stdin.setRawMode(false);
 process.stdin.pause();
 process.stdin.removeListener('keypress', keyHandler);
 console.log('\n');
 
 if (item.type === 'select') {
 const selection = await p.select({
 message: `Pilih status untuk ${item.label}:`,
 options: item.options.map(o => ({ value: o, label: o }))
 });
 if (!p.isCancel(selection)) {
 item.value = selection;
 }
 }
 
 else if (item.type === 'text') {
 const input = await p.text({
 message: `Masukkan value untuk ${item.label} (atau kosongkan untuk default):`,
 placeholder: String(item.value || '')
 });
 if (!p.isCancel(input)) {
 item.value = input.trim();
 }
 }
 
 else if (item.type === 'number') {
 const input = await p.text({
 message: `Masukkan angka untuk ${item.label}:`,
 placeholder: String(item.value || '0'),
 validate(val) {
 if (val.trim() && (isNaN(Number(val)) || Number(val) < 0)) {
 return 'Harus berupa angka positif!';
 }
 }
 });
 if (!p.isCancel(input)) {
 item.value = input.trim() ? Number(input.trim()) : 0;
 }
 }
 
 else if (item.type === 'array') {
 const arrayAction = await p.select({
 message: `Kelola list ${item.label}:`,
 options: [
 { value: 'add', label: ' Add Item' },
 { value: 'remove', label: ' Remove Item' },
 { value: 'back', label: ' Exit' }
 ]
 });
 
 if (arrayAction === 'add') {
 const newItem = await p.text({
 message: 'Masukkan item string baru:',
 validate(val) {
 if (!val.trim()) return 'Item tidak boleh kosong!';
 }
 });
 if (!p.isCancel(newItem)) {
 item.value.push(newItem.trim());
 }
 } else if (arrayAction === 'remove') {
 if (item.value.length === 0) {
 p.note('List kosong, tidak ada item untuk dihapus.');
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 } else {
 const toRemove = await p.select({
 message: 'Pilih item yang ingin dihapus:',
 options: item.value.map((v, i) => ({ value: i, label: v }))
 });
 if (!p.isCancel(toRemove)) {
 item.value.splice(toRemove, 1);
 }
 }
 }
 }
 
 else if (item.type === 'model_select') {
 const refModels = utils.parseReferenceModels();
 if (refModels) {
 const provider = await p.select({
 message: 'Pilih provider model:',
 options: Object.keys(refModels).map(pr => ({ value: pr, label: pr }))
 });
 if (!p.isCancel(provider)) {
 const model = await p.select({
 message: 'Pilih model:',
 options: refModels[provider].map(m => ({ value: m.id, label: m.alias || m.id }))
 });
 if (!p.isCancel(model)) {
 item.value = model;
 }
 }
 } else {
 const textVal = await p.text({ message: 'Masukkan Model ID secara manual:' });
 if (!p.isCancel(textVal)) {
 item.value = textVal.trim();
 }
 }
 }
 
 else if (item.type === 'agent_select') {
 const agentsList = Object.keys(config.agent || config.agents || {}).filter(name => {
 const data = (config.agent || config.agents)[name];
 return data && (data.model || data.mode || data.prompt);
 });
 if (agentsList.length > 0) {
 const agent = await p.select({
 message: 'Pilih default agent:',
 options: agentsList.map(a => ({ value: a, label: a }))
 });
 if (!p.isCancel(agent)) {
 item.value = agent;
 }
 } else {
 p.note('Tidak ada agent yang terdaftar.');
 await p.select({
 message: 'Kembali?',
 options: [{ value: 'back', label: 'Kembali' }]
 });
 }
 }
 
 // Restore TUI keypress listener
 process.stdin.setRawMode(true);
 process.stdin.resume();
 process.stdin.on('keypress', keyHandler);
 draw();
 } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
 process.stdin.setRawMode(false);
 process.stdin.pause();
 process.stdin.removeListener('keypress', keyHandler);
 actionResult = key.name === 'escape' ? 'save' : 'cancel';
 resolve();
 }
 }
 
 process.stdin.on('keypress', keyHandler);
 draw();
 });
 
 if (actionResult === 'cancel') {
 p.cancel('Perubahan dibatalkan.');
 return 'main_menu';
 }
 
 // Save modifications to raw text
 let updatedContent = originalContent;
 let changed = false;
 
 for (const item of items) {
 const isArrayChanged = item.type === 'array' && (
 item.value.length !== item.originalValue.length ||
 item.value.some((v, i) => v !== item.originalValue[i])
 );
 const isValueChanged = item.type !== 'array' && item.value !== item.originalValue;
 
 if (isValueChanged || isArrayChanged) {
 changed = true;
 
 let formattedValue = item.value;
 let shouldDelete = false;
 
 if (item.type === 'select') {
 if (item.value === 'default') {
 shouldDelete = true;
 } else if (item.value === 'disable') {
 formattedValue = true;
 } else if (item.value === 'enable') {
 formattedValue = false;
 } else {
 if (item.value === 'true') formattedValue = true;
 else if (item.value === 'false') formattedValue = false;
 else formattedValue = JSON.stringify(item.value);
 }
 } else if (item.type === 'text' || item.type === 'model_select' || item.type === 'agent_select') {
 if (item.value === '' || item.value === null || item.value === undefined) {
 shouldDelete = true;
 } else {
 formattedValue = JSON.stringify(item.value);
 }
 } else if (item.type === 'array') {
 if (item.value.length === 0) {
 shouldDelete = true;
 } else {
 formattedValue = JSON.stringify(item.value, null, 2);
 }
 }
 
 if (shouldDelete) {
 updatedContent = utils.deleteNestedField(updatedContent, item.pathArr, item.fieldName);
 } else {
 // Auto-create missing block nodes
 if (item.pathArr.length > 0) {
 updatedContent = utils.ensureNestedBlock(updatedContent, item.pathArr);
 }
 updatedContent = utils.updateNestedField(updatedContent, item.pathArr, item.fieldName, formattedValue);
 }
 }
 }
 
 if (changed) {
 try {
 fs.writeFileSync(utils.paths.config, updatedContent, 'utf8');
 p.outro(color.green(' Sukses menyimpan semua perubahan config! '));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal menyimpan perubahan: ${err.message}`));
 process.exit(1);
 }
 } else {
 p.outro(color.dim('Tidak ada perubahan yang dilakukan.'));
 return 'success';
 }
}

module.exports = { run };
