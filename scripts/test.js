const utils = require('./tui_src/utils.js');
console.log(utils.getWorkspaceDbPath(process.env.HOME + '/.opencode'));
console.log(utils.getWorkspaceDbPath('global_agent'));
