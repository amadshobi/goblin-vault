#!/usr/bin/env node

/**
 * ============================================================
 * Goblin Vault — Multi-Language Syntax & Security Engine
 * File: scripts/check_syntax.js
 * ============================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(ROOT_DIR, 'tools-cli');

// Terminal Colors
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

// Parse Arguments
const args = process.argv.slice(2);
let mode = 'full'; // 'full' | 'staged' | 'working'

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
${colors.bold}${colors.cyan}GOBLIN SYNTAX & SECURITY ENGINE v2.0${colors.reset}
────────────────────────────────────────────────────────────
${colors.bold}USAGE:${colors.reset}
  ./scripts/check_syntax.js [options]

${colors.bold}OPTIONS:${colors.reset}
  ${colors.cyan}--staged, -s${colors.reset}    Scan staged files (${colors.dim}git diff --cached${colors.reset}) [Pre-commit mode]
  ${colors.cyan}--working, -w${colors.reset}   Scan modified working files (${colors.dim}git diff + untracked${colors.reset})
  ${colors.cyan}--full, -f${colors.reset}      Scan entire workspace repository [Default / Pre-push mode]
  ${colors.cyan}--help, -h${colors.reset}      Show this help interface
────────────────────────────────────────────────────────────
`);
  process.exit(0);
}

if (args.includes('--staged') || args.includes('-s')) {
  mode = 'staged';
} else if (args.includes('--working') || args.includes('-w')) {
  mode = 'working';
} else if (args.includes('--full') || args.includes('-f') || args.includes('--all') || args.includes('-a')) {
  mode = 'full';
}

const headerTitle = `GOBLIN SYNTAX & SECURITY CHECK`;
const modeBadge = `[MODE: ${mode.toUpperCase()}]`;

console.log(`\n${colors.bold}${colors.cyan}${headerTitle}${colors.reset} ${colors.gray}${modeBadge}${colors.reset}`);
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

let totalErrors = 0;
const errorSummaryList = [];

function runCmd(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
  } catch (e) {
    return null;
  }
}

function getFilesToScan(extPattern) {
  const regex = new RegExp(`\\.(${extPattern})$`);
  
  if (mode === 'staged') {
    const raw = runCmd('git diff --cached --name-only') || '';
    return raw.split('\n').filter(f => f && regex.test(f));
  } else if (mode === 'working') {
    const modified = (runCmd('git diff --name-only') || '').split('\n');
    const untracked = (runCmd('git ls-files --others --exclude-standard') || '').split('\n');
    const combined = [...new Set([...modified, ...untracked])];
    return combined.filter(f => f && regex.test(f));
  } else {
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.cache'];
    const results = [];
    
    function walk(dir) {
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const fullPath = path.join(dir, item);
        const relPath = path.relative(ROOT_DIR, fullPath);
        
        if (ignoreDirs.some(ignore => relPath.includes(ignore))) continue;
        
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile() && regex.test(relPath)) {
          results.push(relPath);
        }
      }
    }
    walk(ROOT_DIR);
    return results;
  }
}

// Pretty Arrow Identifier Error Printer
function printArrowError(file, location, detail, snippet, fixHint = null) {
  console.log(`   ${colors.red}✖${colors.reset} ${colors.bold}${file}${colors.reset}`);
  console.log(`        ${colors.gray}↳${colors.reset} ${colors.cyan}Location :${colors.reset} ${colors.yellow}${location}${colors.reset}`);
  if (detail) {
    console.log(`        ${colors.gray}↳${colors.reset} ${colors.cyan}Details  :${colors.reset} ${colors.white}${detail}${colors.reset}`);
  }
  if (snippet) {
    const cleanSnippet = snippet.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 2).join(' | ');
    console.log(`        ${colors.gray}↳${colors.reset} ${colors.cyan}Code     :${colors.reset} ${colors.gray}${cleanSnippet}${colors.reset}`);
  }
  if (fixHint) {
    console.log(`        ${colors.gray}↳${colors.reset} ${colors.cyan}Fix Hint :${colors.reset} ${colors.yellow}${fixHint}${colors.reset}`);
  }
}

// Multi-Language Error Stack & Line/Col Parser
function parseErrorDetails(file, stderr, lang) {
  let line = '1';
  let col = '1';
  let detail = '';
  let snippet = '';
  const lines = stderr.split('\n').map(l => l.trim()).filter(Boolean);

  if (lang === 'bash') {
    const match = stderr.match(/line\s+(\d+):\s*(.*)/i);
    if (match) {
      line = match[1];
      detail = match[2];
    } else {
      detail = lines[0] || 'Shell syntax error';
    }
  } else if (lang === 'go') {
    const match = stderr.match(/([^:\s]+\.go):(\d+):(\d+):\s*(.*)/);
    if (match) {
      file = match[1];
      line = match[2];
      col = match[3];
      detail = match[4];
    } else {
      detail = lines[0] || 'Go vet error';
    }
  } else if (lang === 'js') {
    const lineMatch = stderr.match(/:(\d+)\r?\n/);
    if (lineMatch) line = lineMatch[1];
    
    const errMatch = stderr.match(/(SyntaxError:.*|ReferenceError:.*|TypeError:.*)/);
    if (errMatch) detail = errMatch[1];
    else detail = lines[0] || 'JavaScript syntax error';
    
    snippet = lines.slice(1, 3).join(' ');
  } else if (lang === 'ts') {
    const locMatch = stderr.match(/([^:\s]+\.(?:ts|tsx)):(\d+):(\d+)/);
    if (locMatch) {
      file = locMatch[1];
      line = locMatch[2];
      col = locMatch[3];
    }
    const errMatch = stderr.match(/(error:.*|SyntaxError:.*)/i);
    if (errMatch) detail = errMatch[1];
    else detail = lines[0] || 'TypeScript syntax error';
  } else {
    detail = lines[0] || 'Syntax error';
  }

  return {
    location: `${file}:${line}:${col}`,
    detail,
    snippet
  };
}

// ------------------------------------------------------------
// 1. File Permission Inspection
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.blue}🔑 Executable Permissions (+x)${colors.reset}`);
const execCheckTargets = [];

if (fs.existsSync(path.join(TOOLS_DIR, 'bin'))) {
  fs.readdirSync(path.join(TOOLS_DIR, 'bin')).forEach(f => {
    execCheckTargets.push(path.join('tools-cli', 'bin', f));
  });
}
if (fs.existsSync(path.join(ROOT_DIR, 'scripts'))) {
  fs.readdirSync(path.join(ROOT_DIR, 'scripts')).forEach(f => {
    if (f.endsWith('.sh') || f.endsWith('.js')) {
      execCheckTargets.push(path.join('scripts', f));
    }
  });
}

execCheckTargets.forEach(relPath => {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const stat = fs.statSync(fullPath);
    const isExecutable = Boolean(stat.mode & 0o100);
    if (!isExecutable) {
      totalErrors++;
      const loc = `${relPath}:1:1`;
      const det = 'Executable permission missing (+x)';
      const hint = `Run \`chmod +x ${relPath}\``;
      errorSummaryList.push({ file: relPath, location: loc, detail: det, fixHint: hint });
      printArrowError(relPath, loc, det, null, hint);
    } else {
      console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${relPath}${colors.reset}`);
    }
  }
});
if (execCheckTargets.length === 0) {
  console.log(`   ${colors.gray}◦ No targets found.${colors.reset}`);
}
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 2. Shell Scripts Inspection
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.cyan}🐚 Shell Scripts (Bash/Zsh)${colors.reset}`);
const shellFiles = getFilesToScan('sh|bash|zsh');

if (shellFiles.length > 0) {
  shellFiles.forEach(file => {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) {
      const res = spawnSync('bash', ['-n', fullPath], { encoding: 'utf8' });
      if (res.status !== 0) {
        totalErrors++;
        const parsed = parseErrorDetails(file, res.stderr.trim(), 'bash');
        errorSummaryList.push({ file, location: parsed.location, detail: parsed.detail, snippet: parsed.snippet });
        printArrowError(file, parsed.location, parsed.detail, parsed.snippet);
      } else {
        console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${file}${colors.reset}`);
      }
    }
  });
} else {
  console.log(`   ${colors.gray}◦ No files to check in ${mode} mode.${colors.reset}`);
}
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 3. Go Files & Modules Inspection
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.magenta}🐹 Go Files & Modules (go vet)${colors.reset}`);
const goFiles = getFilesToScan('go');

if (goFiles.length > 0) {
  // First run module-level go vet checks
  const srcDir = path.join(TOOLS_DIR, 'src');
  const modResults = new Map();

  if (fs.existsSync(srcDir)) {
    fs.readdirSync(srcDir).forEach(dir => {
      const modPath = path.join(srcDir, dir, 'go.mod');
      if (fs.existsSync(modPath)) {
        const res = spawnSync('go', ['vet', './...'], { cwd: path.join(srcDir, dir), encoding: 'utf8' });
        modResults.set(dir, res);
      }
    });
  }

  goFiles.forEach(file => {
    const fullPath = path.join(ROOT_DIR, file);
    // Find which module this file belongs to
    const relToTools = path.relative(path.join(TOOLS_DIR, 'src'), fullPath);
    const modName = relToTools.split(path.sep)[0];
    const modRes = modResults.get(modName);

    if (modRes && modRes.status !== 0) {
      // Check if stderr mentions this specific file
      if (modRes.stderr.includes(path.basename(file))) {
        totalErrors++;
        const parsed = parseErrorDetails(file, modRes.stderr.trim(), 'go');
        errorSummaryList.push({ file, location: parsed.location, detail: parsed.detail, snippet: parsed.snippet });
        printArrowError(file, parsed.location, parsed.detail, parsed.snippet);
      } else {
        console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${file}${colors.reset}`);
      }
    } else {
      console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${file}${colors.reset}`);
    }
  });
} else {
  console.log(`   ${colors.gray}◦ No files to check in ${mode} mode.${colors.reset}`);
}
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 4. JavaScript Inspection
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.yellow}📦 JavaScript (Node.js)${colors.reset}`);
const jsFiles = getFilesToScan('js');

if (jsFiles.length > 0) {
  jsFiles.forEach(file => {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) {
      const res = spawnSync('node', ['--check', fullPath], { encoding: 'utf8' });
      if (res.status !== 0) {
        totalErrors++;
        const parsed = parseErrorDetails(file, res.stderr.trim(), 'js');
        errorSummaryList.push({ file, location: parsed.location, detail: parsed.detail, snippet: parsed.snippet });
        printArrowError(file, parsed.location, parsed.detail, parsed.snippet);
      } else {
        console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${file}${colors.reset}`);
      }
    }
  });
} else {
  console.log(`   ${colors.gray}◦ No files to check in ${mode} mode.${colors.reset}`);
}
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 5. TypeScript Inspection
// ------------------------------------------------------------
console.log(`${colors.bold}${colors.blue}🔷 TypeScript & JSX (Bun)${colors.reset}`);
const tsFiles = getFilesToScan('ts|tsx');

if (tsFiles.length > 0) {
  const hasBun = Boolean(runCmd('command -v bun'));
  if (hasBun) {
    tsFiles.forEach(file => {
      const fullPath = path.join(ROOT_DIR, file);
      if (fs.existsSync(fullPath)) {
        const res = spawnSync('bun', ['build', '--target=bun', '--no-save', fullPath], { encoding: 'utf8' });
        if (res.status !== 0) {
          totalErrors++;
          const parsed = parseErrorDetails(file, res.stderr.trim(), 'ts');
          errorSummaryList.push({ file, location: parsed.location, detail: parsed.detail, snippet: parsed.snippet });
          printArrowError(file, parsed.location, parsed.detail, parsed.snippet);
        } else {
          console.log(`   ${colors.green}✔${colors.reset} ${colors.gray}${file}${colors.reset}`);
        }
      }
    });
  } else {
    console.log(`   ${colors.yellow}⚠ Bun not found, skipping TypeScript checks.${colors.reset}`);
  }
} else {
  console.log(`   ${colors.gray}◦ No files to check in ${mode} mode.${colors.reset}`);
}
console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);

// ------------------------------------------------------------
// 6. Changelog Guardrail (Staged Mode Only)
// ------------------------------------------------------------
if (mode === 'staged') {
  console.log(`${colors.bold}${colors.white}📜 Changelog Guardrail${colors.reset}`);
  const stagedFiles = (runCmd('git diff --cached --name-only') || '').split('\n');
  const stagedTools = [...new Set(
    stagedFiles
      .filter(f => f.startsWith('tools-cli/src/'))
      .map(f => f.split('/')[2])
      .filter(Boolean)
  )];

  if (stagedTools.length > 0) {
    const missingChangelogs = [];
    stagedTools.forEach(tool => {
      const modularCl = `docs/CHANGELOG/${tool}.md`;
      const hasClUpdate = stagedFiles.some(f => f === modularCl || f === 'CHANGELOG.md');
      if (!hasClUpdate) {
        missingChangelogs.push(tool);
      }
    });

    if (missingChangelogs.length > 0) {
      console.log(`   ${colors.yellow}⚠ WARNING:${colors.reset} Source modified for [${missingChangelogs.join(', ')}], missing staged changelog update.`);
    } else {
      console.log(`   ${colors.green}✔ All tool changelogs staged.${colors.reset}`);
    }
  } else {
    console.log(`   ${colors.gray}◦ No tools modified.${colors.reset}`);
  }
  console.log(`${colors.gray}─`.repeat(64) + `${colors.reset}`);
}

// Summary Output
if (totalErrors === 0) {
  console.log(`${colors.bold}${colors.green}  🎉 Hore BOSS! Semua syntax & permission valid! 🍻${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`${colors.bold}${colors.red}  ❌ Waduh! Ditemukan ${totalErrors} kesalahan!${colors.reset}\n`);
  console.log(`${colors.bold}${colors.red}🤨 NIH BOSS FILE YANG ERROR:${colors.reset}`);
  errorSummaryList.forEach((err, idx) => {
    console.log(`   ${colors.bold}${colors.red}${idx + 1}.${colors.reset} ${colors.yellow}${err.location}${colors.reset}`);
    console.log(`      ${colors.gray}Details :${colors.reset} ${err.detail}`);
    if (err.fixHint) {
      console.log(`      ${colors.gray}Fix Hint:${colors.reset} ${colors.cyan}${err.fixHint}${colors.reset}`);
    }
  });
  console.log();
  process.exit(1);
}
