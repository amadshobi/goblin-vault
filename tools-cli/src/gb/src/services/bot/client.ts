import https from 'https';
import { signAppJwt } from './jwt';
import type { GBBotCredentials } from './credentials';

export interface GitHubAppInfo {
  id: number;
  slug: string;
  name: string;
  owner: {
    login: string;
    type: string;
  };
  description: string | null;
  html_url: string;
  permissions?: Record<string, string>;
  events?: string[];
}

export interface GitHubInstallation {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url?: string;
  };
  repository_selection: 'all' | 'selected';
  access_tokens_url: string;
  repositories_url: string;
  permissions: Record<string, string>;
  events: string[];
}

export interface InstallationTokenResponse {
  token: string;
  expires_at: string;
  permissions: Record<string, string>;
  repository_selection: 'all' | 'selected';
}

export interface InstallationRepositoriesResponse {
  total_count: number;
  repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
  }>;
}

export interface BotRequestOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  authType: 'Bearer' | 'token';
  authToken: string;
  body?: unknown;
}

/**
 * Native HTTPS request wrapper to api.github.com.
 */
export function botRequest<T>(opts: BotRequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const postData = opts.body ? JSON.stringify(opts.body) : null;
    const headers: Record<string, string | number> = {
      'User-Agent': 'gb-cli/2.2.0 (Goblin Vault GitHub Assistant)',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Authorization': `${opts.authType} ${opts.authToken}`,
    };

    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(
      {
        hostname: 'api.github.com',
        port: 443,
        path: opts.path,
        method: opts.method || 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode || 0;

          if (statusCode >= 200 && statusCode < 300) {
            try {
              const parsed = raw ? JSON.parse(raw) : ({} as T);
              resolve(parsed as T);
            } catch (err) {
              reject(new Error(`Gagal mem-parse response JSON dari GitHub: ${err instanceof Error ? err.message : String(err)}`));
            }
          } else {
            let errorMsg = `GitHub API Error (${statusCode})`;
            try {
              const errObj = JSON.parse(raw);
              if (errObj.message) {
                errorMsg = `[GitHub ${statusCode}] ${errObj.message}`;
                if (errObj.documentation_url) {
                  errorMsg += ` (Docs: ${errObj.documentation_url})`;
                }
              }
            } catch {
              if (raw) errorMsg += `: ${raw.slice(0, 200)}`;
            }
            reject(new Error(errorMsg));
          }
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Network error saat request ke GitHub API: ${err.message}`));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Mint installation access token using RS256 JWT auth.
 */
export async function mintInstallationToken(creds: GBBotCredentials): Promise<InstallationTokenResponse> {
  const jwt = signAppJwt(creds.appId, creds.privateKey);
  return botRequest<InstallationTokenResponse>({
    path: `/app/installations/${encodeURIComponent(creds.installationId)}/access_tokens`,
    method: 'POST',
    authType: 'Bearer',
    authToken: jwt,
  });
}

/**
 * Fetch authenticated GitHub App metadata.
 */
export async function getAppInfo(creds: GBBotCredentials): Promise<GitHubAppInfo> {
  const jwt = signAppJwt(creds.appId, creds.privateKey);
  return botRequest<GitHubAppInfo>({
    path: '/app',
    method: 'GET',
    authType: 'Bearer',
    authToken: jwt,
  });
}

/**
 * List all installations for this GitHub App.
 */
export async function listAppInstallations(creds: GBBotCredentials): Promise<GitHubInstallation[]> {
  const jwt = signAppJwt(creds.appId, creds.privateKey);
  return botRequest<GitHubInstallation[]>({
    path: '/app/installations',
    method: 'GET',
    authType: 'Bearer',
    authToken: jwt,
  });
}

/**
 * Get single installation details.
 */
export async function getInstallationInfo(creds: GBBotCredentials): Promise<GitHubInstallation> {
  const jwt = signAppJwt(creds.appId, creds.privateKey);
  return botRequest<GitHubInstallation>({
    path: `/app/installations/${encodeURIComponent(creds.installationId)}`,
    method: 'GET',
    authType: 'Bearer',
    authToken: jwt,
  });
}

/**
 * List repositories accessible to the installation token.
 */
export async function listInstallationRepos(token: string): Promise<InstallationRepositoriesResponse> {
  return botRequest<InstallationRepositoriesResponse>({
    path: '/installation/repositories?per_page=100',
    method: 'GET',
    authType: 'token',
    authToken: token,
  });
}

/**
 * Post an issue/PR comment using installation token.
 */
export async function postIssueComment(
  repoFullName: string,
  issueOrPrNumber: number,
  body: string,
  token: string
): Promise<{ id: number; html_url: string }> {
  return botRequest<{ id: number; html_url: string }>({
    path: `/repos/${repoFullName}/issues/${issueOrPrNumber}/comments`,
    method: 'POST',
    authType: 'token',
    authToken: token,
    body: { body },
  });
}
