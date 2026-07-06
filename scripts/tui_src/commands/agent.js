const fs = require('fs');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

async function run() {
 const originalContent = fs.readFileSync(utils.paths.config, 'utf8');
 let config;
 try {
 const cleanJson = utils.stripComments(originalContent);
 config = JSON.parse(cleanJson);
 } catch (err) {
 p.cancel(color.red(`Gagal memproses JSONC: ${err.message}`));
 process.exit(1);
 }
 
 const agentBlock = config.agents || config.agent || {};
 const agents = Object.keys(agentBlock).filter(name => {
 const data = agentBlock[name];
 return data && (data.model || data.mode === 'primary' || data.mode === 'subagent' || data.prompt);
 });
 
 if (agents.length === 0) {
 p.note(color.yellow('Info: Config ini tidak memiliki agent untuk dikonfigurasi (hanya berisi config MCP/plugins/TUI).'));
 await p.select({
 message: 'Kembali ke Menu Utama?',
 options: [{ value: 'back', label: 'Kembali' }]
 });
 utils.clearLastLines(5);
 return 'main_menu';
 }
 
 // Load reference models and prompt files
 const refModels = utils.parseReferenceModels();
 const aliasMap = utils.getModelAliasMap(refModels);
 const promptFiles = utils.getPromptFiles(utils.paths.agents);
 
 let currentStep = 'SELECT_AGENT';
 let selectedAgent = null;
 let selectedField = null;
 let selectedProvider = null;
 let chosenModel = null;
 let finalValue = null;
 let isNumberField = false;
 
 while (true) {
 if (currentStep === 'SELECT_AGENT') {
 selectedAgent = await p.select({
 message: 'Pilih agent yang mau dikonfigurasi:',
 options: agents.map(name => {
 const modelId = agentBlock[name].model;
 const displayModel = aliasMap[modelId] || modelId;
 return {
 value: name,
 label: name,
 hint: displayModel
 };
 }),
 });
 
 if (p.isCancel(selectedAgent)) {
 return 'main_menu';
 }
 
 currentStep = 'SELECT_FIELD';
 }
 
 else if (currentStep === 'SELECT_FIELD') {
 const agentData = agentBlock[selectedAgent];
 const modelId = agentData.model;
 const displayModel = aliasMap[modelId] || modelId;
 
 selectedField = await p.select({
 message: `Pilih field agent "${selectedAgent}" yang mau diubah:`,
 options: [
 { value: 'model', label: 'Model', hint: displayModel },
 { value: 'steps', label: 'Steps', hint: String(agentData.steps || 'N/A') },
 { value: 'prompt', label: 'Prompt', hint: agentData.prompt || 'N/A' },
 { value: 'mode', label: 'Mode', hint: agentData.mode || 'N/A' }
 ]
 });
 
 if (p.isCancel(selectedField)) {
 utils.clearLastLines(7);
 utils.clearLastLines(1);
 currentStep = 'SELECT_AGENT';
 continue;
 }
 
 // Route based on selected field
 if (selectedField === 'model') {
 isNumberField = false;
 currentStep = 'SELECT_PROVIDER';
 } else if (selectedField === 'steps') {
 isNumberField = true;
 currentStep = 'INPUT_STEPS';
 } else if (selectedField === 'prompt') {
 isNumberField = false;
 currentStep = 'SELECT_PROMPT';
 } else if (selectedField === 'mode') {
 isNumberField = false;
 currentStep = 'SELECT_MODE';
 }
 }
 
 // MODEL FIELD FLOW
 else if (currentStep === 'SELECT_PROVIDER') {
 if (refModels && Object.keys(refModels).length > 0) {
 const providerOptions = Object.keys(refModels).map(catName => ({
 value: catName,
 label: catName
 }));
 
 providerOptions.push({
 value: 'custom',
 label: ' Input model name manually...'
 });
 
 selectedProvider = await p.select({
 message: 'Pilih provider / kategori model:',
 options: providerOptions
 });
 
 if (p.isCancel(selectedProvider)) {
 const numOptions = Object.keys(refModels).length + 1;
 utils.clearLastLines(numOptions + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_FIELD';
 continue;
 }
 
 if (selectedProvider === 'custom') {
 currentStep = 'INPUT_CUSTOM_MODEL';
 } else {
 currentStep = 'SELECT_MODEL';
 }
 } else {
 currentStep = 'INPUT_CUSTOM_MODEL';
 }
 }
 
 else if (currentStep === 'SELECT_MODEL') {
 const modelsList = refModels[selectedProvider];
 const modelOptions = modelsList.map(item => {
 const isError = item.status === 'Error';
 const displayName = item.alias || item.id;
 return {
 value: item.id,
 label: isError ? `${displayName} ${color.red('[ ERROR]')}` : displayName
 };
 });
 
 modelOptions.push({
 value: 'custom',
 label: ' Input different model for this provider...'
 });
 
 chosenModel = await p.select({
 message: `Pilih model dari ${selectedProvider}:`,
 options: modelOptions
 });
 
 if (p.isCancel(chosenModel)) {
 const numOptions = modelsList.length + 1;
 utils.clearLastLines(numOptions + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_PROVIDER';
 continue;
 }
 
 if (chosenModel === 'custom') {
 currentStep = 'INPUT_CUSTOM_MODEL';
 } else {
 finalValue = chosenModel;
 currentStep = 'SAVE_CONFIG';
 }
 }
 
 else if (currentStep === 'INPUT_CUSTOM_MODEL') {
 const defaultPlaceholder = agentBlock[selectedAgent] ? agentBlock[selectedAgent].model : '';
 const customModel = await p.text({
 message: 'Masukkan nama model baru:',
 placeholder: defaultPlaceholder,
 validate(val) {
 if (!val.trim()) return 'Model name cannot be empty!';
 }
 });
 
 if (p.isCancel(customModel)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 
 if (selectedProvider === 'custom') {
 currentStep = 'SELECT_PROVIDER';
 } else if (selectedProvider) {
 currentStep = 'SELECT_MODEL';
 } else {
 currentStep = 'SELECT_FIELD';
 }
 continue;
 }
 
 finalValue = customModel;
 currentStep = 'SAVE_CONFIG';
 }
 
 // STEPS FIELD FLOW
 else if (currentStep === 'INPUT_STEPS') {
 const defaultPlaceholder = String(agentBlock[selectedAgent].steps || 15);
 const customSteps = await p.text({
 message: 'Masukkan jumlah execution steps baru:',
 placeholder: defaultPlaceholder,
 validate(val) {
 if (!val.trim()) return 'Steps cannot be empty!';
 if (isNaN(Number(val)) || Number(val) <= 0) return 'Steps must be a positive number!';
 }
 });
 
 if (p.isCancel(customSteps)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_FIELD';
 continue;
 }
 
 finalValue = Number(customSteps);
 currentStep = 'SAVE_CONFIG';
 }
 
 // PROMPT FIELD FLOW
 else if (currentStep === 'SELECT_PROMPT') {
 const promptOptions = promptFiles.map(file => ({
 value: `{file:${file}}`,
 label: file
 }));
 
 promptOptions.push({
 value: 'custom',
 label: ' Input custom prompt string...'
 });
 
 const chosenPrompt = await p.select({
 message: 'Pilih file prompt:',
 options: promptOptions
 });
 
 if (p.isCancel(chosenPrompt)) {
 const numOptions = promptFiles.length + 1;
 utils.clearLastLines(numOptions + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_FIELD';
 continue;
 }
 
 if (chosenPrompt === 'custom') {
 currentStep = 'INPUT_CUSTOM_PROMPT';
 } else {
 finalValue = chosenPrompt;
 currentStep = 'SAVE_CONFIG';
 }
 }
 
 else if (currentStep === 'INPUT_CUSTOM_PROMPT') {
 const defaultPlaceholder = agentBlock[selectedAgent].prompt || '';
 const customPrompt = await p.text({
 message: 'Masukkan prompt string baru:',
 placeholder: defaultPlaceholder,
 validate(val) {
 if (!val.trim()) return 'Prompt cannot be empty!';
 }
 });
 
 if (p.isCancel(customPrompt)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_PROMPT';
 continue;
 }
 
 finalValue = customPrompt;
 currentStep = 'SAVE_CONFIG';
 }
 
 // MODE FIELD FLOW
 else if (currentStep === 'SELECT_MODE') {
 const chosenMode = await p.select({
 message: 'Pilih mode agent:',
 options: [
 { value: 'primary', label: 'primary' },
 { value: 'subagent', label: 'subagent' },
 { value: 'all', label: 'all' }
 ]
 });
 
 if (p.isCancel(chosenMode)) {
 utils.clearLastLines(6);
 utils.clearLastLines(1);
 currentStep = 'SELECT_FIELD';
 continue;
 }
 
 finalValue = chosenMode;
 currentStep = 'SAVE_CONFIG';
 }
 
 // SAVE TO CONFIG
 else if (currentStep === 'SAVE_CONFIG') {
 try {
 const newContent = utils.updateAgentField(
 originalContent,
 selectedAgent,
 selectedField,
 finalValue,
 isNumberField
 );
 
 fs.writeFileSync(utils.paths.config, newContent, 'utf8');
 p.outro(color.green(` Sukses! Field "${selectedField}" untuk agent "${selectedAgent}" telah diubah ke: ${color.bold(finalValue)} `));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal memperbarui file config: ${err.message}`));
 process.exit(1);
 }
 }
 }
}

module.exports = { run };
