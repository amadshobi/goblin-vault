/**
 * OpenCode Configurator (OCM) — Entry Point.
 *
 * File utama yang menjadi pintu masuk aplikasi OCM (OpenCode Config Manager).
 * Bertanggung jawab untuk:
 * - Me-parse argumen CLI (`parseArgs`).
 * - Menampilkan help sesuai subcommand (`showHelp`).
 * - Routing ke command yang sesuai (doctor langsung, sub-menu TUI lain).
 * - Default: membuka dashboard interaktif TUI (`runInteractiveLoop`).
 *
 * Seluruh alur eksekusi dimulai dari fungsi `main()` di bagian bawah file.
 */

import fs from 'fs';
import color from 'picocolors';
import * as utils from './utils/utils.js';
import * as agentCmd from './commands/agent.js';
import * as doctorCmd from './commands/doctor.js';
import { runInteractiveLoop } from './ui/menu.js';

/**
 * Me-parse argumen command line menjadi object opsi.
 *
 * Mendukung:
 * - Subcommand: positional pertama (run, agent, doctor, dll).
 * - Action: positional kedua (untuk subcommand tertentu).
 * - Flags: --help/-h, --doctor/-d, --fix, --project/-p, --agent/-a,
 *   --field/-f, --value/-v.
 *
 * @param args - Array argumen (biasanya `process.argv.slice(2)`).
 * @returns Object opsi dengan properti yang sudah di-set.
 */
function parseArgs(args: string[]): Record<string, any> {
  const options: Record<string, any> = {
    help: false,
    subcommand: null,
    action: null,
    project: null,
    agent: null,
    field: null,
    value: null,
    fix: false
  };

  const validSubcommands = [
    'run', 'agent', 'session', 'settings', 'mcp',
    'providers', 'models', 'reference', 'doctor', 'switch', 'manage'
  ];
  
  // Deteksi subcommand sebagai argumen non-flag pertama
  let startIdx = 0;
  if (args.length > 0 && !args[0].startsWith('-') && validSubcommands.includes(args[0].toLowerCase())) {
    options.subcommand = args[0].toLowerCase();
    startIdx = 1;
    // Deteksi action sebagai argumen non-flag kedua
    if (args.length > 1 && !args[1].startsWith('-')) {
      options.action = args[1].toLowerCase();
      startIdx = 2;
    }
  }

  // Parse flag berpasangan dan flag tunggal
  for (let i = startIdx; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--doctor' || arg === '-d') options.subcommand = 'doctor';
    else if (arg === '--fix') options.fix = true;
    else if (arg === '--project' || arg === '-p') options.project = args[++i];
    else if (arg === '--agent' || arg === '-a') options.agent = args[++i];
    else if (arg === '--field' || arg === '-f') options.field = args[++i];
    else if (arg === '--value' || arg === '-v') options.value = args[++i];
  }

  return options;
}

/**
 * Menampilkan help text ke terminal.
 *
 * Mendukung dual-level help:
 * - Level 1 (tanpa subcommand): daftar semua perintah + global flags.
 * - Level 2 (dengan subcommand, misal `doctor`): detail spesifik perintah.
 *
 * @param subcommand - Subcommand yang ingin dilihat help-nya (opsional).
 * @param action     - Action dalam subcommand (opsional, belum diimplementasi).
 */
function showHelp(subcommand?: string, action?: string): void {
  if (!subcommand) {
    console.log(`
${color.cyan(color.bold('OpenCode Configurator (ocm TS Engine)'))} - Kelola konfig dan referensi model.

${color.yellow('Penggunaan:')}
  ocm                     Buka Dashboard TUI Interaktif (default)
  ocm <command> [options] Jalankan perintah non-interaktif atau buka sub-menu TUI

${color.yellow('Daftar Perintah (Level 2 Help: ocm <command> --help):')}
  run                     Jalankan agent OpenCode
  agent                   Konfigurasi field agent (model, steps, prompt, mode)
  session                 Manajemen database session (list, export, delete)
  settings                Konfigurasi toggles sistem (MCP, Compaction, Plugins)
  mcp                     Kelola server MCP (toggle, add, dll)
  providers               Kelola API Key & Kredensial AI Provider
  models                  Tampilkan perbandingan & daftar model AI
  reference               Kelola references model (models-free.md)
  doctor                  Jalankan diagnosa & auto-fix kesalahan konfig
  switch                  Ganti workspace project aktif

${color.dim('Global Flags:')}
  -p, --project <path>    Set workspace project aktif (default: CWD)
  -h, --help              Tampilkan bantuan ini
`);
    return;
  }

  if (subcommand === 'doctor') {
    console.log(`
${color.cyan(color.bold('ocm doctor'))} - Diagnosa dan auto-fix isu file config.

${color.yellow('Penggunaan:')}
  ocm doctor              Jalankan diagnosa interaktif (default)
  ocm doctor [--fix]      Jalankan diagnosa & auto-fix secara non-interaktif
`);
    return;
  }
}

/**
 * Fungsi utama aplikasi.
 *
 * Alur eksekusi:
 * 1. Parse argumen CLI.
 * 2. Set project path jika `--project` diberikan.
 * 3. Jika `--help`, tampilkan help dan exit.
 * 4. Jika subcommand `doctor`, jalankan langsung (non-interaktif).
 * 5. Jika subcommand TUI, buka loop interaktif dengan startAction.
 * 6. Default: buka loop interaktif tanpa aksi tertentu.
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  
  if (options.project) {
    utils.setProjectPaths(options.project);
  }

  if (options.help) {
    showHelp(options.subcommand, options.action);
    process.exit(0);
  }

  if (options.subcommand === 'doctor') {
    await doctorCmd.run({ fix: options.fix });
    process.exit(0);
  }

  const tuiSubcommands = [
    'run', 'agent', 'session', 'settings', 'mcp',
    'providers', 'models', 'reference', 'switch'
  ];
  if (options.subcommand && tuiSubcommands.includes(options.subcommand)) {
    await runInteractiveLoop(options.subcommand);
    process.exit(0);
  }

  // Default: buka dashboard interaktif
  await runInteractiveLoop();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
