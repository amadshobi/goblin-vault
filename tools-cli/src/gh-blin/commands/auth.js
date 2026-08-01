const p = require('@clack/prompts');
const color = require('picocolors');
const { ghRaw, ghExec } = require('../utils/gh');
const { clearLastLines } = require('../utils/display');

async function authStatus() {
  const s = p.spinner();
  s.start('Checking auth status...');
  try {
    const status = ghRaw(['auth', 'status'], { silent: true });
    s.stop(status ? 'Logged in' : 'Not logged in');
    if (status) {
      p.note(status, 'Auth Status');
    } else {
      p.note('Not authenticated with GitHub CLI', 'Auth');
    }
  } catch (err) {
    s.stop('Not logged in');
    const msg = err.message.replace(/^gh error:\s*/, '');
    p.note(msg || 'Not authenticated', 'Auth Status');
  }
}

async function authLogin() {
  const s = p.spinner();
  s.start('Opening browser for login...');
  try {
    const out = ghRaw(['auth', 'login', '--web', '-h', 'github.com']);
    s.stop('Login process complete');
    p.note(out, 'Login Result');
    return true;
  } catch (err) {
    s.stop('Login failed');
    const msg = err.message.replace(/^gh error:\s*/, '');
    p.cancel(color.red(`Login failed: ${msg}`));
    clearLastLines(2);
    return false;
  }
}

async function authLogout() {
  const confirmed = await p.confirm({
    message: 'Logout dari GitHub?',
  });
  if (p.isCancel(confirmed) || !confirmed) { clearLastLines(2); return false; }

  const s = p.spinner();
  s.start('Logging out...');
  try {
    const out = ghRaw(['auth', 'logout', '-h', 'github.com']);
    s.stop('Logged out');
    p.note(out, 'Logout');
    return true;
  } catch (err) {
    s.stop('Logout failed');
    p.cancel(color.red(err.message));
    clearLastLines(2);
    return false;
  }
}

async function authMenu() {
  while (true) {
    const action = await p.select({
      message: 'Auth',
      options: [
        { value: 'status', label: '(i) Auth Status' },
        { value: 'login', label: 'Login to GitHub' },
        { value: 'logout', label: 'Logout' },
        { value: 'back', label: 'Back' },
      ],
    });
    if (p.isCancel(action) || action === 'back') { clearLastLines(2); break; }

    switch (action) {
      case 'status': await authStatus(); break;
      case 'login': await authLogin(); break;
      case 'logout': await authLogout(); break;
    }
    await continuePrompt();
  }
}

async function continuePrompt() {
  await p.text({ message: 'Tekan Enter untuk lanjut...', placeholder: '' });
}

module.exports = { authMenu };
