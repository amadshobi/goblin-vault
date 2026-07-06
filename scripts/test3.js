const utils = require('./tui_src/utils.js');
utils.setProjectPaths(process.env.HOME);
const dashboard = require('./tui_src/ui/dashboard.js');
console.log(dashboard.getDashboardLines().join('\n'));
