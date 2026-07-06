const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const spawn = require('child_process').spawn;
const path = require('path');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');
const { getAllSessions } = require('./session');
const { runWithSpinner } = require('../ui/spinner');

async function runNonTui(activeRoot) {
 // Ask for prompt message
 const promptMessage = await p.text({
 message: 'Masukkan pesan/prompt untuk dijalankan oleh OpenCode:',
 validate(val) {
 if (!val.trim()) return 'Pesan tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(promptMessage)) return;
 
 // Get active default agent
 let defaultAgent = 'assistant';
 const configPath = utils.paths.config;
 try {
 if (fs.existsSync(configPath)) {
 const cleanJson = utils.stripComments(fs.readFileSync(configPath, 'utf8'));
 const config = JSON.parse(cleanJson);
 defaultAgent = config.default_agent || 'assistant';
 }
 } catch (e) {}
 
 console.log(color.cyan(`\n Menjalankan OpenCode agent "${defaultAgent}"...`));
 
 const runCwd = activeRoot === 'global_agent' || activeRoot === 'global_system' ? process.cwd() : activeRoot;
 
 const child = spawn('opencode', ['-a', defaultAgent, promptMessage], {
 cwd: runCwd,
 stdio: 'inherit',
 env: process.env
 });
 
 await new Promise((resolve) => {
 child.on('close', (code) => {
 console.log(color.cyan(`\n Selesai dengan exit code: ${code}`));
 resolve();
 });
 child.on('error', (err) => {
 console.log(color.red(`\nGagal menjalankan opencode: ${err.message}`));
 resolve();
 });
 });
}

async function runTui(activeRoot) {
 const sessionsList = await runWithSpinner(() => getAllSessions());
 
 // Extract unique workspaces
 const workspaces = new Set();
 const runCwd = activeRoot === 'global_agent' || activeRoot === 'global_system' ? process.cwd() : activeRoot;
 workspaces.add(runCwd);
 
 // Auto-detect projects with .opencode directories
 try {
   const detectedProjects = utils.findOpenCodeProjects();
   detectedProjects.forEach(p => workspaces.add(p.path));
 } catch (e) {}
 
 sessionsList.forEach(s => workspaces.add(s.projectDir));
 
  const workspaceOptionsRaw = Array.from(workspaces).map(ws => {
    const home = process.env.HOME || '/root';
    const displayPath = ws.startsWith(home) ? '~' + ws.slice(home.length) : ws;
    return {
      value: ws,
      displayPath,
      isActive: ws === runCwd
    };
  });
  
  workspaceOptionsRaw.sort((a, b) => a.displayPath.length - b.displayPath.length);
  
  const workspaceOptions = [
    { value: 'add_workspace', label: color.green('✨ Add New Workspace') },
    ...workspaceOptionsRaw.map(opt => ({
      value: opt.value,
      label: opt.isActive ? `${opt.displayPath} (Active)` : opt.displayPath
    }))
  ];
 
  let selectedWs = await p.autocomplete({
    message: 'Pilih Project / Workspace:',
    options: workspaceOptions
  });
 
  if (p.isCancel(selectedWs)) return;
  
  if (selectedWs === 'add_workspace') {
    const resolvedPath = await utils.createNewWorkspace();
    if (resolvedPath) {
      selectedWs = resolvedPath;
    } else {
      return;
    }
  }
 
 // Filter sessions for selected workspace
 const wsSessions = sessionsList.filter(s => s.projectDir === selectedWs);
 const sessionOptions = [
 { value: 'new', label: color.green('✨ Buat Session Baru') }
 ];
 
 wsSessions.forEach(s => {
 const shortName = s.name.slice(0, 50).padEnd(50);
 sessionOptions.push({
 value: s.id,
 label: `${s.id.slice(0, 10)}... | ${shortName}`
 });
 });
 
 const selectedSid = await p.autocomplete({
 message: 'Pilih Session:',
 options: sessionOptions
 });
 
 if (p.isCancel(selectedSid)) return;
 
 console.clear();
 console.log(color.cyan(`\n Membuka OpenCode TUI untuk workspace: ${path.basename(selectedWs)}`));
 
 try {
 if (selectedSid === 'new') {
 spawnSync('opencode', [], { cwd: selectedWs, stdio: 'inherit' });
 } else {
 spawnSync('opencode', ['-s', selectedSid], { cwd: selectedWs, stdio: 'inherit' });
 }
 } catch (e) {
 console.log(color.red(`\nGagal menjalankan opencode: ${e.message}`));
 }
}

async function run() {
 const activeRoot = utils.getActiveProjectRoot();
 
 const mode = await p.select({
 message: 'Pilih Mode Run:',
 options: [
 { value: 'tui', label: ' Run TUI (Interaktif - Buka UI OpenCode)' },
 { value: 'non_tui', label: ' Run Non-TUI (Prompt Langsung)' },
 { value: 'back', label: ' Kembali' }
 ]
 });
 
 if (p.isCancel(mode) || mode === 'back') {
 return 'main_menu';
 }
 
 if (mode === 'tui') {
 await runTui(activeRoot);
 } else if (mode === 'non_tui') {
 await runNonTui(activeRoot);
 }
 
 await p.select({
 message: 'Kembali ke Menu Utama?',
 options: [{ value: 'back', label: 'Kembali' }]
 });
 
 return 'main_menu';
}

module.exports = { run };
