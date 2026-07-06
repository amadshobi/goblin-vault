/**
 * Git Module — sub-menu untuk operasi git.
 *
 * Udah implementasi penuh buat ACP (Add + Commit + Push).
 * Sisanya (branch, status, clone, init) masih placeholder.
 */

import { p, color } from '../../utils/constants.js';
import { execCommand, execCommandLive } from '../../utils/exec.js';
import { withSpinner } from '../../utils/spinner.js';
import { confirmAction, handleCancel, clearLastLines } from '../../utils/prompts.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Cek apakah current directory adalah git repo.
 * Returns branch name or null.
 */
async function checkGitRepo() {
  const { stdout, code } = await execCommand('git rev-parse --git-dir 2>/dev/null');
  if (code !== 0 || !stdout.trim()) return null;

  const branch = await execCommand('git branch --show-current 2>/dev/null');
  return branch.stdout.trim() || 'HEAD (detached)';
}

/**
 * Dapatkan daftar staged dan unstaged files.
 */
async function getFileStates() {
  const [unstagedRes, stagedRes] = await Promise.all([
    execCommand('git diff --name-only 2>/dev/null'),
    execCommand('git diff --name-only --cached 2>/dev/null'),
  ]);

  const unstaged = unstagedRes.stdout.split('\n').filter(Boolean);
  const staged = stagedRes.stdout.split('\n').filter(Boolean);
  return { unstaged, staged };
}

/**
 * Format list file untuk ditampilkan di console.
 */
function formatFileList(files, label) {
  if (!files.length) return '';
  return (
    color.dim(`\n  ${label}:\n`) +
    files.map((f) => color.dim(`    • ${f}`)).join('\n')
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export async function main() {
  while (true) {
    const action = await p.select({
      message: 'Git — pilih action:',
      options: [
        { value: 'acp', label: 'Add + Commit + Push', hint: 'full flow' },
        { value: 'branch', label: 'Branch', hint: '🚧' },
        { value: 'status', label: 'Status', hint: '🚧' },
        { value: 'clone', label: 'Clone', hint: '🚧' },
        { value: 'init', label: 'Init', hint: '🚧' },
        { value: 'back', label: '← Back to main menu' },
      ],
    });

    if (p.isCancel(action) || action === 'back') {
      if (p.isCancel(action)) clearLastLines(9);
      break;
    }

    switch (action) {
      case 'acp':
        await acpFlow();
        break;
      case 'branch':
        console.log('🚧 Git Branch — module in progress');
        break;
      case 'status':
        console.log('🚧 Git Status — module in progress');
        break;
      case 'clone':
        console.log('🚧 Git Clone — module in progress');
        break;
      case 'init':
        console.log('🚧 Git Init — module in progress');
        break;
    }
  }
}

// ── ACP Flow ───────────────────────────────────────────────────────────────────

async function acpFlow() {
  // ── 1. Pre-check ────────────────────────────────────────────────────────────
  const s = p.spinner();
  s.start('Checking git repository...');

  const branch = await checkGitRepo();
  if (!branch) {
    s.stop(color.red('✖') + ' Not a git repository');
    console.log(color.red('Error:') + ' Current directory is not a git repo.');
    console.log(color.dim('Run `git init` or open a project with .git folder.\n'));
    return;
  }

  // Cek remote
  const remoteRes = await execCommand('git remote -v 2>/dev/null');
  const hasRemote = remoteRes.stdout.trim().length > 0;

  s.stop(color.green('✔') + ' Git repository detected');
  console.log(color.dim(`  Branch: ${color.cyan(branch)}`));
  if (hasRemote) {
    // Ambil nama remote pertama aja
    const remoteName = remoteRes.stdout.split('\n')[0].split('\t')[0];
    console.log(color.dim(`  Remote: ${color.cyan(remoteName)}`));
  } else {
    console.log(color.dim(`  Remote: ${color.yellow('none')}`));
  }

  // ── 2. Stage files ─────────────────────────────────────────────────────────
  const { unstaged, staged } = await getFileStates();

  // Kalo sama sekali ga ada perubahan
  if (unstaged.length === 0 && staged.length === 0) {
    console.log(color.yellow('\nNo changes detected — nothing to commit.'));
    return;
  }

  // Tampilkan status files
  console.log(formatFileList(unstaged, 'Unstaged'));
  console.log(formatFileList(staged, 'Staged'));

  // Tentukan opsi berdasarkan state
  const stageOptions = [];

  if (unstaged.length > 0) {
    stageOptions.push(
      { value: 'stage-all', label: 'Stage all files', hint: 'git add -A' },
      { value: 'stage-select', label: 'Select files to stage (fzf)', hint: 'multi pilih' }
    );
  }

  // Kalo ada staged files, kasih opsi lanjut atau unstage
  if (staged.length > 0) {
    stageOptions.push(
      { value: 'continue', label: `Continue with current staged (${staged.length} file(s))`, hint: 'lanjut' },
      { value: 'unstage', label: 'Unstage files', hint: 'reset staged' }
    );
  }

  // Kalo cuma ada unstaged + gak ada staged, jangan tampilin continue/unstage
  if (staged.length === 0 && stageOptions.length === 0) {
    // Unreachable basically, tapi jaga-jaga
    console.log(color.yellow('\nNothing to stage.'));
    return;
  }

  let finalStaged = [...staged];
  let stageDone = false;

  while (!stageDone) {
    const stageAction = await p.select({
      message: 'Stage files:',
      options: stageOptions,
    });

    if (handleCancel(stageAction)) {
      clearLastLines(8);
      return;
    }

    switch (stageAction) {
      case 'stage-all': {
        const res = await withSpinner('Staging all files...', () =>
          execCommand('git add -A')
        );
        if (res.code !== 0) {
          console.log(color.red('  git add failed:') + ' ' + res.stderr.trim());
          return;
        }
        const { staged: newStaged } = await getFileStates();
        finalStaged = newStaged;
        console.log(color.dim(`  Staged: ${finalStaged.length} file(s)`));
        stageDone = true;
        break;
      }

      case 'stage-select': {
        // Panggil fzf biar user milih file mana aja yang mau di stage
        const diffOutput = unstaged.join('\n');
        // Kita simpan ke temp dan pipe ke fzf
        const fzfCmd = `echo "${diffOutput}" | fzf --multi --height=40% --prompt='Select files to stage > '`;
        const fzfRes = await execCommand(fzfCmd);

        if (fzfRes.code !== 0 || !fzfRes.stdout.trim()) {
          console.log(color.yellow('No files selected.'));
          continue; // balik ke menu stage
        }

        const selectedFiles = fzfRes.stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((f) => f.trim());

        if (selectedFiles.length === 0) {
          console.log(color.yellow('No files selected.'));
          continue;
        }

        // Stage selected files
        const quotedFiles = selectedFiles.map((f) => `"${f}"`).join(' ');
        const addRes = await withSpinner(
          `Staging ${selectedFiles.length} file(s)...`,
          () => execCommand(`git add ${quotedFiles}`)
        );

        if (addRes.code !== 0) {
          console.log(color.red('  git add failed:') + ' ' + addRes.stderr.trim());
          return;
        }

        const { staged: newStaged } = await getFileStates();
        finalStaged = newStaged;
        console.log(color.dim(`  Staged: ${finalStaged.length} file(s)`));
        stageDone = true;
        break;
      }

      case 'continue': {
        finalStaged = [...staged];
        stageDone = true;
        break;
      }

      case 'unstage': {
        if (staged.length === 0) {
          console.log(color.yellow('No files to unstage.'));
          continue;
        }

        // Tawarkan unstage via fzf juga
        const unstageAction = await p.select({
          message: 'Unstage files:',
          options: [
            { value: 'unstage-all', label: 'Unstage all files', hint: 'reset -- .' },
            { value: 'unstage-select', label: 'Select files to unstage (fzf)', hint: 'multi pilih' },
            { value: 'back', label: '← Back' },
          ],
        });

        if (handleCancel(unstageAction)) {
          clearLastLines(7);
          return;
        }

        if (unstageAction === 'back') continue;

        if (unstageAction === 'unstage-all') {
          await withSpinner('Unstaging all files...', () =>
            execCommand('git reset HEAD -- .')
          );
          finalStaged = [];
          console.log(color.dim('  Staged: 0 file(s)'));
          stageDone = true;
          break;
        }

        if (unstageAction === 'unstage-select') {
          const stagedList = staged.join('\n');
          const fzfCmd = `echo "${stagedList}" | fzf --multi --height=40% --prompt='Select files to unstage > '`;
          const fzfRes = await execCommand(fzfCmd);

          if (fzfRes.code !== 0 || !fzfRes.stdout.trim()) {
            console.log(color.yellow('No files selected for unstage.'));
            continue;
          }

          const selectedFiles = fzfRes.stdout
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((f) => f.trim());

          if (selectedFiles.length === 0) continue;

          const quotedFiles = selectedFiles.map((f) => `"${f}"`).join(' ');
          await withSpinner(`Unstaging ${selectedFiles.length} file(s)...`, () =>
            execCommand(`git reset HEAD -- ${quotedFiles}`)
          );

          const { staged: newStaged } = await getFileStates();
          finalStaged = newStaged;
          stageDone = true;
          break;
        }
        break;
      }
    }
  }

  // ── 3. Commit ──────────────────────────────────────────────────────────────
  if (finalStaged.length === 0) {
    console.log(color.yellow('\nNothing staged — skipping commit.'));
    return;
  }

  const commitMsg = await p.text({
    message: 'Commit message:',
    placeholder: 'feat: add awesome feature',
    validate: (val) => {
      if (!val || val.trim().length < 3) return 'Commit message must be at least 3 characters';
    },
  });

  if (handleCancel(commitMsg)) {
    clearLastLines(5);
    return;
  }

  const commitRes = await withSpinner('Committing...', () =>
    execCommand(`git commit -m "${commitMsg.trim().replace(/"/g, '\\"')}"`)
  );

  if (commitRes.code !== 0) {
    console.log(color.red('  Commit failed:') + ' ' + commitRes.stderr.trim());
    return;
  }

  // Dapatkan commit hash pendek
  const hashRes = await execCommand('git rev-parse --short HEAD');
  const shortHash = hashRes.stdout.trim();

  console.log(color.dim(`  Commit: ${color.cyan(shortHash)} — ${commitMsg.trim()}`));

  // ── 4. Push ─────────────────────────────────────────────────────────────────
  if (!hasRemote) {
    console.log(color.yellow('\nNo remote configured — skipping push.'));
    console.log(color.dim('  Summary:'));
    console.log(color.dim(`    Branch:      ${branch}`));
    console.log(color.dim(`    Commit:      ${shortHash}`));
    console.log(color.dim(`    Files:       ${finalStaged.length}`));
    console.log(color.dim(`    Push:        ${color.yellow('skipped (no remote)')}`));
    return;
  }

  const shouldPush = await confirmAction('Push to remote?');

  if (handleCancel(shouldPush)) {
    clearLastLines(5);
    return;
  }

  let pushStatus = 'skipped';

  if (shouldPush) {
    console.log(color.dim('\nPushing...'));
    const pushCode = await execCommandLive('git push');

    if (pushCode === 0) {
      pushStatus = 'success';
      console.log(color.green('\n✔ Push successful!'));
    } else {
      // Deteksi "no upstream branch" error
      const { stderr } = await execCommand('git push 2>&1');
      if (
        stderr.includes("no upstream branch") ||
        stderr.includes("has no upstream") ||
        stderr.includes("The current branch")
      ) {
        console.log(color.red('\n✖ Push failed — no upstream branch.'));
        console.log(color.dim(`  Suggestion: run ${color.cyan(`git push --set-upstream origin ${branch}`)}`));
      } else if (stderr.includes("failed to push")) {
        console.log(color.red('\n✖ Push rejected. Maybe remote has new commits?'));
        console.log(color.dim('  Try: git pull --rebase'));
      } else {
        console.log(color.red(`\n✖ Push failed (exit code: ${pushCode})`));
      }
      pushStatus = 'failed';
    }
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────────
  const pushLabel =
    pushStatus === 'success'
      ? color.green('success')
      : pushStatus === 'failed'
        ? color.red('failed')
        : color.yellow('skipped');

  console.log(color.dim('\n── Summary ──────────────────────────'));
  console.log(color.dim(`  Branch:      ${color.cyan(branch)}`));
  console.log(color.dim(`  Commit:      ${color.cyan(shortHash)}`));
  console.log(color.dim(`  Files:       ${finalStaged.length}`));
  console.log(color.dim(`  Push:        ${pushLabel}`));
  console.log(color.dim('──────────────────────────────────────\n'));
}
