const fs = require('fs');
const execSync = require('child_process').execSync;
const p = require('@clack/prompts');
const color = require('picocolors');

const SECRETS_PATH = `${process.env.HOME}/.secrets.env`;

// Helper to parse secrets env file
function parseSecrets() {
 const secrets = {};
 if (!fs.existsSync(SECRETS_PATH)) return secrets;
 const content = fs.readFileSync(SECRETS_PATH, 'utf8');
 const lines = content.split('\n');
 lines.forEach(line => {
 const trimmed = line.trim();
 if (trimmed.startsWith('export ')) {
 const eqIdx = trimmed.indexOf('=');
 if (eqIdx !== -1) {
 const key = trimmed.slice(7, eqIdx).trim();
 const val = trimmed.slice(eqIdx + 1).trim();
 secrets[key] = val;
 }
 }
 });
 return secrets;
}

// Helper to save secrets env file
function saveSecrets(secrets) {
 let content = '# OpenCode Secrets Environment File\n\n';
 for (const [key, val] of Object.entries(secrets)) {
 content += `export ${key}=${val}\n`;
 }
 fs.writeFileSync(SECRETS_PATH, content, 'utf8');
}

async function run() {
 while (true) {
 const secrets = parseSecrets();
 
 const keys = [
 { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key' },
 { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key' },
 { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub PAT Token' },
 { key: 'GITHUB_KILO_ACCESS', label: 'GitHub Kilo Access Token' }
 ];
 
 const action = await p.select({
 message: 'Kelola API Keys & Providers:',
 options: [
 { value: 'view', label: ' Lihat status Key ' },
 { value: 'edit', label: ' Ubah / Tambah API Key' },
 { value: 'test', label: ' Test Koneksi API Key' },
 { value: 'back', label: ' Back' }
 ]
 });
 
 if (p.isCancel(action) || action === 'back') {
 return 'main_menu';
 }
 
 if (action === 'view') {
 const lines = keys.map(k => {
 const val = secrets[k.key] || process.env[k.key] || '';
 const masked = val ? `${val.slice(0, 8)}...${val.slice(-6)}` : color.red('Not set');
 return `${k.label.padEnd(28)}: ${masked}`;
 }).join('\n');
 
 p.note(lines, 'Status API Keys saat ini');
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 
 else if (action === 'edit') {
 const chosenKey = await p.select({
 message: 'Pilih Key yang ingin diubah:',
 options: keys.map(k => ({ value: k.key, label: k.label }))
 });
 
 if (p.isCancel(chosenKey)) continue;
 
 const newVal = await p.text({
 message: `Masukkan nilai baru untuk ${chosenKey}:`,
 placeholder: secrets[chosenKey] ? `${secrets[chosenKey].slice(0, 8)}...` : ''
 });
 
 if (p.isCancel(newVal)) continue;
 
 if (newVal.trim() === '') {
 delete secrets[chosenKey];
 } else {
 secrets[chosenKey] = newVal.trim();
 }
 
 try {
 saveSecrets(secrets);
 p.outro(color.green(` Sukses mengupdate ${chosenKey}! `));
 } catch (e) {
 p.cancel(color.red(`Gagal menulis secrets file: ${e.message}`));
 }
 }
 
 else if (action === 'test') {
 const chosenKey = await p.select({
 message: 'Pilih API Key untuk dites:',
 options: keys.map(k => ({ value: k.key, label: k.label }))
 });
 
 if (p.isCancel(chosenKey)) continue;
 
 const val = secrets[chosenKey] || process.env[chosenKey] || '';
 if (!val) {
 p.note(color.red(`Key ${chosenKey} belum di-set. Tidak bisa men-test koneksi.`));
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 continue;
 }
 
 console.log(color.cyan(`\n Mengetes koneksi ke API server...`));
 
 let testCmd = '';
 if (chosenKey === 'OPENROUTER_API_KEY') {
 testCmd = `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${val}" https://openrouter.ai/api/v1/models`;
 } else if (chosenKey === 'DEEPSEEK_API_KEY') {
 testCmd = `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${val}" https://api.deepseek.com/models`;
 } else if (chosenKey.startsWith('GITHUB_')) {
 testCmd = `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${val}" https://api.github.com/user`;
 }
 
 if (testCmd) {
 try {
 const code = execSync(testCmd, { encoding: 'utf8' }).trim();
 if (code === '200') {
 p.outro(color.green(` Koneksi Sukses! API Server merespon dengan status HTTP 200 OK. `));
 } else {
 p.cancel(color.red(`Koneksi Gagal! API Server merespon dengan status HTTP ${code}. Periksa kembali validitas key Anda.`));
 }
 } catch (e) {
 p.cancel(color.red(`Gagal melakukan request: ${e.message}`));
 }
 } else {
 p.note(color.yellow('Test konektivitas belum disupport untuk tipe key ini.'));
 }
 
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 }
}

module.exports = { run };
