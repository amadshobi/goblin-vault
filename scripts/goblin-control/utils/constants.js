import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

// ── Resolve paths ────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOME = process.env.HOME || '/root';

// Root goblin-control/ directory
export const GOBLIN_ROOT = path.resolve(__dirname, '..');

// Path ke opencode scripts — tempat tools external tinggal
export const SCRIPTS_DIR = path.join(HOME, '.opencode/scripts');

// Path ke external tools
export const GH_BLIN_PATH = path.join(SCRIPTS_DIR, 'gh-blin');
export const OCM_PATH = path.join(SCRIPTS_DIR, 'ocm');
export const FE_PATH = path.join(SCRIPTS_DIR, 'fe');

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
