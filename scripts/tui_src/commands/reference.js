const fs = require('fs');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

async function run() {
 let currentStep = 'SELECT_ACTION';
 
 // State variables
 let action = null;
 let parsedLines = [];
 
 // Add State
 let addProvider = null;
 let addStatus = null;
 let addModelId = null;
 let addAlias = null;
 
 // Edit State
 let editProvider = null;
 let editModelId = null;
 let editField = null;
 let editValue = null;
 
 // Delete State
 let deleteProvider = null;
 let deleteModelId = null;
 let deleteConfirm = null;
 
 while (true) {
 parsedLines = utils.parseModelsFile();
 const providers = [...new Set(parsedLines.filter(l => l.type === 'header').map(l => l.provider))];
 
 if (currentStep === 'SELECT_ACTION') {
 action = await p.select({
 message: 'Pilih aksi manajemen model:',
 options: [
 { value: 'add', label: ' Add Model baru' },
 { value: 'edit', label: ' Edit Model' },
 { value: 'delete', label: ' Delete Model' },
 { value: 'back', label: ' back' }
 ]
 });
 
 if (p.isCancel(action) || action === 'back') {
 return 'main_menu';
 }
 
 currentStep = action === 'add' ? 'SELECT_PROVIDER_ADD' : 
 action === 'edit' ? 'SELECT_PROVIDER_EDIT' : 'SELECT_PROVIDER_DELETE';
 }
 
 // ==========================================
 // ADD FLOW
 // ==========================================
 else if (currentStep === 'SELECT_PROVIDER_ADD') {
 const options = providers.map(p => ({ value: p, label: p }));
 options.push({ value: 'new', label: ' Create new provider...' });
 
 addProvider = await p.select({
 message: 'Pilih provider:',
 options
 });
 
 if (p.isCancel(addProvider)) {
 utils.clearLastLines(options.length + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_ACTION';
 continue;
 }
 
 currentStep = addProvider === 'new' ? 'INPUT_PROVIDER_ADD' : 'SELECT_STATUS_ADD';
 }
 
 else if (currentStep === 'INPUT_PROVIDER_ADD') {
 const newProv = await p.text({
 message: 'Masukkan nama provider baru:',
 validate(val) {
 if (!val.trim()) return 'Nama provider tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(newProv)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_PROVIDER_ADD';
 continue;
 }
 
 addProvider = newProv.trim();
 currentStep = 'SELECT_STATUS_ADD';
 }
 
 else if (currentStep === 'SELECT_STATUS_ADD') {
 addStatus = await p.select({
 message: 'Pilih status model:',
 options: [
 { value: 'Stabil', label: 'Stabil (Rekomendasi)' },
 { value: 'Error', label: 'Error (Bermasalah)' }
 ]
 });
 
 if (p.isCancel(addStatus)) {
 utils.clearLastLines(5);
 utils.clearLastLines(1);
 currentStep = addProvider === providers.find(p => p === addProvider) ? 'SELECT_PROVIDER_ADD' : 'INPUT_PROVIDER_ADD';
 continue;
 }
 
 currentStep = 'INPUT_MODEL_ID_ADD';
 }
 
 else if (currentStep === 'INPUT_MODEL_ID_ADD') {
 addModelId = await p.text({
 message: 'Masukkan Model ID (contoh: google/gemini-3.5-flash):',
 validate(val) {
 if (!val.trim()) return 'Model ID tidak boleh kosong!';
 if (!val.includes('/')) return 'Model ID harus berformat provider/name!';
 }
 });
 
 if (p.isCancel(addModelId)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_STATUS_ADD';
 continue;
 }
 
 currentStep = 'INPUT_ALIAS_ADD';
 }
 
 else if (currentStep === 'INPUT_ALIAS_ADD') {
 addAlias = await p.text({
 message: 'Masukkan Display Alias (contoh: Google: Gemini 3.5 Flash):',
 validate(val) {
 if (!val.trim()) return 'Alias tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(addAlias)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'INPUT_MODEL_ID_ADD';
 continue;
 }
 
 try {
 utils.insertModel(parsedLines, addProvider, addStatus, addModelId, addAlias);
 utils.saveModelsFile(parsedLines);
 p.outro(color.green(` Sukses menambahkan model "${addAlias}" ke referensi! `));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal menulis file: ${err.message}`));
 process.exit(1);
 }
 }
 
 // ==========================================
 // EDIT FLOW
 // ==========================================
 else if (currentStep === 'SELECT_PROVIDER_EDIT') {
 if (providers.length === 0) {
 p.note('Tidak ada provider yang terdaftar.');
 currentStep = 'SELECT_ACTION';
 continue;
 }
 
 editProvider = await p.select({
 message: 'Pilih provider model yang ingin diedit:',
 options: providers.map(p => ({ value: p, label: p }))
 });
 
 if (p.isCancel(editProvider)) {
 utils.clearLastLines(providers.length + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_ACTION';
 continue;
 }
 
 currentStep = 'SELECT_MODEL_EDIT';
 }
 
 else if (currentStep === 'SELECT_MODEL_EDIT') {
 const models = parsedLines.filter(l => l.type === 'model' && l.provider === editProvider);
 if (models.length === 0) {
 p.note(`Tidak ada model terdaftar untuk provider ${editProvider}`);
 currentStep = 'SELECT_PROVIDER_EDIT';
 continue;
 }
 
 editModelId = await p.select({
 message: 'Pilih model yang mau diedit:',
 options: models.map(m => ({ value: m.modelId, label: m.alias || m.modelId }))
 });
 
 if (p.isCancel(editModelId)) {
 utils.clearLastLines(models.length + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_PROVIDER_EDIT';
 continue;
 }
 
 currentStep = 'SELECT_EDIT_FIELD';
 }
 
 else if (currentStep === 'SELECT_EDIT_FIELD') {
 const targetModel = parsedLines.find(l => l.type === 'model' && l.provider === editProvider && l.modelId === editModelId);
 
 editField = await p.select({
 message: 'Pilih bagian yang ingin diubah:',
 options: [
 { value: 'id', label: `Model ID (${targetModel.modelId})` },
 { value: 'alias', label: `Display Alias (${targetModel.alias || 'N/A'})` },
 { value: 'status', label: `Status (${targetModel.status})` }
 ]
 });
 
 if (p.isCancel(editField)) {
 utils.clearLastLines(6);
 utils.clearLastLines(1);
 currentStep = 'SELECT_MODEL_EDIT';
 continue;
 }
 
 currentStep = editField === 'id' ? 'INPUT_NEW_ID' :
 editField === 'alias' ? 'INPUT_NEW_ALIAS' : 'SELECT_NEW_STATUS';
 }
 
 else if (currentStep === 'INPUT_NEW_ID') {
 editValue = await p.text({
 message: 'Masukkan Model ID baru:',
 placeholder: editModelId,
 validate(val) {
 if (!val.trim()) return 'Model ID tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(editValue)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_EDIT_FIELD';
 continue;
 }
 
 try {
 const line = parsedLines.find(l => l.type === 'model' && l.provider === editProvider && l.modelId === editModelId);
 line.modelId = editValue;
 line.text = `${editValue} # ${line.alias || ''}`;
 utils.saveModelsFile(parsedLines);
 p.outro(color.green(` Sukses mengupdate Model ID ke "${editValue}"! `));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal menulis file: ${err.message}`));
 process.exit(1);
 }
 }
 
 else if (currentStep === 'INPUT_NEW_ALIAS') {
 const targetModel = parsedLines.find(l => l.type === 'model' && l.provider === editProvider && l.modelId === editModelId);
 editValue = await p.text({
 message: 'Masukkan Display Alias baru:',
 placeholder: targetModel.alias || '',
 validate(val) {
 if (!val.trim()) return 'Alias tidak boleh kosong!';
 }
 });
 
 if (p.isCancel(editValue)) {
 utils.clearLastLines(3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_EDIT_FIELD';
 continue;
 }
 
 try {
 const line = parsedLines.find(l => l.type === 'model' && l.provider === editProvider && l.modelId === editModelId);
 line.alias = editValue;
 line.text = `${line.modelId} # ${editValue}`;
 utils.saveModelsFile(parsedLines);
 p.outro(color.green(` Sukses mengupdate Alias ke "${editValue}"! `));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal menulis file: ${err.message}`));
 process.exit(1);
 }
 }
 
 else if (currentStep === 'SELECT_NEW_STATUS') {
 editValue = await p.select({
 message: 'Pilih status baru:',
 options: [
 { value: 'Stabil', label: 'Stabil (Rekomendasi)' },
 { value: 'Error', label: 'Error (Bermasalah)' }
 ]
 });
 
 if (p.isCancel(editValue)) {
 utils.clearLastLines(5);
 utils.clearLastLines(1);
 currentStep = 'SELECT_EDIT_FIELD';
 continue;
 }
 
 try {
 const line = parsedLines.find(l => l.type === 'model' && l.provider === editProvider && l.modelId === editModelId);
 if (line.status !== editValue) {
 const idx = parsedLines.indexOf(line);
 parsedLines.splice(idx, 1);
 utils.insertModel(parsedLines, editProvider, editValue, editModelId, line.alias);
 utils.saveModelsFile(parsedLines);
 }
 p.outro(color.green(` Sukses memindahkan status model ke "${editValue}"! `));
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal memproses status: ${err.message}`));
 process.exit(1);
 }
 }
 
 // ==========================================
 // DELETE FLOW
 // ==========================================
 else if (currentStep === 'SELECT_PROVIDER_DELETE') {
 if (providers.length === 0) {
 p.note('Tidak ada provider yang terdaftar.');
 currentStep = 'SELECT_ACTION';
 continue;
 }
 
 deleteProvider = await p.select({
 message: 'Pilih provider model yang mau didelete:',
 options: providers.map(p => ({ value: p, label: p }))
 });
 
 if (p.isCancel(deleteProvider)) {
 utils.clearLastLines(providers.length + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_ACTION';
 continue;
 }
 
 currentStep = 'SELECT_MODEL_DELETE';
 }
 
 else if (currentStep === 'SELECT_MODEL_DELETE') {
 const models = parsedLines.filter(l => l.type === 'model' && l.provider === deleteProvider);
 if (models.length === 0) {
 p.note(`Tidak ada model terdaftar untuk provider ${deleteProvider}`);
 currentStep = 'SELECT_PROVIDER_DELETE';
 continue;
 }
 
 deleteModelId = await p.select({
 message: 'Pilih model yang mau dihapus dari referensi:',
 options: models.map(m => ({ value: m.modelId, label: m.alias || m.modelId }))
 });
 
 if (p.isCancel(deleteModelId)) {
 utils.clearLastLines(models.length + 3);
 utils.clearLastLines(1);
 currentStep = 'SELECT_PROVIDER_DELETE';
 continue;
 }
 
 currentStep = 'CONFIRM_DELETE';
 }
 
 else if (currentStep === 'CONFIRM_DELETE') {
 deleteConfirm = await p.confirm({
 message: `Apakah Anda yakin ingin menghapus model "${deleteModelId}" dari provider "${deleteProvider}"?`,
 active: 'Ya, hapus',
 inactive: 'Tidak, batal'
 });
 
 if (p.isCancel(deleteConfirm) || !deleteConfirm) {
 utils.clearLastLines(4);
 utils.clearLastLines(1);
 currentStep = 'SELECT_MODEL_DELETE';
 continue;
 }
 
 try {
 const line = parsedLines.find(l => l.type === 'model' && l.provider === deleteProvider && l.modelId === deleteModelId);
 const idx = parsedLines.indexOf(line);
 if (idx !== -1) {
 parsedLines.splice(idx, 1);
 utils.saveModelsFile(parsedLines);
 p.outro(color.green(` Sukses menghapus model "${deleteModelId}" dari referensi! `));
 }
 return 'success';
 } catch (err) {
 p.cancel(color.red(`Gagal menghapus model: ${err.message}`));
 process.exit(1);
 }
 }
 }
}

module.exports = { run };
