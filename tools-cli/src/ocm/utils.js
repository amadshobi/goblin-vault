const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;
const p = require('@clack/prompts');
const color = require('picocolors');

const paths = {
 config: path.join(__dirname, '../../opencode.jsonc'),
 models: path.join(__dirname, '../../reference/models-free.md'),
 agents: path.join(__dirname, '../../agents')
};

let activeProjectRoot = 'global_agent';

// Set active paths based on selected project
function setProjectPaths(projectPath) {
 activeProjectRoot = projectPath;
 paths.models = path.join(__dirname, '../../reference/models-free.md');
 
 if (projectPath === 'global_agent') {
 paths.config = path.join(__dirname, '../../opencode.jsonc');
 paths.agents = path.join(__dirname, '../../agents');
 } else if (projectPath === 'global_system') {
 paths.config = `${process.env.HOME}/.config/opencode/opencode.jsonc`;
 paths.agents = `${process.env.HOME}/.config/opencode/agents`;
 } else if (projectPath === 'global') {
 paths.config = path.join(__dirname, '../../opencode.jsonc');
 paths.agents = path.join(__dirname, '../../agents');
 } else {
 let sub = path.join(projectPath, '.opencode');
 if (!fs.existsSync(sub) || !fs.statSync(sub).isDirectory()) {
 sub = path.join(projectPath, 'opencode');
 }
 paths.config = path.join(sub, 'opencode.jsonc');
 paths.agents = path.join(sub, 'agents');
 }
}

function getActiveProjectRoot() {
 return activeProjectRoot;
}

// Find session DB path matching the workspace project path
function getWorkspaceDbPath(workspacePath) {
  const sessionsDir = `${process.env.HOME}/.config/opencode/context-mode/sessions`;
 if (!fs.existsSync(sessionsDir)) return null;
 
 let targetPath = workspacePath;
 if (targetPath === 'global_agent' || targetPath === 'global_system' || targetPath === 'global') {
   targetPath = `${process.env.HOME}/goblin/.opencode`;
 }
 targetPath = path.resolve(targetPath);
 
 try {
 const files = fs.readdirSync(sessionsDir);
 for (const file of files) {
 if (file.endsWith('.db')) {
 const fullPath = path.join(sessionsDir, file);
 try {
 const out = execSync(`sqlite3 "${fullPath}" "select project_dir from session_meta limit 1" 2>/dev/null`, { encoding: 'utf8' }).trim();
 if (path.resolve(out) === targetPath) {
 return fullPath;
 }
 } catch (e) {}
 }
 }
 } catch (e) {}
 
 return null;
}

// Auto-scan directories for OpenCode projects
function findOpenCodeProjects() {
  const rootDirs = [
    `${process.env.HOME}/goblin`,
    process.env.HOME
  ];
 
 const projects = [];
 const visited = new Set();
 
 for (const root of rootDirs) {
 if (!fs.existsSync(root)) continue;
 try {
 const files = fs.readdirSync(root);
 for (const file of files) {
 const fullPath = path.join(root, file);
 
 // Skip hidden folders in home (like .opencode, .openclaw, .gemini itself)
  if (file.startsWith('.') && root === process.env.HOME) continue;
 
 if (visited.has(fullPath)) continue;
 visited.add(fullPath);
 
 try {
 const stat = fs.statSync(fullPath);
 if (stat.isDirectory()) {
 const subOpenCode = path.join(fullPath, '.opencode');
 const subOpenCode2 = path.join(fullPath, 'opencode');
 let found = false;
 let configPath = '';
 
 if (fs.existsSync(subOpenCode) && fs.statSync(subOpenCode).isDirectory()) {
 configPath = path.join(subOpenCode, 'opencode.jsonc');
 found = fs.existsSync(configPath);
 } else if (fs.existsSync(subOpenCode2) && fs.statSync(subOpenCode2).isDirectory()) {
 configPath = path.join(subOpenCode2, 'opencode.jsonc');
 found = fs.existsSync(configPath);
 }
 
 if (found) {
 projects.push({
 name: file,
 path: fullPath,
 configPath: configPath
 });
 }
 }
 } catch (e) {}
 }
 } catch (e) {}
 }
 
 return projects;
}

// Helper to strip comments for JSON parsing
function stripComments(jsoncText) {
 return jsoncText.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
}

// Parse reference/models-free.md preserving line metadata
function parseReferenceModels() {
 if (!fs.existsSync(paths.models)) {
 return null;
 }
 
 const content = fs.readFileSync(paths.models, 'utf8');
 const lines = content.split('\n');
 
 const categories = {};
 let currentCategory = null;
 let currentStatus = 'Stabil'; // Default status
 
 for (let line of lines) {
 line = line.trim();
 if (!line) continue;
 
 // Detect header (Category)
 if (line.startsWith('## ')) {
 const header = line.slice(3).trim();
 // Ignore separators like ─────────────
 if (header.startsWith('───')) continue;
 currentCategory = header;
 categories[currentCategory] = [];
 currentStatus = 'Stabil'; // Reset status to default for new header
 continue;
 }
 
 if (!currentCategory) continue;
 
 // Detect status block changes
 if (line.startsWith('>')) {
 const statusText = line.slice(1).trim().toLowerCase();
 if (statusText.includes('error')) {
 currentStatus = 'Error';
 } else if (statusText.includes('stabil')) {
 currentStatus = 'Stabil';
 } else {
 currentStatus = 'Stabil';
 }
 continue;
 }
 
 // Match line containing a model ID
 if (line.includes('/') && !line.startsWith('|') && !line.startsWith('-') && !line.startsWith('`')) {
 const parts = line.split('#');
 const modelId = parts[0].replace(/[*_`]/g, '').trim();
 const alias = parts[1] ? parts[1].replace(/[*_`]/g, '').trim() : null;
 
 categories[currentCategory].push({
 id: modelId,
 alias: alias,
 status: currentStatus
 });
 }
 }
 
 // Remove empty categories
 for (const cat in categories) {
 if (categories[cat].length === 0) {
 delete categories[cat];
 }
 }
 
 return categories;
}

// Build a map of modelId -> alias
function getModelAliasMap(refModels) {
 const map = {};
 if (!refModels) return map;
 for (const cat in refModels) {
 for (const item of refModels[cat]) {
 if (item.alias) {
 map[item.id] = item.alias;
 }
 }
 }
 return map;
}

// Recursively find all markdown files in agents directory
function getPromptFiles(dir, fileList = []) {
 if (!fs.existsSync(dir)) return fileList;
 const files = fs.readdirSync(dir);
 for (const file of files) {
 const filePath = path.join(dir, file);
 const stat = fs.statSync(filePath);
 if (stat.isDirectory()) {
 getPromptFiles(filePath, fileList);
 } else if (file.endsWith('.md')) {
 const relPath = path.relative(path.dirname(paths.config), filePath);
 fileList.push(relPath);
 }
 }
 return fileList;
}

// Helper to erase last N lines from the terminal
function clearLastLines(numLines) {
 for (let i = 0; i < numLines; i++) {
 process.stdout.write('\x1b[1A\x1b[2K');
 }
}

// Find precise range of an agent block in the JSONC file
function findAgentBlockRange(text, agentName) {
 const agentRegex = new RegExp(`(["'])${agentName}\\1\\s*:\\s*\\{`);
 const match = text.match(agentRegex);
 if (!match) return null;
 
 const startBraceIndex = match.index + match[0].length - 1; // Index of the opening '{'
 let braceCount = 1;
 let i = startBraceIndex + 1;
 let inString = false;
 let escape = false;
 
 while (i < text.length && braceCount > 0) {
 const char = text[i];
 if (escape) {
 escape = false;
 } else if (char === '\\') {
 escape = true;
 } else if (char === '"' || char === "'") {
 inString = !inString;
 } else if (!inString) {
 if (char === '{') {
 braceCount++;
 } else if (char === '}') {
 braceCount--;
 }
 }
 i++;
 }
 
 return {
 start: startBraceIndex,
 end: i
 };
}

// Find the range of a nested block in JSONC (e.g. ['mcp', 'github'])
function findNestedBlockRange(text, pathArr) {
 let currentStart = 0;
 let currentEnd = text.length;
 
 for (const key of pathArr) {
 const subText = text.slice(currentStart, currentEnd);
 const keyRegex = new RegExp(`(["'])${key}\\1\\s*:\\s*\\{`);
 const match = subText.match(keyRegex);
 if (!match) return null;
 
 const absoluteStartBrace = currentStart + match.index + match[0].length - 1;
 let braceCount = 1;
 let i = absoluteStartBrace + 1;
 let inString = false;
 let escape = false;
 
 while (i < text.length && braceCount > 0) {
 const char = text[i];
 if (escape) {
 escape = false;
 } else if (char === '\\') {
 escape = true;
 } else if (char === '"' || char === "'") {
 inString = !inString;
 } else if (!inString) {
 if (char === '{') braceCount++;
 else if (char === '}') braceCount--;
 }
 i++;
 }
 
 currentStart = absoluteStartBrace;
 currentEnd = i;
 }
 
 return { start: currentStart, end: currentEnd };
}

// Ensure a nested block path exists in the JSONC text, creating it if necessary
function ensureNestedBlock(text, pathArr) {
 let tempText = text;
 
 for (let i = 1; i <= pathArr.length; i++) {
 const subPath = pathArr.slice(0, i);
 const range = findNestedBlockRange(tempText, subPath);
 if (!range) {
 const parentPath = subPath.slice(0, -1);
 const key = subPath[subPath.length - 1];
 const parentRange = findNestedBlockRange(tempText, parentPath);
 
 if (parentRange) {
 const parentBlock = tempText.slice(parentRange.start, parentRange.end);
 const updatedParent = parentBlock.slice(0, 1) + `\n "${key}": {},` + parentBlock.slice(1);
 tempText = tempText.slice(0, parentRange.start) + updatedParent + tempText.slice(parentRange.end);
 } else {
 tempText = tempText.replace(/^\{\s*/, `{\n "${key}": {},\n`);
 }
 }
 }
 
 return tempText;
}

// Update a boolean/string/array field within a nested block in JSONC
function updateNestedField(text, pathArr, key, newValue) {
 const range = findNestedBlockRange(text, pathArr);
 if (!range) return text;
 
 const blockText = text.slice(range.start, range.end);
 const fieldRegex = new RegExp(`(["'])${key}\\1\\s*:\\s*(\\d+|true|false|["'].*?["']|\\[[\\s\\S]*?\\])`);
 
 if (fieldRegex.test(blockText)) {
 const updatedBlock = blockText.replace(fieldRegex, `$1${key}$1: ${newValue}`);
 return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
 } else {
 const updatedBlock = blockText.slice(0, 1) + `\n "${key}": ${newValue},` + blockText.slice(1);
 return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
 }
}

// Delete a field within a nested block in JSONC
function deleteNestedField(text, pathArr, key) {
 const range = findNestedBlockRange(text, pathArr);
 if (!range) return text;
 
 const blockText = text.slice(range.start, range.end);
 const fieldRegex = new RegExp(`\\s*(["'])${key}\\1\\s*:\\s*(\\d+|true|false|["'].*?["']|\\[[\\s\\S]*?\\]),?`, 'g');
 
 if (fieldRegex.test(blockText)) {
 const updatedBlock = blockText.replace(fieldRegex, '');
 return text.slice(0, range.start) + updatedBlock + text.slice(range.end);
 }
 return text;
}

// Helper to replace field value in JSONC
function updateAgentField(originalContent, agentName, fieldName, newValue, isNumber = false) {
 const range = findAgentBlockRange(originalContent, agentName);
 if (!range) {
 throw new Error(`Gagal melacak blok agent "${agentName}"`);
 }
 
 const agentBlock = originalContent.slice(range.start, range.end);
 
 let fieldRegex;
 if (isNumber) {
 fieldRegex = new RegExp(`(["'])${fieldName}\\1\\s*:\\s*(\\d+)`);
 } else {
 fieldRegex = new RegExp(`(["'])${fieldName}\\1\\s*:\\s*(["'])(.*?)\\2`);
 }
 
 if (!fieldRegex.test(agentBlock)) {
 throw new Error(`Field "${fieldName}" tidak ditemukan di dalam blok agent "${agentName}"`);
 }
 
 let updatedBlock;
 if (isNumber) {
 updatedBlock = agentBlock.replace(fieldRegex, `$1${fieldName}$1: ${newValue}`);
 } else {
 updatedBlock = agentBlock.replace(fieldRegex, `$1${fieldName}$1: $2${newValue}$2`);
 }
 
 return originalContent.slice(0, range.start) + updatedBlock + originalContent.slice(range.end);
}

// Parse models-free.md preserving line metadata for modification
function parseModelsFile() {
 if (!fs.existsSync(paths.models)) {
 return [];
 }
 const content = fs.readFileSync(paths.models, 'utf8');
 const lines = content.split('\n');
 
 let currentProvider = null;
 let currentStatus = 'Stabil';
 
 return lines.map((text, index) => {
 const trimmed = text.trim();
 
 if (trimmed.startsWith('## ')) {
 const header = trimmed.slice(3).trim();
 if (!header.startsWith('───')) {
 currentProvider = header;
 currentStatus = 'Stabil';
 return { index, text, type: 'header', provider: currentProvider };
 }
 }
 
 if (currentProvider && trimmed.startsWith('>')) {
 const statusText = trimmed.slice(1).trim().toLowerCase();
 if (statusText.includes('error')) {
 currentStatus = 'Error';
 } else if (statusText.includes('stabil')) {
 currentStatus = 'Stabil';
 }
 return { index, text, type: 'status', provider: currentProvider, status: currentStatus };
 }
 
 if (currentProvider && trimmed.includes('/') && !trimmed.startsWith('|') && !trimmed.startsWith('-') && !trimmed.startsWith('`')) {
 const parts = trimmed.split('#');
 const modelId = parts[0].replace(/[*_`]/g, '').trim();
 const alias = parts[1] ? parts[1].replace(/[*_`]/g, '').trim() : null;
 return {
 index,
 text,
 type: 'model',
 provider: currentProvider,
 status: currentStatus,
 modelId,
 alias
 };
 }
 
 return { index, text, type: 'other', provider: currentProvider, status: currentStatus };
 });
}

function saveModelsFile(parsedLines) {
 const content = parsedLines.map(l => l.text).join('\n');
 fs.writeFileSync(paths.models, content, 'utf8');
}

function insertModel(parsedLines, provider, status, modelId, alias) {
 const newLineText = `${modelId} # ${alias}`;
 const newLineObj = {
 text: newLineText,
 type: 'model',
 provider,
 status,
 modelId,
 alias
 };
 
 const providerLines = parsedLines.filter(l => l.provider === provider);
 
 if (providerLines.length === 0) {
 const separatorIndex = parsedLines.findIndex(l => l.text.startsWith('## ───'));
 const insertIndex = separatorIndex !== -1 ? separatorIndex : parsedLines.length;
 
 const newSection = [
 { text: '', type: 'other' },
 { text: `## ${provider}`, type: 'header', provider },
 { text: `> ${status === 'Error' ? 'error' : 'Stabil'}`, type: 'status', provider, status },
 newLineObj,
 { text: '', type: 'other' }
 ];
 
 parsedLines.splice(insertIndex, 0, ...newSection);
 return;
 }
 
 const statusLine = providerLines.find(l => l.type === 'status' && l.status === status);
 
 if (statusLine) {
 const statusLineIndex = parsedLines.indexOf(statusLine);
 let insertIndex = statusLineIndex + 1;
 
 while (insertIndex < parsedLines.length) {
 const nextLine = parsedLines[insertIndex];
 if (nextLine.provider === provider && nextLine.status === status && nextLine.type === 'model') {
 insertIndex++;
 } else {
 break;
 }
 }
 
 parsedLines.splice(insertIndex, 0, newLineObj);
 } else {
 const lastProviderLine = providerLines[providerLines.length - 1];
 const insertIndex = parsedLines.indexOf(lastProviderLine) + 1;
 
 const newSection = [
 { text: `> ${status === 'Error' ? 'error' : 'Stabil'}`, type: 'status', provider, status },
 newLineObj
 ];
 parsedLines.splice(insertIndex, 0, ...newSection);
 }
}

async function createNewWorkspace() {
  const wsPath = await p.text({
    message: 'Masukkan path folder workspace baru:',
    placeholder: '~/projects/my-project',
    validate(val) {
      if (!val.trim()) return 'Path tidak boleh kosong!';
    }
  });
  
  if (p.isCancel(wsPath)) return null;
  
  let resolvedPath = wsPath.trim();
  if (resolvedPath.startsWith('~')) {
    resolvedPath = path.join(process.env.HOME, resolvedPath.slice(1));
  }
  resolvedPath = path.resolve(resolvedPath);
  
  const opencodeDir = path.join(resolvedPath, '.opencode');
  try {
    fs.mkdirSync(opencodeDir, { recursive: true });
    
    const toCreate = await p.multiselect({
      message: 'Pilih folder/file yg akan dicreate:',
      options: [
        { value: 'agents', label: 'agents/ (Folder)' },
        { value: 'commands', label: 'commands/ (Folder)' },
        { value: 'opencode.jsonc', label: 'opencode.jsonc (File)' }
      ],
      required: false
    });
    
    if (!p.isCancel(toCreate) && toCreate) {
      if (toCreate.includes('agents')) {
        fs.mkdirSync(path.join(opencodeDir, 'agents'), { recursive: true });
      }
      if (toCreate.includes('commands')) {
        fs.mkdirSync(path.join(opencodeDir, 'commands'), { recursive: true });
      }
      if (toCreate.includes('opencode.jsonc')) {
        fs.writeFileSync(path.join(opencodeDir, 'opencode.jsonc'), '{\n  "agents": {}\n}', 'utf8');
      }
    }
    
    p.outro(color.green(`Workspace baru berhasil dibuat di: ${resolvedPath}`));
    await new Promise(r => setTimeout(r, 1000));
    return resolvedPath;
  } catch (err) {
    p.cancel(color.red(`Gagal membuat workspace: ${err.message}`));
    await new Promise(r => setTimeout(r, 1000));
    return null;
  }
}

module.exports = {
  paths,
  setProjectPaths,
  getActiveProjectRoot,
  getWorkspaceDbPath,
  findOpenCodeProjects,
  stripComments,
  parseReferenceModels,
  getModelAliasMap,
  getPromptFiles,
  clearLastLines,
  findAgentBlockRange,
  findNestedBlockRange,
  ensureNestedBlock,
  updateNestedField,
  deleteNestedField,
  updateAgentField,
  parseModelsFile,
  saveModelsFile,
  insertModel,
  createNewWorkspace
};
