/**
 * OpenCode Configurator (OCM) — Command: Agent Configuration.
 *
 * Sub-menu interaktif untuk mengelola konfigurasi agent di
 * file `opencode.jsonc`. User dapat memilih agent yang tersedia,
 * lalu mengubah field seperti model, steps, mode, prompt, status
 * enable/disable, dan permission granular.
 *
 * Berinteraksi erat dengan `utils/utils.ts` untuk modifikasi JSONC
 * dan `types/config.ts` untuk tipe data AgentConfigItem.
 */

import fs from 'fs';
import * as p from '@clack/prompts';
import color from 'picocolors';
import * as utils from '../utils/utils.js';
import { AgentConfigItem, AgentPermission } from '../types/config.js';

/**
 * Membuka menu interaktif konfigurasi agent.
 *
 * Alur:
 * 1. Membaca file `~/.opencode/opencode.jsonc`.
 * 2. Menampilkan daftar agent yang terdaftar.
 * 3. User memilih agent → memilih field → memasukkan nilai baru.
 * 4. Perubahan langsung ditulis ke file JSONC.
 */
export async function run(): Promise<void> {
  const configPath = `${process.env.HOME}/.opencode/opencode.jsonc`;
  
  if (!fs.existsSync(configPath)) {
    p.note(color.yellow(`File global agent config tidak ditemukan di: ${configPath}`));
    await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
    return;
  }

  while (true) {
    let content = fs.readFileSync(configPath, 'utf8');
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(utils.stripComments(content));
    } catch (e: any) {
      p.cancel(color.red(`Gagal parse JSONC global agent config: ${e.message}`));
      return;
    }

    // Ambil blok agent — support key `agent` dan `agents`
    const agentBlock: Record<string, AgentConfigItem> = config.agent || config.agents || {};
    const agentNames = Object.keys(agentBlock);

    if (agentNames.length === 0) {
      p.note(color.yellow('Belum ada agent yang dikonfigurasi di ~/.opencode/opencode.jsonc'));
      await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
      return;
    }

    const chosenAgent = await p.select({
      message: 'Pilih Agent yang ingin dikonfigurasi (~/.opencode):',
      options: [
        ...agentNames.map(name => {
          const item = agentBlock[name];
          const isOff = item.disable === true || item.disabled === true;
          const statusStr = isOff ? color.red('(Disabled)') : color.green('(Active)');
          const modelStr = item.model ? color.dim(`[${item.model}]`) : '';
          return { value: name, label: `${name} ${statusStr} ${modelStr}` };
        }),
        { value: 'back', label: color.yellow(' Back to Main Menu') }
      ]
    }) as string;

    if (p.isCancel(chosenAgent) || chosenAgent === 'back') {
      return;
    }

    const currentAgent = agentBlock[chosenAgent] || {};

    const fieldToEdit = await p.select({
      message: `Pilih field untuk Agent "${chosenAgent}":`,
      options: [
        { value: 'model', label: `Model (Current: ${currentAgent.model || 'Default'})` },
        { value: 'steps', label: `Steps (Current: ${currentAgent.steps ?? 'Default'})` },
        { value: 'mode', label: `Mode (Current: ${currentAgent.mode || 'Default'})` },
        { value: 'prompt', label: `Prompt (Current: ${currentAgent.prompt || 'Default'})` },
        { value: 'permissions', label: 'Granular Permissions (bash, question, edit, read)' },
        { value: 'toggle_status', label: `Toggle Status (Currently: ${currentAgent.disable ? 'Disabled' : 'Active'})` },
        { value: 'back', label: ' Back to Agent List' }
      ]
    }) as string;

    if (p.isCancel(fieldToEdit) || fieldToEdit === 'back') continue;

    let updatedContent = content;

    if (fieldToEdit === 'model') {
      // Ambil daftar model dari referensi, termasuk opsi custom
      const parsedModels = utils.parseModelsFile();
      const availableModels = parsedModels.filter(m => m.type === 'model' && m.modelId);
      
      const modelOptions = availableModels.map(m => ({
        value: m.modelId!,
        label: `${m.alias || m.modelId} (${m.provider})`
      }));
      modelOptions.unshift({ value: 'custom', label: color.cyan('+ Custom Model ID...') });

      let selectedModel = await p.select({
        message: `Pilih model baru untuk "${chosenAgent}":`,
        options: modelOptions
      }) as string;

      if (p.isCancel(selectedModel)) continue;

      if (selectedModel === 'custom') {
        const inputModel = await p.text({
          message: 'Masukkan Model ID lengkap (misal: google-antigravity/gemini-3.6-flash):',
          validate(v) { if (!v.trim()) return 'Model ID tidak boleh kosong!'; }
        }) as string;
        if (p.isCancel(inputModel)) continue;
        selectedModel = inputModel.trim();
      }

      updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'model', selectedModel);

    } else if (fieldToEdit === 'steps') {
      const newSteps = await p.text({
        message: 'Masukkan jumlah max steps (angka positif):',
        initialValue: String(currentAgent.steps || 50),
        validate(v) {
          const num = Number(v);
          if (isNaN(num) || num <= 0) return 'Steps harus berupa angka positif!';
        }
      }) as string;

      if (p.isCancel(newSteps)) continue;
      updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'steps', Number(newSteps), true);

    } else if (fieldToEdit === 'mode') {
      const newMode = await p.select({
        message: 'Pilih mode agent:',
        options: [
          { value: 'primary', label: 'primary (Dapat dipanggil langsung)' },
          { value: 'subagent', label: 'subagent (Hanya dipanggil oleh agent lain)' },
          { value: 'all', label: 'all (Dapat dipanggil langsung maupun subagent)' }
        ]
      }) as string;

      if (p.isCancel(newMode)) continue;
      updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'mode', newMode);

    } else if (fieldToEdit === 'prompt') {
      const newPrompt = await p.text({
        message: 'Masukkan prompt/path file prompt (misal: {file:./prompts/coder.txt}):',
        initialValue: currentAgent.prompt || ''
      }) as string;

      if (p.isCancel(newPrompt)) continue;
      updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'prompt', newPrompt);

    } else if (fieldToEdit === 'toggle_status') {
      // Toggle antara enabled dan disabled
      const currentlyDisabled = currentAgent.disable === true || currentAgent.disabled === true;
      const nextDisabledVal = !currentlyDisabled;
      
      updatedContent = utils.updateAgentField(updatedContent, chosenAgent, 'disable', String(nextDisabledVal), true);

    } else if (fieldToEdit === 'permissions') {
      const permBlock: AgentPermission = currentAgent.permission || {};
      const permChoice = await p.select({
        message: `Kelola permission untuk agent "${chosenAgent}":`,
        options: [
          { value: 'bash', label: `bash (Current: ${JSON.stringify(permBlock.bash || 'N/A')})` },
          { value: 'question', label: `question (Current: ${permBlock.question || 'N/A'})` },
          { value: 'edit', label: `edit (Current: ${permBlock.edit || 'N/A'})` },
          { value: 'read', label: `read (Current: ${permBlock.read || 'N/A'})` },
          { value: 'back', label: ' Back' }
        ]
      }) as string;

      if (p.isCancel(permChoice) || permChoice === 'back') continue;

      const newPermVal = await p.select({
        message: `Pilih aturan permission untuk ${permChoice}:`,
        options: [
          { value: 'allow', label: 'allow (Diizinkan otomatis)' },
          { value: 'ask', label: 'ask (Minta konfirmasi pengguna)' },
          { value: 'deny', label: 'deny (Tolak otomatis)' }
        ]
      }) as string;

      if (p.isCancel(newPermVal)) continue;

      // Tentukan key block (agent vs agents) lalu update nested permission
      const blockName = config.agent ? 'agent' : 'agents';
      updatedContent = utils.ensureNestedBlock(updatedContent, [blockName, chosenAgent, 'permission']);
      updatedContent = utils.updateNestedField(updatedContent, [blockName, chosenAgent, 'permission'], permChoice, JSON.stringify(newPermVal));
    }

    try {
      fs.writeFileSync(configPath, updatedContent, 'utf8');
      p.outro(color.green(` Agent "${chosenAgent}" berhasil diperbarui di ~/.opencode/opencode.jsonc!`));
    } catch (e: any) {
      p.cancel(color.red(`Gagal menyimpan file config: ${e.message}`));
    }
  }
}
