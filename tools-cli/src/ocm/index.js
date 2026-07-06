const fs = require('fs');
const path = require('path');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('./utils');
const agentCmd = require('./commands/agent');
const refCmd = require('./commands/reference');
const doctorCmd = require('./commands/doctor');
const { runInteractiveLoop } = require('./ui/menu');

function parseArgs(args) {
  const options = {
    help: false,
    subcommand: null,
    action: null,
    project: null,
    agent: null,
    field: null,
    value: null,
    provider: null,
    status: null,
    modelId: null,
    alias: null,
    newId: null,
    newAlias: null,
    newStatus: null,
    // Shortcut CLI Options
    add: null,
    createAll: false,
    createAgents: false,
    createCommands: false,
    createConfig: false,
    deleteSession: null,
    yes: false,
    limit: null,
    all: false
  };

  let startIdx = 0;
  const validSubcommands = [
    'run', 'agent', 'session', 'settings', 'mcp',
    'providers', 'models', 'reference', 'doctor', 'switch'
  ];
  
  // Parse positional subcommands first
  if (args.length > 0 && !args[0].startsWith('-') && validSubcommands.includes(args[0].toLowerCase())) {
    options.subcommand = args[0].toLowerCase();
    startIdx = 1;
    
    // Parse actions or show/list commands
    if (args.length > 1 && !args[1].startsWith('-')) {
      options.action = args[1].toLowerCase();
      startIdx = 2;
      
      // Handle positional session delete <id>
      if (options.subcommand === 'session' && options.action === 'delete' && args.length > 2 && !args[2].startsWith('-')) {
        options.deleteSession = args[2];
        startIdx = 3;
      }
      
      // Handle positional mcp toggle <name>
      if (options.subcommand === 'mcp' && options.action === 'toggle' && args.length > 2 && !args[2].startsWith('-')) {
        options.value = args[2];
        startIdx = 3;
      }
    }
  }

  for (let i = startIdx; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--doctor' || arg === '-d') {
      options.subcommand = 'doctor';
    } else if (arg === '--manage' || arg === '-m') {
      options.subcommand = 'manage';
    } else if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--project' || arg === '-p') {
      options.project = args[++i];
    } else if (arg === '--agent' || arg === '-a') {
      options.agent = args[++i];
    } else if (arg === '--field' || arg === '-f') {
      options.field = args[++i];
    } else if (arg === '--value' || arg === '-v') {
      options.value = args[++i];
    } else if (arg === '--action') {
      options.action = args[++i];
    } else if (arg === '--provider') {
      options.provider = args[++i];
    } else if (arg === '--status') {
      options.status = args[++i];
    } else if (arg === '--model-id') {
      options.modelId = args[++i];
    } else if (arg === '--alias') {
      options.alias = args[++i];
    } else if (arg === '--new-id') {
      options.newId = args[++i];
    } else if (arg === '--new-alias') {
      options.newAlias = args[++i];
    } else if (arg === '--new-status') {
      options.newStatus = args[++i];
    } else if (arg === '--add') {
      options.add = args[++i];
    } else if (arg === '--create-all') {
      options.createAll = true;
    } else if (arg === '--agents') {
      options.createAgents = true;
    } else if (arg === '--commands') {
      options.createCommands = true;
    } else if (arg === '--config') {
      options.createConfig = true;
    } else if (arg === '-d' || arg === '--delete') {
      options.deleteSession = args[++i];
    } else if (arg === '-y' || arg === '--yes') {
      options.yes = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--limit') {
      options.limit = parseInt(args[++i], 10);
    }
  }

  return options;
}

function showHelp(subcommand, action) {
  if (!subcommand) {
    console.log(`
${color.cyan(color.bold('OpenCode Configurator (ocm)'))} - Kelola konfig dan referensi model.

${color.yellow('Penggunaan:')}
  ocm                     Buka Dashboard TUI Interaktif (default)
  ocm <command> [options] Jalankan perintah non-interaktif atau buka sub-menu TUI

${color.yellow('Daftar Perintah (Level 2 Help: ocm <command> --help):')}
  run                     Jalankan agent OpenCode (bisa TUI / Non-TUI / Add Workspace)
  agent                   Konfigurasi field agent (model, steps, prompt, mode)
  session                 Manajemen database session (list, export, delete)
  settings                Konfigurasi toggles sistem (MCP, Compaction, Plugins)
  mcp                     Kelola server MCP (toggle, add, dll)
  providers               Kelola API Key & Kredensial AI Provider
  models                  Tampilkan perbandingan & daftar model AI
  reference               Kelola references model (models-free.md)
  doctor                  Jalankan diagnosa & auto-fix kesalahan konfig
  switch                  Ganti workspace project aktif

${color.dim('Global Flags:')}
  -p, --project <path>    Set workspace project aktif (default: CWD)
  -h, --help              Tampilkan bantuan ini
`);
    return;
  }

  if (subcommand === 'run') {
    console.log(`
${color.cyan(color.bold('ocm run'))} - Jalankan agent OpenCode.

${color.yellow('Penggunaan:')}
  ocm run                 Membuka TUI Run Manager untuk memilih workspace/session
  ocm run --add <path> [options]  Buat workspace baru (.opencode) instan via CLI

${color.yellow('Opsi Pembuatan Workspace (--add):')}
  --create-all            Buat agents/, commands/, & opencode.jsonc
  --agents                Buat folder agents/ saja
  --commands              Buat folder commands/ saja
  --config                Buat file opencode.jsonc saja
`);
    return;
  }

  if (subcommand === 'session') {
    if (action === 'delete') {
      console.log(`
${color.cyan(color.bold('ocm session delete'))} - Hapus session secara cepat via CLI.

${color.yellow('Penggunaan:')}
  ocm session delete <session_id> [options]
  ocm session -d <session_id> [options]

${color.yellow('Opsi Flags:')}
  -y, --yes               Langsung hapus tanpa konfirmasi
`);
      return;
    }
    
    if (action === 'show' || action === 'list') {
      console.log(`
${color.cyan(color.bold('ocm session show'))} - Tampilkan daftar session aktif di terminal.

${color.yellow('Penggunaan:')}
  ocm session show [options]

${color.yellow('Opsi Flags:')}
  --all                   Tampilkan seluruh session tanpa batas
  --limit <number>        Batasi jumlah session yang tampil (default: 10)
`);
      return;
    }

    console.log(`
${color.cyan(color.bold('ocm session'))} - Manajemen database session.

${color.yellow('Penggunaan:')}
  ocm session             Membuka TUI Session Manager (list, export, delete massal)
  ocm session show        Tampilkan list session di terminal secara instan
  ocm session delete <id> Hapus session tertentu via CLI
  
${color.yellow('Jalankan bantuan sub-command:')}
  ocm session show --help
  ocm session delete --help
`);
    return;
  }

  if (subcommand === 'settings') {
    console.log(`
${color.cyan(color.bold('ocm settings'))} - Konfigurasi toggles sistem.

${color.yellow('Penggunaan:')}
  ocm settings            Membuka TUI Config System (MCP, Compaction, Plugins)
  ocm settings show       Tampilkan setting config yang aktif secara instan di terminal
`);
    return;
  }

  if (subcommand === 'mcp') {
    if (action === 'toggle') {
      console.log(`
${color.cyan(color.bold('ocm mcp toggle'))} - Toggle status aktif/nonaktif server MCP.

${color.yellow('Penggunaan:')}
  ocm mcp toggle <server_name>
`);
      return;
    }

    console.log(`
${color.cyan(color.bold('ocm mcp'))} - Kelola server MCP.

${color.yellow('Penggunaan:')}
  ocm mcp                 Membuka TUI MCP Manager (toggle enable/disable, add server)
  ocm mcp show            Tampilkan daftar server MCP & status ke terminal
  ocm mcp toggle <name>   Aktifkan/nonaktifkan server MCP tertentu secara instan
  
${color.yellow('Jalankan bantuan sub-command:')}
  ocm mcp toggle --help
`);
    return;
  }

  if (subcommand === 'providers') {
    console.log(`
${color.cyan(color.bold('ocm providers'))} - Kelola API Key & Kredensial Provider.

${color.yellow('Penggunaan:')}
  ocm providers           Membuka TUI Provider Credentials Manager
`);
    return;
  }

  if (subcommand === 'models') {
    console.log(`
${color.cyan(color.bold('ocm models'))} - Tampilkan daftar & perbandingan model AI.

${color.yellow('Penggunaan:')}
  ocm models              Membuka TUI Model Browser
`);
    return;
  }

  if (subcommand === 'reference') {
    console.log(`
${color.cyan(color.bold('ocm reference'))} - Kelola references model (models-free.md).

${color.yellow('Penggunaan:')}
  ocm reference           Membuka TUI Reference Models Editor
`);
    return;
  }

  if (subcommand === 'switch') {
    console.log(`
${color.cyan(color.bold('ocm switch'))} - Ganti workspace project aktif.

${color.yellow('Penggunaan:')}
  ocm switch              Membuka TUI Workspace Switcher (atau add workspace baru)
`);
    return;
  }

  if (subcommand === 'agent') {
    console.log(`
${color.cyan(color.bold('ocm agent'))} - Konfigurasi setting agent secara instan.

${color.yellow('Penggunaan:')}
  ocm agent               Membuka TUI Agent Config (jika dipanggil tanpa opsi tambahan)
  ocm agent [-p <project>] -a <agent> -f <field> -v <value> (Non-interaktif)

${color.yellow('Opsi Flags (Non-interaktif):')}
  -a, --agent <name>      Nama agent (e.g. assistant, coder, doctor)
  -f, --field <name>      Nama field (model, steps, prompt, mode)
  -v, --value <value>     Nilai baru untuk di-update
`);
    return;
  }

  if (subcommand === 'doctor') {
    console.log(`
${color.cyan(color.bold('ocm doctor'))} - Diagnosa dan auto-fix isu file config.

${color.yellow('Penggunaan:')}
  ocm doctor              Jalankan diagnosa interaktif (default)
  ocm doctor [--fix]      Jalankan diagnosa & auto-fix secara non-interaktif

${color.yellow('Opsi Flags:')}
  --fix                   Jalankan perbaikan otomatis jika ada masalah
`);
    return;
  }

  if (subcommand === 'manage') {
    if (!action) {
      console.log(`
${color.cyan(color.bold('ocm manage'))} - Kelola data referensi model (models-free.md).

${color.yellow('Penggunaan:')}
  ocm manage <action> [options]

${color.yellow('Daftar Action (Level 3 Help: ocm manage <action> --help):')}
  add                     Tambah model baru ke kategori referensi
  edit                    Edit model yang sudah ada
  delete                  Hapus model dari daftar referensi
`);
      return;
    }

    if (action === 'add') {
      console.log(`
${color.cyan(color.bold('ocm manage add'))} - Tambah model baru ke referensi.

${color.yellow('Penggunaan:')}
  ocm manage add --provider <name> --status <status> --model-id <id> --alias <alias>

${color.yellow('Wajib diisi:')}
  --provider <name>       Kategori provider model (e.g. OpenRouter)
  --status <Stabil|Error> Status model saat ini
  --model-id <id>         Model ID lengkap (e.g. google/gemini-2)
  --alias <alias>         Nama display alias model
`);
    } else if (action === 'edit') {
      console.log(`
${color.cyan(color.bold('ocm manage edit'))} - Edit model referensi yang sudah ada.

${color.yellow('Penggunaan:')}
  ocm manage edit --provider <name> --model-id <id> [modifikasi]

${color.yellow('Kriteria Pencarian (Wajib):')}
  --provider <name>       Nama provider model
  --model-id <id>         Model ID yang ingin diedit

${color.yellow('Modifikasi (Minimal Isi Salah Satu):')}
  --new-id <id>           Ubah ID model menjadi baru
  --new-alias <alias>     Ubah display alias model
  --new-status <status>   Ubah status model (Stabil/Error)
`);
    } else if (action === 'delete') {
      console.log(`
${color.cyan(color.bold('ocm manage delete'))} - Hapus model dari daftar referensi.

${color.yellow('Penggunaan:')}
  ocm manage delete --provider <name> --model-id <id>

${color.yellow('Wajib diisi:')}
  --provider <name>       Nama provider model
  --model-id <id>         Model ID yang ingin dihapus
`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  
  if (options.help) {
    showHelp(options.subcommand, options.action);
    process.exit(0);
  }
  
  let defaultProject = 'global_agent';
  const cwd = process.cwd();
  const cwdSub1 = path.join(cwd, '.opencode');
  const cwdSub2 = path.join(cwd, 'opencode');
  if (fs.existsSync(path.join(cwdSub1, 'opencode.jsonc'))) {
    defaultProject = cwd;
  } else if (fs.existsSync(path.join(cwdSub2, 'opencode.jsonc'))) {
    defaultProject = cwd;
  }
  
  const activeProject = options.project || defaultProject;
  utils.setProjectPaths(activeProject);

  // CLI SHORTCUT: ocm run --add <path>
  if (options.subcommand === 'run' && options.add) {
    let resolvedPath = options.add.trim();
    if (resolvedPath.startsWith('~')) {
      resolvedPath = path.join(process.env.HOME, resolvedPath.slice(1));
    }
    resolvedPath = path.resolve(resolvedPath);
    
    const opencodeDir = path.join(resolvedPath, '.opencode');
    try {
      fs.mkdirSync(opencodeDir, { recursive: true });
      
      const createAll = options.createAll;
      const createAgents = createAll || options.createAgents;
      const createCommands = createAll || options.createCommands;
      const createConfig = createAll || options.createConfig;
      
      if (createAgents) {
        fs.mkdirSync(path.join(opencodeDir, 'agents'), { recursive: true });
      }
      if (createCommands) {
        fs.mkdirSync(path.join(opencodeDir, 'commands'), { recursive: true });
      }
      if (createConfig) {
        fs.writeFileSync(path.join(opencodeDir, 'opencode.jsonc'), '{\n  "agents": {}\n}', 'utf8');
      }
      
      console.log(color.green(`Workspace baru berhasil dibuat di: ${resolvedPath}`));
      process.exit(0);
    } catch (err) {
      console.error(color.red(`Gagal membuat workspace: ${err.message}`));
      process.exit(1);
    }
  }

  // CLI SHORTCUT: ocm session show
  if (options.subcommand === 'session' && (options.action === 'show' || options.action === 'list')) {
    const { getAllSessions } = require('./commands/session');
    const runShow = async () => {
      // Quietly fetch sessions
      const sessions = await getAllSessions();
      if (sessions.length === 0) {
        console.log('Tidak ada session terdaftar.');
        process.exit(0);
      }
      
      const limit = options.all ? sessions.length : (options.limit || 10);
      const toShow = sessions.slice(0, limit);
      
      console.log(`\n${color.cyan(color.bold('DAFTAR SESSION OPENCODE:'))}`);
      console.log('─'.repeat(80));
      toShow.forEach(s => {
        const shortId = s.id.slice(0, 12) + '...';
        const displayPrompt = s.name.slice(0, 45).padEnd(45);
        console.log(`${color.yellow(shortId)} | ${displayPrompt} | ${color.dim(path.basename(s.projectDir))}`);
      });
      console.log('─'.repeat(80));
      if (sessions.length > limit) {
        console.log(color.dim(`...dan ${sessions.length - limit} session lainnya. Gunakan --all untuk menampilkan semua.`));
      }
      process.exit(0);
    };
    runShow();
    return;
  }

  // CLI SHORTCUT: ocm session delete <id>
  if (options.subcommand === 'session' && (options.action === 'delete' || options.deleteSession)) {
    const sid = options.deleteSession;
    if (!sid) {
      console.error(color.red('Error: Masukkan Session ID yang ingin dihapus.'));
      process.exit(1);
    }
    
    const { getAllSessions } = require('./commands/session');
    const runDelete = async () => {
      const sessions = await getAllSessions(); 
      const sObj = sessions.find(s => s.id === sid || s.id.startsWith(sid));
      if (!sObj) {
        console.error(color.red(`Error: Session "${sid}" tidak ditemukan.`));
        process.exit(1);
      }
      
      const proceed = options.yes;
      if (!proceed) {
        const { confirm } = require('@clack/prompts');
        const confirmDel = await confirm({
          message: `Apakah Anda yakin ingin menghapus session "${sObj.id}"?`,
        });
        if (p.isCancel(confirmDel) || !confirmDel) {
          console.log('Dibatalkan.');
          process.exit(0);
        }
      }
      
      try {
        const { execSync } = require('child_process');
        execSync(`sqlite3 "${sObj.dbPath}" "delete from session_meta where session_id = '${sObj.id}'; delete from session_events where session_id = '${sObj.id}'; delete from session_resume where session_id = '${sObj.id}'; delete from tool_calls where session_id = '${sObj.id}';" 2>/dev/null`);
        console.log(color.green(`Session "${sObj.id}" berhasil dihapus.`));
        process.exit(0);
      } catch (err) {
        console.error(color.red(`Gagal menghapus: ${err.message}`));
        process.exit(1);
      }
    };
    
    runDelete();
    return;
  }

  // CLI SHORTCUT: ocm settings show
  if (options.subcommand === 'settings' && (options.action === 'show' || options.action === 'list')) {
    const fs = require('fs');
    const configPath = utils.paths.config;
    if (!fs.existsSync(configPath)) {
      console.log('File config tidak ditemukan.');
      process.exit(1);
    }
    try {
      const config = JSON.parse(utils.stripComments(fs.readFileSync(configPath, 'utf8')));
      console.log(`\n${color.cyan(color.bold('CONFIG SYSTEM SETTINGS:'))}`);
      console.log('─'.repeat(50));
      const excludeKeys = ['agents', 'agent', 'mcp', 'providers'];
      Object.keys(config).forEach(key => {
        if (!excludeKeys.includes(key)) {
          console.log(`${color.bold(key)}: ${color.yellow(JSON.stringify(config[key]))}`);
        }
      });
      if (config.mcp) {
        console.log(`\n${color.bold('MCP Servers Status:')}`);
        Object.keys(config.mcp).forEach(server => {
          const s = config.mcp[server];
          if (s && typeof s === 'object') {
            const status = s.disabled === true ? color.red('Nonaktif') : color.green('Aktif');
            console.log(`  ${server}: ${status}`);
          }
        });
      }
      console.log('─'.repeat(50));
      process.exit(0);
    } catch (e) {
      console.error(color.red(`Gagal membaca config: ${e.message}`));
      process.exit(1);
    }
  }

  // CLI SHORTCUT: ocm mcp show
  if (options.subcommand === 'mcp' && (options.action === 'show' || options.action === 'list')) {
    const fs = require('fs');
    utils.setProjectPaths('global_system');
    const configPath = utils.paths.config;
    if (!fs.existsSync(configPath)) {
      console.log('File global system config tidak ditemukan.');
      process.exit(1);
    }
    try {
      const config = JSON.parse(utils.stripComments(fs.readFileSync(configPath, 'utf8')));
      const mcpBlock = config.mcp || {};
      const serverNames = Object.keys(mcpBlock).filter(k => typeof mcpBlock[k] === 'object' && mcpBlock[k] !== null);
      if (serverNames.length === 0) {
        console.log('Belum ada MCP server yang dikonfigurasi.');
        process.exit(0);
      }
      console.log(`\n${color.cyan(color.bold('DAFTAR MCP SERVERS:'))}`);
      console.log('─'.repeat(50));
      serverNames.forEach(name => {
        const s = mcpBlock[name];
        const status = s.disabled === true ? color.red('[NONAKTIF]') : color.green('[AKTIF]');
        console.log(`${status} ${color.bold(name)}`);
        console.log(`  Command: ${s.command || 'N/A'}`);
        console.log(`  Args: ${JSON.stringify(s.args || [])}`);
        console.log('');
      });
      process.exit(0);
    } catch (e) {
      console.error(color.red(`Gagal membaca config: ${e.message}`));
      process.exit(1);
    }
  }

  // CLI SHORTCUT: ocm mcp toggle <name>
  if (options.subcommand === 'mcp' && options.action === 'toggle') {
    const serverName = options.value;
    if (!serverName) {
      console.error(color.red('Error: Masukkan nama MCP server yang ingin di-toggle.'));
      process.exit(1);
    }
    const fs = require('fs');
    utils.setProjectPaths('global_system');
    const configPath = utils.paths.config;
    if (!fs.existsSync(configPath)) {
      console.error(color.red('Error: File global system config tidak ditemukan.'));
      process.exit(1);
    }
    try {
      let content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(utils.stripComments(content));
      const mcpBlock = config.mcp || {};
      if (!mcpBlock[serverName]) {
        console.error(color.red(`Error: MCP server "${serverName}" tidak ditemukan.`));
        process.exit(1);
      }
      const isCurrentlyDisabled = mcpBlock[serverName].disabled === true;
      const newDisabledVal = !isCurrentlyDisabled;
      
      content = utils.ensureNestedBlock(content, ['mcp', serverName]);
      content = utils.updateNestedField(content, ['mcp', serverName], 'disabled', String(newDisabledVal));
      fs.writeFileSync(configPath, content, 'utf8');
      console.log(color.green(`Server "${serverName}" berhasil di-toggle menjadi ${newDisabledVal ? 'Nonaktif' : 'Aktif'}!`));
      process.exit(0);
    } catch (e) {
      console.error(color.red(`Gagal menulis config: ${e.message}`));
      process.exit(1);
    }
  }
  
  if (options.subcommand === 'doctor') {
    await doctorCmd.run({ fix: options.fix });
    process.exit(0);
  }
  
  if (options.subcommand === 'agent' || options.agent || options.field || options.value) {
    if (!options.agent || !options.field || !options.value) {
      console.error(color.red('Error: Field --agent (-a), --field (-f), dan --value (-v) harus diisi lengkap.'));
      console.error(color.yellow('Jalankan "ocm agent --help" untuk melihat panduan penggunaan.'));
      process.exit(1);
    }
    const isNumber = options.field === 'steps';
    let val = options.value;
    if (isNumber) {
      val = Number(val);
      if (isNaN(val) || val <= 0) {
        console.error(color.red('Error: --value untuk steps harus berupa angka positif.'));
        process.exit(1);
      }
    }
    try {
      const originalContent = fs.readFileSync(utils.paths.config, 'utf8');
      const newContent = utils.updateAgentField(originalContent, options.agent, options.field, val, isNumber);
      fs.writeFileSync(utils.paths.config, newContent, 'utf8');
      console.log(color.green(` Sukses! Agent "${options.agent}" field "${options.field}" telah diubah ke: ${val}`));
      process.exit(0);
    } catch (err) {
      console.error(color.red(`Error: ${err.message}`));
      process.exit(1);
    }
  }
  
  if (options.subcommand === 'manage' || (options.manage && options.action)) {
    const action = options.action ? options.action.toLowerCase() : null;
    if (!action) {
      console.error(color.red('Error: Perintah manage membutuhkan action (add, edit, delete).'));
      console.error(color.yellow('Jalankan "ocm manage --help" untuk info lebih lanjut.'));
      process.exit(1);
    }
 
    if (action === 'add') {
      const { provider, status, modelId, alias } = options;
      if (!provider || !status || !modelId || !alias) {
        console.error(color.red('Error: Mode add membutuhkan --provider, --status, --model-id, dan --alias.'));
        process.exit(1);
      }
      try {
        const parsedLines = utils.parseModelsFile();
        utils.insertModel(parsedLines, provider, status, modelId, alias);
        utils.saveModelsFile(parsedLines);
        console.log(color.green(` Sukses menambahkan model "${alias}" ke referensi!`));
        process.exit(0);
      } catch (err) {
        console.error(color.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
 
    else if (action === 'edit') {
      const { provider, modelId, newId, newAlias, newStatus } = options;
      if (!provider || !modelId) {
        console.error(color.red('Error: Mode edit membutuhkan --provider dan --model-id.'));
        process.exit(1);
      }
      if (!newId && !newAlias && !newStatus) {
        console.error(color.red('Error: Tidak ada perubahan yang diberikan. Gunakan --new-id, --new-alias, atau --new-status.'));
        process.exit(1);
      }
      try {
        const parsedLines = utils.parseModelsFile();
        const line = parsedLines.find(l => l.type === 'model' && l.provider === provider && l.modelId === modelId);
        if (!line) {
          console.error(color.red(`Error: Model "${modelId}" tidak ditemukan untuk provider "${provider}".`));
          process.exit(1);
        }
        
        if (newId) line.modelId = newId;
        if (newAlias) line.alias = newAlias;
        line.text = `${line.modelId} # ${line.alias || ''}`;
        
        if (newStatus && line.status !== newStatus) {
          const idx = parsedLines.indexOf(line);
          parsedLines.splice(idx, 1);
          utils.insertModel(parsedLines, provider, newStatus, line.modelId, line.alias);
        }
        
        utils.saveModelsFile(parsedLines);
        console.log(color.green(` Sukses mengupdate model "${modelId}"!`));
        process.exit(0);
      } catch (err) {
        console.error(color.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
 
    else if (action === 'delete') {
      const { provider, modelId } = options;
      if (!provider || !modelId) {
        console.error(color.red('Error: Mode delete membutuhkan --provider dan --model-id.'));
        process.exit(1);
      }
      try {
        const parsedLines = utils.parseModelsFile();
        const line = parsedLines.find(l => l.type === 'model' && l.provider === provider && l.modelId === modelId);
        if (!line) {
          console.error(color.red(`Error: Model "${modelId}" tidak ditemukan.`));
          process.exit(1);
        }
        const idx = parsedLines.indexOf(line);
        parsedLines.splice(idx, 1);
        utils.saveModelsFile(parsedLines);
        console.log(color.green(` Sukses menghapus model "${modelId}" dari referensi!`));
        process.exit(0);
      } catch (err) {
        console.error(color.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }
 
    else {
      console.error(color.red(`Error: Aksi "${action}" tidak dikenali.`));
      process.exit(1);
    }
  }
 
  const tuiSubcommands = [
    'run', 'agent', 'session', 'settings', 'mcp',
    'providers', 'models', 'reference', 'switch'
  ];
  if (options.subcommand && tuiSubcommands.includes(options.subcommand)) {
    await runInteractiveLoop(options.subcommand);
    process.exit(0);
  }

  await runInteractiveLoop();
}

main().catch(err => {
 console.error(err);
 process.exit(1);
});
