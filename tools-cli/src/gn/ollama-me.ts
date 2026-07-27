// ─────────────────────────────────────────────────────────────
// Goblin Nexus — Ollama Cloud API & Database Metadata Fetcher
// Reads directly from SQLite DB ~/.omp/agent/agent.db & ~/.shell/secret/
// ─────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";
import { Database } from "bun:sqlite";

export interface OllamaAccountMeta {
  email: string;
  plan: string;
  id: string;
  suspended: boolean;
  sessionUsagePct: number;
  weeklyUsagePct: number;
  sessionResetsAt?: string;
  hasCookie: boolean;
}

interface SecretFileItem {
  email?: string;
  token?: string;
  apiKey?: string;
  key?: string;
  cookie?: string;
  secure_session?: string;
}

const CACHE_FILE = path.join(process.env.HOME || "/tmp", ".cache", "goblin-nexus", "ollama-me-cache.json");
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheMap {
  timestamp: number;
  data: Record<string, OllamaAccountMeta>;
}

function getOllamaCredentials(): SecretFileItem[] {
  const mapByEmail = new Map<string, SecretFileItem>();

  // 1. Read File Vault first (contains secure_session cookies)
  const secretDir = path.join(process.env.HOME || "", ".shell", "secret", "ollama-cloud");
  if (fs.existsSync(secretDir)) {
    try {
      const files = fs.readdirSync(secretDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(secretDir, file), "utf8");
        const json = JSON.parse(content);
        const keyOrEmail = json.email || json.key || json.token || file;
        mapByEmail.set(keyOrEmail, json);
      }
    } catch (_) {}
  }

  // 2. Merge with OMP Agent SQLite DB
  const dbPath = path.join(process.env.HOME || "", ".omp", "agent", "agent.db");
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.query("SELECT data FROM auth_credentials WHERE provider LIKE '%ollama%';").all() as Array<{ data: string }>;
      for (const r of rows) {
        try {
          const parsed = JSON.parse(r.data);
          const tok = parsed.key || parsed.token || parsed.apiKey;
          if (tok) {
            let found = false;
            for (const [k, item] of mapByEmail.entries()) {
              if ((item.key || item.token || item.apiKey) === tok) {
                mapByEmail.set(k, { ...item, key: tok });
                found = true;
                break;
              }
            }
            if (!found) {
              mapByEmail.set(tok, parsed);
            }
          }
        } catch (_) {}
      }
      db.close();
    } catch (_) {}
  }

  return Array.from(mapByEmail.values());
}

function loadCache(): Record<string, OllamaAccountMeta> | null {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const cache: CacheMap = JSON.parse(raw);
    if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.data;
    }
  } catch (_) {}
  return null;
}

function saveCache(data: Record<string, OllamaAccountMeta>) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload: CacheMap = { timestamp: Date.now(), data };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
  } catch (_) {}
}

function parseSettingsHtml(html: string): { sessionPct: number; weeklyPct: number; sessionReset?: string } {
  let sessionPct = 0;
  let weeklyPct = 0;
  let sessionReset: string | undefined;

  const sessionMatch = html.match(/Session[\s\S]*?(\d+(?:\.\d+)?)\s*%\s*used/i);
  if (sessionMatch) sessionPct = parseFloat(sessionMatch[1]);

  const weeklyMatch = html.match(/Weekly[\s\S]*?(\d+(?:\.\d+)?)\s*%\s*used/i);
  if (weeklyMatch) weeklyPct = parseFloat(weeklyMatch[1]);

  const timeMatch = html.match(/class=["']local-time["'][^>]*data-time=["']([^"']+)["']/i);
  if (timeMatch) sessionReset = timeMatch[1];

  return { sessionPct, weeklyPct, sessionReset };
}

export async function fetchOllamaAccountsMeta(): Promise<OllamaAccountMeta[]> {
  const cached = loadCache();
  const creds = getOllamaCredentials();

  if (cached && Object.keys(cached).length >= creds.length && creds.length > 0) {
    return creds.map((c, idx) => {
      const tok = c.key || c.token || c.apiKey || c.email || `idx_${idx}`;
      return cached[tok] || { email: c.email || `ollama-user-${idx + 1}`, plan: "free", id: tok.slice(0, 8), suspended: false, sessionUsagePct: 0, weeklyUsagePct: 0, hasCookie: false };
    });
  }

  const results: OllamaAccountMeta[] = [];
  const newCache: Record<string, OllamaAccountMeta> = cached || {};

  for (let i = 0; i < creds.length; i++) {
    const c = creds[i];
    const tok = c.key || c.token || c.apiKey || "";
    const cookie = c.secure_session || c.cookie;

    let email = c.email || `ollama-user-${i + 1}`;
    let plan = "free";
    let id = tok ? tok.slice(0, 8) : `user-${i + 1}`;
    let suspended = false;
    let sessionUsagePct = 0;
    let weeklyUsagePct = 0;
    let sessionResetsAt: string | undefined;

    if (tok) {
      try {
        const res = await fetch("https://ollama.com/api/me", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          const json = (await res.json()) as any;
          email = json.Email || json.email || email;
          plan = json.Plan || json.plan || plan;
          id = json.ID || json.id || id;
          suspended = Boolean(json.SuspendedAt?.Valid);
        }
      } catch (_) {}
    }

    if (cookie) {
      try {
        const cleanCookie = cookie.startsWith("__Secure-session=") ? cookie : `__Secure-session=${cookie}`;
        const res = await fetch("https://ollama.com/settings", {
          headers: {
            Cookie: cleanCookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });
        if (res.ok) {
          const html = await res.text();
          const parsed = parseSettingsHtml(html);
          sessionUsagePct = parsed.sessionPct;
          weeklyUsagePct = parsed.weeklyPct;
          sessionResetsAt = parsed.sessionReset;
        }
      } catch (_) {}
    }

    const meta: OllamaAccountMeta = {
      email,
      plan,
      id,
      suspended,
      sessionUsagePct,
      weeklyUsagePct,
      sessionResetsAt,
      hasCookie: Boolean(cookie),
    };

    results.push(meta);
    const cacheKey = tok || email;
    if (cacheKey) newCache[cacheKey] = meta;
  }

  saveCache(newCache);
  return results;
}
