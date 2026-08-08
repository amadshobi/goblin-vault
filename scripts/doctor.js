#!/usr/bin/env node

/**
 * ============================================================
 * Goblin Vault — System Health & Dependency Diagnostic Engine
 * File: scripts/doctor.js
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const TOOLS_BIN = path.join(ROOT_DIR, 'tools-cli', 'bin');

// Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const headerTitle = `GOBLIN HEALTH & DEPENDENCY CHECK`;
const modeBadge = `[MODE: DIAGNOSTIC]`;

console.log(`\n${colors.bold}${colors.cyan}${headerTitle}${colors.reset} ${colors.gray}${modeBadge}${colors.reset}`);
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

let totalErrors = 0;
let totalWarnings = 0;
const issueSummaryList = [];

function runCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', env: process.env }).trim();
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------
// 1. System Runtime & Tooling Dependencies Check
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.blue}📦 System Runtime & Dependencies${colors.reset}`);

const requiredApps = [
  { cmd: 'node', checkCmd: 'node -v', name: 'Node.js Runtime', req: true, hint: 'Install Node.js (v18+)' },
  { cmd: 'bun', checkCmd: 'bun -v', name: 'Bun TS Runtime', req: false, hint: 'Run `curl -fsSL https://bun.sh/install | bash`' },
  { cmd: 'go', checkCmd: 'go version || ~/.go/bin/go version || /usr/local/go/bin/go version', name: 'Go Compiler for fex', req: true, hint: 'Install Go (https://go.dev/doc/install)' },
  { cmd: 'fzf', checkCmd: 'fzf --version', name: 'Fuzzy Finder for fex/zf', req: true, hint: 'Install fzf (`sudo apt install fzf` or brew)' },
  { cmd: 'tmux', checkCmd: 'tmux -V', name: 'Terminal Multiplexer for fex', req: true, hint: 'Install tmux (`sudo apt install tmux`)' },
  { cmd: 'gh', checkCmd: 'gh --version', name: 'GitHub CLI for gb', req: false, hint: 'Install gh CLI (https://cli.github.com)' }
];

requiredApps.forEach(app => {
  const version = runCmd(app.checkCmd);
  if (version) {
    const cleanVer = version.split('\n')[0].replace(/^v/, '').trim();
    console.log(`   ${colors.green}✔${colors.reset} ${app.cmd.padEnd(10)} ${colors.cyan}${cleanVer.padEnd(14)}${colors.reset} ${colors.gray}(${app.name})${colors.reset}`);
  } else {
    if (app.req) {
      totalErrors++;
      issueSummaryList.push({ name: app.cmd, type: 'CRITICAL ERROR', detail: `${app.name} belum terinstall!`, hint: app.hint });
      console.log(`   ${colors.red}✖${colors.reset} ${colors.bold}${app.cmd.padEnd(10)}${colors.reset} ${colors.red}NOT FOUND${colors.reset}     ${colors.gray}(${app.name})${colors.reset}`);
      console.log(`        ${colors.gray}↳ Solusi : ${colors.yellow}${app.hint}${colors.reset}`);
    } else {
      totalWarnings++;
      console.log(`   ${colors.yellow}⚠${colors.reset} ${app.cmd.padEnd(10)} ${colors.yellow}OPTIONAL MISSING${colors.reset} ${colors.gray}(${app.name})${colors.reset}`);
      console.log(`        ${colors.gray}↳ Solusi : ${colors.yellow}${app.hint}${colors.reset}`);
    }
  }
});

console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 2. Vault CLI Binaries Integrity Check
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.magenta}🔑 Vault CLI Binaries Integrity${colors.reset}`);

const vaultBinaries = ['fex', 'ocm', 'gb', 'gn', 'sup', 'zf'];

vaultBinaries.forEach(bin => {
  const resolved = runCmd(`command -v ${bin}`) || runCmd(`which ${bin}`);
  const localBinPath = path.join(TOOLS_BIN, bin);
  const existsLocal = fs.existsSync(localBinPath);

  if (resolved) {
    console.log(`   ${colors.green}✔${colors.reset} ${bin.padEnd(10)} ${colors.gray}${resolved}${colors.reset}`);
  } else if (existsLocal) {
    const isExec = Boolean(fs.statSync(localBinPath).mode & 0o100);
    if (!isExec) {
      totalErrors++;
      const hint = `chmod +x ${localBinPath}`;
      issueSummaryList.push({ name: bin, type: 'PERM ERROR', detail: `Binary ada di ${localBinPath} tapi belum executable (+x)!`, hint });
      console.log(`   ${colors.red}✖${colors.reset} ${colors.bold}${bin.padEnd(10)}${colors.reset} ${colors.red}NOT EXECUTABLE${colors.reset} ${colors.gray}(${localBinPath})${colors.reset}`);
      console.log(`        ${colors.gray}↳ Solusi : ${colors.yellow}Run \`${hint}\`${colors.reset}`);
    } else {
      totalWarnings++;
      console.log(`   ${colors.yellow}⚠${colors.reset} ${bin.padEnd(10)} ${colors.yellow}NOT IN PATH${colors.reset} ${colors.gray}(Ada di ${localBinPath} tapi belum di $PATH)${colors.reset}`);
    }
  } else {
    totalErrors++;
    const hint = `Build/install binary via scripts/install.sh`;
    issueSummaryList.push({ name: bin, type: 'MISSING BINARY', detail: `Binary ${bin} tidak ditemukan di sistem!`, hint });
    console.log(`   ${colors.red}✖${colors.reset} ${colors.bold}${bin.padEnd(10)}${colors.reset} ${colors.red}MISSING${colors.reset}`);
    console.log(`        ${colors.gray}↳ Solusi : ${colors.yellow}${hint}${colors.reset}`);
  }
});

console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 3. Environment & PATH Verification
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.cyan}⚙️ Environment & PATH Verification${colors.reset}`);

const currentPath = process.env.PATH || '';
if (currentPath.includes(TOOLS_BIN)) {
  console.log(`   ${colors.green}✔${colors.reset} $PATH contains: ${colors.gray}${TOOLS_BIN}${colors.reset}`);
} else {
  totalWarnings++;
  console.log(`   ${colors.yellow}⚠${colors.reset} ${colors.yellow}$PATH warning:${colors.reset} ${TOOLS_BIN} belum terdaftar di ~/.zshrc atau ~/.bashrc!`);
  console.log(`        ${colors.gray}↳ Solusi : Tambahkan \`export PATH="$PATH:${TOOLS_BIN}"\` ke file rc shell lu.${colors.reset}`);
}

const gitStatus = runCmd('git status --short');
if (gitStatus !== null) {
  console.log(`   ${colors.green}✔${colors.reset} Git repository environment clean & healthy.`);
} else {
  totalWarnings++;
  console.log(`   ${colors.yellow}⚠${colors.reset} Not inside a valid git repository workspace.`);
}

console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// Final Diagnostic Output
if (totalErrors === 0) {
  if (totalWarnings === 0) {
    console.log(`${colors.bold}${colors.green}  🎉 STATUS SEHAT WAL'AFIAT! Semua system siap tempur! 🍻${colors.reset}\n`);
  } else {
    console.log(`${colors.bold}${colors.yellow}  ⚠️ STATUS AMAN WITH WARNINGS: Ditemukan ${totalWarnings} peringatan opsional.${colors.reset}\n`);
  }
  process.exit(0);
} else {
  console.log(`${colors.bold}${colors.red}  ❌ STATUS KRITIS! Ditemukan ${totalErrors} masalah utama!${colors.reset}\n`);
  console.log(`${colors.bold}${colors.red}🤨 NIH BOSS MASALAH YANG KETANGKEP:${colors.reset}`);
  issueSummaryList.forEach((issue, idx) => {
    console.log(`   ${colors.bold}${colors.red}${idx + 1}.${colors.reset} ${colors.yellow}${issue.name}${colors.reset} ${colors.gray}(${issue.type})${colors.reset}`);
    console.log(`      ${colors.gray}Detail  :${colors.reset} ${issue.detail}`);
    console.log(`      ${colors.gray}Solusi  :${colors.reset} ${colors.cyan}${issue.hint}${colors.reset}`);
  });
  console.log();
  process.exit(1);
}
