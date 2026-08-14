import fs from 'fs';
import path from 'path';
import os from 'os';
import color from 'picocolors';
import {
  intro,
  outro,
  spinner,
  note,
  text,
  isCancel,
  cancel,
} from '@clack/prompts';
import { loadBotCredentials } from './credentials';
import {
  getAppInfo,
  getInstallationInfo,
  mintInstallationToken,
  listInstallationRepos,
  postIssueComment,
} from './client';
import { setBotSettings, getBotSettings } from '../../config/settings';
import { getCurrentRepo } from '../gh';

function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export interface BotCommentOptions {
  repo?: string;
  bodyFile?: string;
}

/**
 * gb bot status / gb bot info
 * Inspects GitHub App credentials, checks connectivity, displays identity & scopes.
 */
export async function botStatus(): Promise<number> {
  intro(color.bold(color.cyan('🤖 GitHub App Bot Status')));

  const s = spinner();
  s.start('Memvalidasi kredensial bot...');

  let creds;
  try {
    creds = loadBotCredentials();
  } catch (err) {
    s.stop(color.red('Kredensial tidak valid'));
    note(
      color.red(err instanceof Error ? err.message : String(err)),
      'Credential Error'
    );
    return 1;
  }

  s.message('Menghubungi GitHub API (JWT auth)...');

  try {
    const [appInfo, instInfo] = await Promise.all([
      getAppInfo(creds),
      getInstallationInfo(creds),
    ]);

    s.message('Minting ephemeral installation token...');
    const tokenData = await mintInstallationToken(creds);

    s.message('Mengambil daftar repository scope...');
    const reposData = await listInstallationRepos(tokenData.token);

    s.stop(color.green('Koneksi GitHub App Bot Berhasil! ✅'));

    const permissionsList = Object.entries(instInfo.permissions || {})
      .map(([k, v]) => `  • ${color.cyan(k)}: ${color.yellow(v)}`)
      .join('\n');

    const repoList = reposData.repositories
      .slice(0, 8)
      .map((r) => `  • ${color.white(r.full_name)}${r.private ? color.dim(' (private)') : ''}`)
      .join('\n');

    const moreRepos = reposData.total_count > 8
      ? `\n  ${color.dim(`... dan ${reposData.total_count - 8} repository lainnya`)}`
      : '';

    const summary = [
      `${color.bold('App Name:')}        ${color.green(appInfo.name)} (ID: ${appInfo.id})`,
      `${color.bold('App Slug:')}        ${color.dim(appInfo.slug)}`,
      `${color.bold('App Owner:')}       ${appInfo.owner.login} (${appInfo.owner.type})`,
      `${color.bold('Installation ID:')} ${color.yellow(instInfo.id)} (${instInfo.account.login})`,
      `${color.bold('Selection:')}       ${instInfo.repository_selection === 'all' ? color.green('All Repositories') : color.yellow('Selected Repositories')}`,
      `${color.bold('Credential Src:')}  ${color.dim(creds.source)}`,
      `${color.bold('Token Expiry:')}    ${color.dim(tokenData.expires_at)}`,
      '',
      `${color.bold('📦 Accessible Repositories')} (${reposData.total_count} total):`,
      repoList || `  ${color.dim('(Tidak ada repository yang di-assign)')}`,
      moreRepos,
      '',
      `${color.bold('🔑 Granted Permissions:')}`,
      permissionsList || `  ${color.dim('(Tidak ada permission khusus)')}`,
    ].filter(Boolean).join('\n');

    note(summary, 'Bot Information & Scopes');
    outro(color.green('Bot siap digunakan untuk automasi & komentar.'));
    return 0;
  } catch (err) {
    s.stop(color.red('Koneksi gagal'));
    note(
      color.red(`Gagal mengambil status bot:\n${err instanceof Error ? err.message : String(err)}`),
      'Connection Failure'
    );
    return 1;
  }
}

/**
 * gb bot token
 * Outputs ONLY the raw installation access token to stdout for piping.
 */
export async function botToken(): Promise<number> {
  try {
    const creds = loadBotCredentials();
    const tokenData = await mintInstallationToken(creds);
    process.stdout.write(tokenData.token + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(
      `Error minting bot token: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return 1;
  }
}

/**
 * gb bot comment <issueOrPrNumber> [message] [--repo owner/repo] [--body-file path]
 */
export async function botComment(
  issueOrPrNumberStr: string,
  inlineMessage?: string,
  opts?: BotCommentOptions
): Promise<number> {
  const issueNumber = parseInt(issueOrPrNumberStr, 10);
  if (isNaN(issueNumber) || issueNumber <= 0) {
    console.error(color.red(`Nomor issue/PR tidak valid: "${issueOrPrNumberStr}"`));
    return 1;
  }

  let targetRepo = opts?.repo?.trim();
  if (!targetRepo) {
    const detected = getCurrentRepo();
    if (detected) {
      targetRepo = detected;
    }
  }

  if (!targetRepo) {
    console.error(color.red('Repository tidak terdeteksi. Gunakan flag --repo owner/repo.'));
    return 1;
  }

  let bodyContent = inlineMessage?.trim() || '';
  if (opts?.bodyFile) {
    const resolvedPath = expandHome(opts.bodyFile.trim());
    if (!fs.existsSync(resolvedPath)) {
      console.error(color.red(`File pesan tidak ditemukan: ${resolvedPath}`));
      return 1;
    }
    bodyContent = fs.readFileSync(resolvedPath, 'utf8').trim();
  }

  if (!bodyContent) {
    console.error(color.red('Pesan komentar tidak boleh kosong. Berikan teks pesan atau flag --body-file.'));
    return 1;
  }

  const s = spinner();
  s.start(`Mengirim komentar ke ${targetRepo}#${issueNumber} sebagai bot...`);

  try {
    const creds = loadBotCredentials();
    const tokenData = await mintInstallationToken(creds);
    const result = await postIssueComment(targetRepo, issueNumber, bodyContent, tokenData.token);
    
    s.stop(color.green(`Komentar berhasil diposting! ✅`));
    console.log(`${color.bold('Comment URL:')} ${color.cyan(result.html_url)}`);
    return 0;
  } catch (err) {
    s.stop(color.red('Gagal mengirim komentar'));
    console.error(color.red(`Error: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }
}

/**
 * gb bot config
 * Interactive wizard to configure GitHub App credentials in ~/.config/gb/settings.json.
 */
export async function botConfig(): Promise<number> {
  intro(color.bold(color.cyan('⚙️ GitHub App Bot Configuration')));

  const current = getBotSettings();

  const appId = await text({
    message: 'Masukkan GitHub App ID:',
    initialValue: current.app_id ? String(current.app_id) : '',
    validate: (val) => (!val || !val.trim() ? 'App ID wajib diisi' : undefined),
  });
  if (isCancel(appId)) {
    cancel('Setup dibatalkan.');
    return 0;
  }

  const installationId = await text({
    message: 'Masukkan Installation ID:',
    initialValue: current.installation_id ? String(current.installation_id) : '',
    validate: (val) => (!val || !val.trim() ? 'Installation ID wajib diisi' : undefined),
  });
  if (isCancel(installationId)) {
    cancel('Setup dibatalkan.');
    return 0;
  }

  const keyInput = await text({
    message: 'Masukkan Private Key PEM / Path file .pem / {file:/path/to/key}:',
    initialValue: current.private_key_path || (current.private_key ? '(sudah ada PEM)' : ''),
    placeholder: 'contoh: ~/.secrets/bot.pem atau {file:~/.secrets/bot.pem}',
    validate: (val) => (!val || !val.trim() ? 'Private key wajib diisi' : undefined),
  });
  if (isCancel(keyInput)) {
    cancel('Setup dibatalkan.');
    return 0;
  }

  const trimmedKey = String(keyInput).trim();
  const partialUpdate: Record<string, string> = {
    app_id: String(appId).trim(),
    installation_id: String(installationId).trim(),
  };

  if (trimmedKey !== '(sudah ada PEM)') {
    if (trimmedKey.includes('-----BEGIN')) {
      partialUpdate.private_key = trimmedKey;
      delete (partialUpdate as { private_key_path?: string }).private_key_path;
    } else {
      partialUpdate.private_key_path = trimmedKey;
    }
  }

  setBotSettings(partialUpdate);

  outro(color.green('Konfigurasi bot berhasil disimpan di ~/.config/gb/settings.json (mode 0600) 🎉'));
  return 0;
}
