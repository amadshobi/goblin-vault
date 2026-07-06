const p = require('@clack/prompts');
async function test() {
  const result = await p.autocomplete({
    message: 'Test',
    options: [{value: 'run', label: 'Run'}, {value: 'doctor', label: 'Doctor'}]
  });
  console.log('RESULT_VALUE:', JSON.stringify(result));
}
test();
