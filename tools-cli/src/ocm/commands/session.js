const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');
const { runWithSpinner } = require('../ui/spinner');

async function getAllSessions() {
 const sessionDir = path.join(process.env.HOME, '.config', 'opencode', 'context-mode', 'sessions');
 if (!fs.existsSync(sessionDir)) return [];

 const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.db'));
 let allSessions = [];

 for (const file of files) {
 const fullPath = path.join(sessionDir, file);
 try {
 const { stdout } = await execAsync(`sqlite3 -separator "|||" "${fullPath}" "select m.session_id, m.started_at, coalesce(m.last_event_at, m.started_at) as last_event, m.event_count, m.project_dir, (select replace(replace(data, char(10), ' '), char(13), ' ') from session_events where session_id = m.session_id and type = 'user_prompt' order by id asc limit 1) as name from session_meta m" 2>/dev/null`);
 const out = stdout.trim();
 if (out) {
 const lines = out.split('\n');
 for (const line of lines) {
 const parts = line.split('|||');
 if (parts.length >= 5) {
 allSessions.push({
 id: parts[0],
 startedAt: parts[1],
 lastEventAt: parts[2],
 eventCount: parseInt(parts[3], 10),
 projectDir: parts[4],
 name: parts[5] ? parts[5].trim() : '(No Prompt)',
 dbPath: fullPath
 });
 }
 }
 }
 } catch (e) {
 // ignore read errors for individual DBs
 }
 }
 
 // Sort by lastEventAt descending
 allSessions.sort((a, b) => new Date(b.lastEventAt) - new Date(a.lastEventAt));
 
 // Map titles from opencode session list
 try {
 const { stdout } = await execAsync('opencode session list', { stdio: ['ignore', 'pipe', 'ignore'] });
 const out = stdout.trim().split('\n');
 const titleMap = {};
 for (const line of out) {
 const match = line.match(/^(ses_[a-zA-Z0-9]+)\s+(.+?)\s{2,}(.+)$/);
 if (match) {
 titleMap[match[1]] = match[2].trim();
 }
 }
 for (let i = 0; i < allSessions.length; i++) {
 if (titleMap[allSessions[i].id]) {
 allSessions[i].name = titleMap[allSessions[i].id];
 }
 }
 } catch (e) {
 // fallback to what's already there
 }
 
 return allSessions;
}

async function run() {
 while (true) {
 const sessionsList = await runWithSpinner(() => getAllSessions());
 
 if (sessionsList.length === 0) {
 p.note(color.yellow('Belum ada session terdaftar di database mana pun.'));
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 return 'main_menu';
 }
 
 const action = await p.autocomplete({
 message: 'Kelola Session OpenCode (Ketik untuk mencari):',
 options: [
 { value: 'list', label: ` Daftar / Lihat Semua Session (${sessionsList.length})` },
 { value: 'export', label: ' Export Session ke Markdown' },
 { value: 'delete', label: ' Hapus Session' },
 { value: 'back', label: ' Kembali ke Menu Utama' }
 ]
 });
 
 if (p.isCancel(action) || action === 'back') {
 return 'main_menu';
 }
 
 const sessionOptions = sessionsList.map(s => {
 const shortName = s.name.slice(0, 60).padEnd(60);
 return {
 value: s.id,
 label: `${s.id.slice(0, 10)}... | ${shortName}`
 };
 });
 
 if (action === 'list') {
 const sid = await p.autocomplete({
 message: 'Pilih session untuk melihat info detail:',
 options: sessionOptions
 });
 
 if (p.isCancel(sid)) continue;
 
 const sObj = sessionsList.find(s => s.id === sid);
 p.note(`Session ID : ${sObj.id}
Session Name: ${sObj.name}
Project Dir : ${sObj.projectDir}
Total Events: ${sObj.eventCount}
Started At : ${sObj.startedAt}
Last Event : ${sObj.lastEventAt}`);
 
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 
 else if (action === 'delete') {
 const sids = await p.multiselect({
 message: 'Pilih session yang ingin dihapus (Spasi untuk memilih, Enter untuk konfirmasi):',
 options: sessionOptions,
 required: false
 });
 
 if (p.isCancel(sids) || !sids || sids.length === 0) continue;
 
 const confirmDel = await p.confirm({
 message: `Apakah Anda yakin ingin menghapus ${sids.length} session terpilih?`,
 active: 'Ya, Hapus',
 inactive: 'Tidak, Batal'
 });
 
 if (confirmDel === true) {
 let deletedCount = 0;
 for (const sid of sids) {
 const sObj = sessionsList.find(s => s.id === sid);
 if (sObj) {
 try {
 execSync(`sqlite3 "${sObj.dbPath}" "delete from session_meta where session_id = '${sid}'; delete from session_events where session_id = '${sid}'; delete from session_resume where session_id = '${sid}'; delete from tool_calls where session_id = '${sid}';" 2>/dev/null`);
 deletedCount++;
 } catch (e) {
 // ignore individual failures
 }
 }
 }
 console.clear();
 p.intro(color.cyan(' OpenCode Configurator (ocm v2) '));
 p.outro(color.green(` ${deletedCount} Session berhasil dihapus dari database! `));
 await new Promise(resolve => setTimeout(resolve, 1500));
 }
 }
 
 else if (action === 'export') {
 const sid = await p.autocomplete({
 message: 'Pilih session yang ingin diexport:',
 options: sessionOptions
 });
 
 if (p.isCancel(sid)) continue;
 const sObj = sessionsList.find(s => s.id === sid);
 
 let events = [];
 try {
 const out = execSync(`sqlite3 "${sObj.dbPath}" "select type, data from session_events where session_id = '${sid}' order by id asc" 2>/dev/null`, { encoding: 'utf8' }).trim();
 if (out) {
 events = out.split('\n').map(line => {
 const separatorIdx = line.indexOf('|');
 const type = line.slice(0, separatorIdx);
 const dataStr = line.slice(separatorIdx + 1);
 try {
 return { type, data: JSON.parse(dataStr) };
 } catch (e) {
 return { type, data: dataStr };
 }
 });
 } else {
 p.cancel(color.red(`Session "${sid}" tidak ditemukan atau kosong di SQLite.`));
 continue;
 }
 } catch (e) {
 p.cancel(color.red(`Gagal membaca detail events: ${e.message}`));
 continue;
 }
 
 let transcriptMd = `# OpenCode Transcript: ${sid}\n\n`;
 let countMessages = 0;
 events.forEach(e => {
 if (e.type === 'Prompted' || e.type === 'session.prompt' || e.type === 'user_prompt') {
 const userMsg = typeof e.data === 'string' ? e.data : (e.data.prompt || e.data.text || '');
 transcriptMd += `### User:\n${userMsg}\n\n`;
 countMessages++;
 } else if (e.type === 'AssistantMessage' || e.type === 'session.assistant' || e.type === 'decision' || e.type === 'data' || e.type === 'intent') {
 const assistantMsg = typeof e.data === 'string' ? e.data : (e.data.text || e.data.content || '');
 transcriptMd += `### Assistant (${e.type}):\n${assistantMsg}\n\n`;
 countMessages++;
 }
 });
 
 if (countMessages === 0) {
 transcriptMd += `*Transcript empty, raw events dump:*\n\n`;
 events.forEach((e, idx) => {
 transcriptMd += `**Event #${idx + 1} (${e.type})**:\n\`\`\`json\n${JSON.stringify(e.data, null, 2)}\n\`\`\`\n\n`;
 });
 }
 
  const exportDir = `${process.env.HOME}/exports`;
 if (!fs.existsSync(exportDir)) {
 fs.mkdirSync(exportDir, { recursive: true });
 }
 
 const exportPath = path.join(exportDir, `transcript_${sid}.md`);
 try {
 fs.writeFileSync(exportPath, transcriptMd, 'utf8');
 p.outro(color.green(` Session berhasil diexport ke: ${exportPath} `));
 } catch (e) {
 p.cancel(color.red(`Gagal menulis file export: ${e.message}`));
 }
 
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 }
}

module.exports = { run, getAllSessions };
