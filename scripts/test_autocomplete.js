const p = require('@clack/prompts');
async function test() {
  const result = await p.autocomplete({
    message: 'Test',
    options: [{value: 'run', label: 'Run'}, {value: 'doctor', label: 'Doctor'}]
  });
  console.log('Result:', result);
  console.log('Type of result:', typeof result);
  console.log('Is array?', Array.isArray(result));
}
test();
