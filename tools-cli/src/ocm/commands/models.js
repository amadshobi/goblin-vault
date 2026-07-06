const fs = require('fs');
const p = require('@clack/prompts');
const color = require('picocolors');
const utils = require('../utils');

async function run() {
 while (true) {
 const refModels = utils.parseReferenceModels();
 
 if (!refModels || Object.keys(refModels).length === 0) {
 p.note(color.yellow('Tidak ada model terdaftar di database referensi.'));
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 return 'main_menu';
 }
 
 const action = await p.select({
 message: 'Browse & Compare Models:',
 options: [
 { value: 'browse', label: ' Search Model' },
 { value: 'compare', label: ' Benchmark Model' },
 { value: 'back', label: ' back' }
 ]
 });
 
 if (p.isCancel(action) || action === 'back') {
 return 'main_menu';
 }
 
 if (action === 'browse') {
 const providers = Object.keys(refModels);
 const chosenProv = await p.select({
 message: 'Pilih Provider / Kategori:',
 options: providers.map(pr => ({ value: pr, label: pr }))
 });
 
 if (p.isCancel(chosenProv)) continue;
 
 const modelsList = refModels[chosenProv];
 const chosenModel = await p.select({
 message: 'Pilih model untuk melihat info detail:',
 options: modelsList.map(m => ({
 value: m.id,
 label: `${m.alias || m.id}${m.status === 'Error' ? ' [Error]' : ''}`
 }))
 });
 
 if (p.isCancel(chosenModel)) continue;
 
 const mObj = modelsList.find(m => m.id === chosenModel);
 p.note(`Model ID : ${mObj.id}
Alias : ${mObj.alias || 'N/A'}
Provider : ${chosenProv}
${mObj.status === 'Error' ? `Status : ${color.red('Error')}\n` : ''}Pricing : $0.00 / 1M tokens (Free Model) `, 'Info Detail Model');
 
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 
 else if (action === 'compare') {
 const flatList = [];
 for (const prov of Object.keys(refModels)) {
 refModels[prov].forEach(m => {
 flatList.push({ ...m, provider: prov });
 });
 }
 
 const modelA = await p.select({
 message: 'Pilih Model Pertama:',
 options: flatList.map(m => ({ value: m.id, label: `${m.provider}: ${m.alias || m.id}` }))
 });
 
 if (p.isCancel(modelA)) continue;
 
 const modelB = await p.select({
 message: 'Pilih Model Kedua:',
 options: flatList.map(m => ({ value: m.id, label: `${m.provider}: ${m.alias || m.id}` })).filter(o => o.value !== modelA)
 });
 
 if (p.isCancel(modelB)) continue;
 
 const objA = flatList.find(m => m.id === modelA);
 const objB = flatList.find(m => m.id === modelB);
 
 p.note(`Fitur | Model 1 | Model 2
───────────────┼──────────────────────────────────────┼─────────────────────────────
Model ID | ${objA.id.padEnd(36)} | ${objB.id.padEnd(27)}
Alias | ${(objA.alias || 'N/A').padEnd(36)} | ${(objB.alias || 'N/A').padEnd(27)}
Provider | ${objA.provider.padEnd(36)} | ${objB.provider.padEnd(27)}
Status | ${(objA.status === 'Error' ? objA.status : '').padEnd(36)} | ${(objB.status === 'Error' ? objB.status : '').padEnd(27)}
Pricing | Free ($0.00) | Free ($0.00)`, 'Perbandingan Model');
 
 await p.select({ message: 'Kembali?', options: [{ value: 'back', label: 'Kembali' }] });
 }
 }
}

module.exports = { run };
