import fs from 'fs';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';
import { AgentConfigItem, AgentPermission } from '../types/config.js';

export async function run(): Promise<void> {
  const configPath = `${process.env.HOME}/.opencode/opencode.jsonc`;
  
  if (!fs.existsSync(configPath)) {
    p.note(color.yellow(`File global agent config tidak ditemukan: ${configPath}`));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  while (true) {
    process.stdout.write('\x1b[H\x1b[2J');
    p.intro(color.cyan(color.bold(' Configure Agent (~/.opencode) ')));

    let content = fs.readFileSync(configPath, 'utf8');
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(utils.stripComments(content));
    } catch (e: any) {
      p.cancel(color.red(`Gagal parse JSONC global agent config: ${e.message}`));
      return;
    }

    const agentBlock: Record<string, AgentConfigItem> = config.agent || config.agents || {};
    const agentNames = Object.keys(agentBlock);

    if (agentNames.length === 0) {
      p.note(color.yellow('Belum ada agent di ~/.opencode/opencode.jsonc'));
      await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
      return;
    }

    const chosenAgent = await p.select({
      message: 'Pilih Agent:',
      options: [
        ...agentNames.map(name => {
          const item = agentBlock[name];
          const isOff = item.disable === true || item.disabled === true;
          const statusBadge = isOff ? color.red('OFF') : color.green('ON ');
          const modelName = item.model || 'default';
          
          return {
            value: name,
            label: `${statusBadge} ${color.bold(name)}`,
            hint: modelName
          };
        }),
        { value: 'back', label: color.yellow('Back') }
      ]
    }) as string;

    if (p.isCancel(chosenAgent) || chosenAgent === 'back') {
      return;
    }

    while (true) {
      content = fs.readFileSync(configPath, 'utf8');
      try {
        config = JSON.parse(utils.stripComments(content));
      } catch (e) {}
      
      const currentBlock = config.agent || config.agents || {};
      const currentAgent = currentBlock[chosenAgent] || {};

      const isOff = currentAgent.disable === true || currentAgent.disabled === true;
      const statusText = isOff ? color.red('OFF') : color.green('ON');
      const modeText = color.yellow(currentAgent.mode || 'primary');
      const modelText = color.cyan(currentAgent.model || 'default');

      process.stdout.write('\x1b[H\x1b[2J');
      p.intro(color.cyan(color.bold(` Agent: ${chosenAgent} `)) + color.dim(` [${modelText} • ${modeText} • ${statusText}]`));

      const fieldToEdit = await p.select({
        message: 'Pilih Setting:',
        options: [
          { value: 'model', label: 'model', hint: currentAgent.model || 'default' },
          { value: 'mode', label: 'mode', hint: currentAgent.mode || 'primary' },
          { value: 'permission', label: 'permission', hint: 'kelola izin akses tools' },
          { value: 'status', label: 'status', hint: isOff ? 'disable' : 'enable' },
          { value: 'back', label: color.yellow('Back') }
        ]
      }) as string;

      if (p.isCancel(fieldToEdit) || fieldToEdit === 'back') break;

      let updatedContent = content;

      if (fieldToEdit === 'model') {
        const parsedModels = utils.parseModelsFile();
        const availableModels = parsedModels.filter(m => m.type === 'model' && m.modelId);
        
        const modelOptions = availableModels.map(m => ({
          value: m.modelId!,
          label: `${color.bold(m.alias || m.modelId)} ${color.dim(`(${m.provider})`)}`
        }));
        modelOptions.unshift({ value: 'custom', label: color.cyan('+ Custom Model ID...') });

        let selectedModel = await p.select({
          message: 'Pilih Model:',
          options: modelOptions
        }) as string;

        if (p.isCancel(selectedModel)) continue;

        if (selectedModel === 'custom') {
          const inputModel = await p.text({
            message: 'Masukkan Model ID (provider/model):',
            validate(v) { if (!v.trim()) return 'Tidak boleh kosong!'; }
          }) as string;
          if (p.isCancel(inputModel)) continue;
          selectedModel = inputModel.trim();
        }

        updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'model', selectedModel);

      } else if (fieldToEdit === 'mode') {
        const newMode = await p.select({
          message: 'Pilih Mode:',
          options: [
            { value: 'primary', label: 'primary' },
            { value: 'subagent', label: 'subagent' },
            { value: 'all', label: 'all' }
          ]
        }) as string;

        if (p.isCancel(newMode)) continue;
        updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'mode', newMode);

      } else if (fieldToEdit === 'status') {
        const currentlyDisabled = currentAgent.disable === true || currentAgent.disabled === true;
        const nextDisabledVal = !currentlyDisabled;
        
        updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'disable', String(nextDisabledVal), true);

      } else if (fieldToEdit === 'permission') {
        const permBlock: AgentPermission = currentAgent.permission || {};
        
        const formatBadge = (val: any) => {
          if (!val) return color.dim('unset');
          if (typeof val === 'string') {
            if (val === 'allow') return color.green('allow');
            if (val === 'ask') return color.yellow('ask');
            if (val === 'deny') return color.red('deny');
            return color.cyan(val);
          }
          return color.cyan(JSON.stringify(val));
        };

        const permChoice = await p.select({
          message: 'Pilih Permission:',
          options: [
            { value: 'bash', label: `bash     [${formatBadge(permBlock.bash)}]` },
            { value: 'question', label: `question [${formatBadge(permBlock.question)}]` },
            { value: 'edit', label: `edit     [${formatBadge(permBlock.edit)}]` },
            { value: 'read', label: `read     [${formatBadge(permBlock.read)}]` },
            { value: 'back', label: color.yellow('Back') }
          ]
        }) as string;

        if (p.isCancel(permChoice) || permChoice === 'back') continue;

        const newPermVal = await p.select({
          message: `Aturan ${permChoice}:`,
          options: [
            { value: 'allow', label: 'allow' },
            { value: 'ask', label: 'ask' },
            { value: 'deny', label: 'deny' }
          ]
        }) as string;

        if (p.isCancel(newPermVal)) continue;

        const blockName = config.agent ? 'agent' : 'agents';
        updatedContent = utils.ensureNestedBlock(updatedContent, [blockName, chosenAgent, 'permission']);
        updatedContent = utils.updateNestedField(updatedContent, [blockName, chosenAgent, 'permission'], permChoice, JSON.stringify(newPermVal));
      }

      try {
        fs.writeFileSync(configPath, updatedContent, 'utf8');
      } catch (e: any) {
        p.cancel(color.red(`Gagal simpan config: ${e.message}`));
      }
    }
  }
}
