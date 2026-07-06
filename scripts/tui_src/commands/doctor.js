const fs = require('fs');
const path = require('path');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

async function run(options = {}) {
 const isFixMode = options.fix || false;
 const configPath = utils.paths.config;
 
 console.log(color.cyan('\n Memulai Diagnosis OpenCode Config...'));
 console.log(color.dim(`Target: ${configPath}\n`));
 
 let rawContent;
 try {
 rawContent = fs.readFileSync(configPath, 'utf8');
 } catch (err) {
 console.log(color.red(`[ERROR] Gagal membaca file config!`));
 console.log(` Detail : ${err.message}`);
 process.exit(1);
 }
 
 // 1. JSONC Syntax Check
 let config;
 try {
 const cleanJson = utils.stripComments(rawContent);
 config = JSON.parse(cleanJson);
 } catch (err) {
 console.log(color.red(`[ERROR] File config opencode.jsonc rusak (Syntax Error)!`));
 console.log(` Detail : ${err.message}`);
 console.log(` Fix : Buka file config dengan 'ag-conf' atau 'g-conf' lalu perbaiki kurung/koma yang salah.`);
 return 'syntax_error';
 }
 
 const errors = [];
 const warnings = [];
 
 // Extract agents list
 const agentBlockKey = config.agents ? 'agents' : 'agent';
 const agents = config[agentBlockKey] || {};
 const agentNames = Object.keys(agents).filter(name => {
 const data = agents[name];
 return data && (data.model || data.mode || data.prompt);
 });
 
 // 2. Default Agent Validation
 if (config.default_agent && !agentNames.includes(config.default_agent)) {
 errors.push({
 type: 'invalid_default_agent',
 message: `Default agent "${config.default_agent}" tidak terdaftar di blok agent/agents!`,
 detail: `default_agent diset ke "${config.default_agent}", tetapi agen tersebut tidak ada di konfigurasi.`,
 fixable: agentNames.length > 0,
 fixDesc: agentNames.length > 0 ? `Reset default_agent ke "${agentNames[0]}"` : 'Buat agent baru terlebih dahulu.'
 });
 }
 
 // Load models reference database
 const refModels = utils.parseReferenceModels();
 const flatModels = [];
 if (refModels) {
 for (const cat in refModels) {
 flatModels.push(...refModels[cat]);
 }
 }
 
 // 3. Scan agents configuration
 for (const name of agentNames) {
 const data = agents[name];
 
 // Mode validation
 if (data.mode && !['primary', 'subagent', 'all'].includes(data.mode)) {
 warnings.push({
 type: 'invalid_mode',
 agent: name,
 message: `Agent "${name}" menggunakan mode tidak standar: "${data.mode}"`,
 detail: `Mode saat ini: "${data.mode}". Mode yang didukung adalah primary, subagent, atau all.`,
 fixable: true,
 fixDesc: `Set mode agent "${name}" ke "subagent"`
 });
 }
 
 // Prompt file validation
 if (data.prompt && data.prompt.startsWith('{file:') && data.prompt.endsWith('}')) {
 const relPath = data.prompt.slice(6, -1);
 const absPath = path.resolve(path.dirname(configPath), relPath);
 if (!fs.existsSync(absPath)) {
 errors.push({
 type: 'missing_prompt_file',
 agent: name,
 path: absPath,
 relPath: relPath,
 message: `Agent "${name}": File prompt tidak ditemukan!`,
 detail: `Merujuk ke: ${absPath}`,
 fixable: true,
 fixDesc: `Buat file prompt markdown baru secara otomatis di: ${relPath}`
 });
 }
 }
 
 // Model validation
 if (data.model) {
 const refItem = flatModels.find(m => m.id === data.model);
 if (refItem) {
 if (refItem.status === 'Error') {
 // Find stable model in same provider
 const provider = data.model.split('/')[0];
 const stable = flatModels.find(m => m.id.startsWith(provider + '/') && m.status === 'Stabil');
 
 warnings.push({
 type: 'unstable_model',
 agent: name,
 model: data.model,
 message: `Agent "${name}": Menggunakan model yang sedang bermasalah (${data.model})!`,
 detail: `Status model di database referensi: [ ERROR]`,
 fixable: !!stable,
 fixDesc: stable ? `Ganti model agent "${name}" ke model stabil: "${stable.id}"` : 'Model stabil untuk provider ini tidak ditemukan di database.'
 });
 }
 } else {
 warnings.push({
 type: 'unknown_model',
 agent: name,
 model: data.model,
 message: `Agent "${name}": Menggunakan model "${data.model}" yang tidak terdaftar di database referensi!`,
 detail: `Model tidak ada di models-free.md.`,
 fixable: false,
 fixDesc: `Daftarkan model "${data.model}" ke database referensi dengan command 'ocm-db'.`
 });
 }
 }
 }
 
 // Output report
 if (errors.length === 0 && warnings.length === 0) {
 console.log(color.green(` Hasil Diagnosis: Config sehat wal afiat boss `));
 await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
 return 'healthy';
 }
 
 console.log(color.yellow(`Ditemukan ${errors.length} Error dan ${warnings.length} Warning:\n`));
 
 errors.forEach((err, idx) => {
 console.log(color.red(`[ERROR #${idx + 1}] ${err.message}`));
 if (err.detail) console.log(` Detail : ${err.detail}`);
 console.log(` Fix : ${err.fixDesc || 'Perbaiki secara manual.'}`);
 console.log();
 });
 
 warnings.forEach((warn, idx) => {
 console.log(color.yellow(`[WARN #${idx + 1}] ${warn.message}`));
 if (warn.detail) console.log(` Detail : ${warn.detail}`);
 console.log(` Fix : ${warn.fixDesc || 'Perbaiki secara manual.'}`);
 console.log();
 });
 
 // Auto-Fix execution
 if (isFixMode) {
 const fixableErrors = errors.filter(e => e.fixable);
 const fixableWarnings = warnings.filter(w => w.fixable);
 
 if (fixableErrors.length === 0 && fixableWarnings.length === 0) {
 console.log(color.dim('Tidak ada error/warning yang bisa diperbaiki secara otomatis.'));
 await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
 return 'done';
 }
 
 const confirmFix = await p.confirm({
 message: `Jalankan perbaikan otomatis untuk ${fixableErrors.length + fixableWarnings.length} temuan?`,
 active: 'Jalankan',
 inactive: 'Batal'
 });
 
 if (p.isCancel(confirmFix) || !confirmFix) {
 console.log(color.dim('Perbaikan otomatis dibatalkan.'));
 await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
 return 'cancelled';
 }
 
 let content = fs.readFileSync(configPath, 'utf8');
 
 for (const err of fixableErrors) {
 console.log(color.cyan(` Memperbaiki: ${err.message}`));
 if (err.type === 'invalid_default_agent') {
 content = utils.updateNestedField(content, [], 'default_agent', JSON.stringify(agentNames[0]));
 } else if (err.type === 'missing_prompt_file') {
 const absPath = err.path;
 fs.mkdirSync(path.dirname(absPath), { recursive: true });
 const title = err.agent.charAt(0).toUpperCase() + err.agent.slice(1);
 fs.writeFileSync(absPath, `# ${title} Agent\n\nYou are a helpful ${err.agent} assistant.\n`, 'utf8');
 }
 }
 
 for (const warn of fixableWarnings) {
 console.log(color.cyan(` Memperbaiki: ${warn.message}`));
 if (warn.type === 'invalid_mode') {
 content = utils.updateNestedField(content, [agentBlockKey, warn.agent], 'mode', JSON.stringify('subagent'));
 } else if (warn.type === 'unstable_model') {
 const provider = warn.model.split('/')[0];
 const stable = flatModels.find(m => m.id.startsWith(provider + '/') && m.status === 'Stabil');
 if (stable) {
 content = utils.updateNestedField(content, [agentBlockKey, warn.agent], 'model', JSON.stringify(stable.id));
 }
 }
 }
 
 fs.writeFileSync(configPath, content, 'utf8');
 console.log(color.green(`\n Sukses mengeksekusi perbaikan otomatis! Silakan jalankan 'ocm -d' lagi untuk memverifikasi. `));
 
 // Wait for user before returning to menu if inside TUI
 await p.select({
 message: 'Kembali ke Menu Utama?',
 options: [{ value: 'back', label: 'Kembali' }]
 });
 return 'fixed';
 } else {
 console.log(color.dim(` Jalankan 'ocm -d --fix' untuk menerapkan perbaikan otomatis.`));
 await p.select({ message: 'Tekan Enter untuk kembali', options: [{ value: 'back', label: 'Kembali' }] });
 return 'diagnosed';
 }
}

module.exports = { run };
