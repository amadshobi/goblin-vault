import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

// ── Resolve paths ────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOME = process.env.HOME || '/root';

// Root tools-cli/ folder
export const TOOLS_CLI_ROOT = path.resolve(__dirname, '../../..');

// Path ke tools bin — tempat tools external tinggal
export const TOOLS_BIN_DIR = path.join(TOOLS_CLI_ROOT, 'bin');

// Path ke external tools
export const GH_BLIN_PATH = path.join(TOOLS_BIN_DIR, 'gh-blin');
export const OCM_PATH = path.join(TOOLS_BIN_DIR, 'ocm');
export const FE_PATH = path.join(TOOLS_BIN_DIR, 'fe');

export const APP_NAME = 'Goblin Control Panel';

// ── Load dependencies dari opencode's node_modules ────────────────────────────
// @clack/prompts & picocolors udah terinstall di ~/.opencode/node_modules/
// Kita resolve via createRequire + dynamic import biar ga perlu install ulang.

const opencodePkg = path.join(HOME, '.opencode/package.json');
const _require = createRequire(opencodePkg);

// picocolors — CommonJS, bisa pake require langsung
export const color = _require('picocolors');

// @clack/prompts — ESM, harus pake dynamic import
const _promptsEntry = pathToFileURL(
  _require.resolve('@clack/prompts')
).href;

/** @type {import('@clack/prompts')} */
export const p = await import(_promptsEntry);
