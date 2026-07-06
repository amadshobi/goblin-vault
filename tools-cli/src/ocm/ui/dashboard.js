const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;
const color = require('picocolors');
const utils = require('../utils');

function getDashboardLines() {
 const activeRoot = utils.getActiveProjectRoot();
 const configPath = utils.paths.config;
 
 let label = activeRoot;
 if (activeRoot === 'global_system') label = ' Global System';
 else if (activeRoot === 'global_agent') label = ' Global Agent';
 else label = ` Project: ${path.basename(activeRoot)}`;
 
 const lines = [];
 lines.push(`Active Workspace: ${color.yellow(label)}`);
 lines.push(`Config File : ${color.dim(configPath)}`);
 
 // Read config to extract default agent & model
 let defaultAgent = 'default';
 let defaultModel = 'N/A';
 if (fs.existsSync(configPath)) {
 try {
 const originalContent = fs.readFileSync(configPath, 'utf8');
 const cleanJson = utils.stripComments(originalContent);
 const config = JSON.parse(cleanJson);
 
 defaultAgent = config.default_agent || 'N/A';
 defaultModel = config.model || 'N/A';
 
 const agentBlock = config.agent || config.agents || {};
 if (defaultAgent !== 'N/A' && agentBlock[defaultAgent]) {
 if (agentBlock[defaultAgent].model) {
 defaultModel = agentBlock[defaultAgent].model;
 }
 }
 } catch (e) {}
 }
 
 lines.push(`Default Agent : ${color.green(defaultAgent)}`);
 lines.push(`Active Model : ${color.cyan(defaultModel)}`);
 
 // Check session database
 const dbPath = utils.getWorkspaceDbPath(activeRoot);
 let sessionInfo = color.dim('No sessions found');
 if (dbPath && fs.existsSync(dbPath)) {
 try {
 const out = execSync(`sqlite3 "${dbPath}" "select session_id, event_count, coalesce(last_event_at, started_at) as last_evt from session_meta order by last_evt desc limit 1" 2>/dev/null`, { encoding: 'utf8' }).trim();
 if (out) {
 const parts = out.split('|');
 const sid = parts[0];
 const count = parts[1];
 const date = parts[2];
 sessionInfo = `${color.bold(sid.slice(0, 16))}... (${count} events, Last: ${date})`;
 }
 } catch (e) {}
 }
 lines.push(`Last Session : ${sessionInfo}`);
 
 // Helper to load .secrets.env
 let envs = { ...process.env };
 try {
  const secretPath = path.join(process.env.HOME || '/root', '.secrets.env');
 if (fs.existsSync(secretPath)) {
 const secrets = fs.readFileSync(secretPath, 'utf8').split('\n');
 for (const line of secrets) {
 if (line.trim().startsWith('export ')) {
 const parts = line.replace('export ', '').split('=');
 if (parts.length >= 2) envs[parts[0].trim()] = parts.slice(1).join('=').trim();
 }
 }
 }
 } catch(e) {}

 // Check API keys
 const keys = [
 { env: 'DEEPSEEK_API_KEY', label: 'DeepSeek' },
 { env: 'OPENROUTER_API_KEY', label: 'OpenR' },
 { env: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub' },
 { env: 'GEMINI_API_KEY', label: 'Gemini' },
 { env: 'OPENAI_API_KEY', label: 'OpenAI' },
 { env: 'ANTHROPIC_API_KEY', label: 'Anthropic' }
 ];
 const envStatuses = keys.map(k => {
 const isSet = envs[k.env] || '';
 return isSet ? color.green(`[] ${k.label}`) : color.red(`[ ] ${k.label}`);
 }).join(' ');
 
 lines.push(`API Keys status : ${envStatuses}`);
 
 return lines;
}

module.exports = { getDashboardLines };
