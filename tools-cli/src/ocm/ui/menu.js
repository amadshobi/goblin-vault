const p = require('@clack/prompts');
const color = require('picocolors');
const path = require('path');
const fs = require('fs');

const utils = require('../utils');
const common = require('./common');


// Import commands
const agentCmd = require('../commands/agent');
const refCmd = require('../commands/reference');
const settingsCmd = require('../commands/settings');
const doctorCmd = require('../commands/doctor');
const sessionCmd = require('../commands/session');
const runCmd = require('../commands/run');
const providersCmd = require('../commands/providers');
const modelsCmd = require('../commands/models');
const mcpCmd = require('../commands/mcp');

async function runInteractiveLoop(startAction = null) {
  process.stdout.write('\x1b[H\x1b[2J');
  p.intro(color.cyan(' OpenCode Config Manager'));
  
  // Resolve default project
  let defaultProject = 'global_agent';
  const cwd = process.cwd();
  const cwdSub1 = path.join(cwd, '.opencode');
  const cwdSub2 = path.join(cwd, 'opencode');
  if (fs.existsSync(path.join(cwdSub1, 'opencode.jsonc'))) {
    defaultProject = cwd;
  } else if (fs.existsSync(path.join(cwdSub2, 'opencode.jsonc'))) {
    defaultProject = cwd;
  }
  
  // Initial active workspace setup
  utils.setProjectPaths(defaultProject);
  
  let action = startAction;
  
  while (true) {
    if (!action) {
      action = await p.autocomplete({
        message: 'Pilih Aksi (Ketik untuk mencari):',
        options: [
          { value: 'run', label: 'Run', hint: 'Execute opencode langsung dengan prompt' },
          { value: 'agent', label: 'Configure Agent', hint: 'model, steps, prompt, mode' },
          { value: 'session', label: 'Session Management', hint: 'list, export, delete' },
          { value: 'settings', label: 'System Toggles', hint: 'MCP, Compaction, Plugins' },
          { value: 'mcp', label: 'MCP Server Management', hint: 'toggle, add servers' },
          { value: 'providers', label: 'Provider & API Key Management', hint: 'Manage credentials' },
          { value: 'models', label: 'Model Browser & Comparison', hint: 'Browse and compare models' },
          { value: 'reference', label: 'Reference Models Manager', hint: 'models-free.md' },
          { value: 'doctor', label: 'Doctor', hint: 'Diagnostics & Auto-Fix' },
          { value: 'switch', label: 'Switch Project / Workspace', hint: 'Ganti active workspace' },
          { value: 'exit', label: 'Exit', hint: 'Keluar dari aplikasi' }
        ]
      });
    }
 
    if (p.isCancel(action) || action === 'exit') {
      p.cancel('done');
      process.exit(0);
    }
 
    // 3. Switch Workspace
    if (action === 'switch') {
      const projects = utils.findOpenCodeProjects();
      const workspaceOptions = [
        { value: 'add_workspace', label: color.green(' Add New Workspace') },
        { value: 'global_system', label: ' Global Config (~/.config/opencode)' },
        { value: 'global_agent', label: ' Global Agent (~/.opencode)' }
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
      });
      
      if (p.isCancel(newWorkspace)) {
        process.stdout.write('\x1b[H\x1b[2J');
        p.intro(color.cyan(' OpenCode Configurator '));
        action = null;
        continue;
      }
      
      if (newWorkspace === 'add_workspace') {
        const resolvedPath = await utils.createNewWorkspace();
        if (resolvedPath) {
          utils.setProjectPaths(resolvedPath);
        }
      } else {
        utils.setProjectPaths(newWorkspace);
      }
     
      process.stdout.write('\x1b[H\x1b[2J');
      p.intro(color.cyan(' OpenCode Config Manager '));
      action = null;
      continue;
    }
 
 // 4. Command Execution Dispatcher
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
 } catch (err) {
 p.cancel(color.red(`Terjadi kesalahan saat menjalankan perintah: ${err.message}`));
 }
 
 process.stdout.write('\x1b[H\x1b[2J');
 p.intro(color.cyan(' OpenCode Config Manager'));
 action = null;
 }
}

module.exports = { runInteractiveLoop };
