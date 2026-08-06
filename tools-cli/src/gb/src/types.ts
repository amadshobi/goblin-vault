// clean interfaces
export interface AgentInfo {
  name: string;
  path: string;
  category: string;
  model?: string;
  tools: string[];
}

export interface Config {
  disabled: string[];
}

export interface ModelsConfig {
  aliases: Record<string, string>;
  variants: Record<string, string>;
  agents: Record<string, { default_model: string; default_variant?: string; models: string[] }>;
}

export interface SessionEntry {
  title: string;
  sessionId: string;
  role: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRegistry {
  byDir: Record<string, {
    roles: Record<string, {
      lastTitle?: string;
      sessions: Record<string, SessionEntry>;
    }>;
  }>;
}

// ───────────────────────────────────────────────────────────────────────────
// GH domain types (services layer)
// ───────────────────────────────────────────────────────────────────────────

export interface GHAuthor {
  login?: string;
  [key: string]: unknown;
}

export interface GHPullRequest {
  number: number;
  title?: string;
  body?: string | null;
  state?: string;
  author?: GHAuthor | null;
  headRefName?: string;
  headRefOid?: string;
  baseRefName?: string;
  createdAt?: string;
  additions?: number;
  deletions?: number;
  files?: Array<{ filename?: string; additions?: number; deletions?: number }>;
  [key: string]: unknown;
}

export interface GHIssue {
  number: number;
  title: string;
  state?: string;
  body?: string | null;
  author?: GHAuthor | null;
  createdAt?: string;
  labels?: Array<{ name: string }>;
  comments?: Array<{ author?: GHAuthor | null; body?: string | null; createdAt?: string }>;
  [key: string]: unknown;
}

export interface GHUser {
  login?: string;
  name?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
  email?: string | null;
  type?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
  [key: string]: unknown;
}

export interface GHExecOptions {
  raw?: boolean;
  silent?: boolean;
  input?: string;
  timeout?: number;
}

export interface GHApiOptions extends GHExecOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  fields?: Record<string, string | number>;
}
