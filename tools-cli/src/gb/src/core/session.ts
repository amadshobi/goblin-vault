import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { SessionRegistry, SessionEntry } from "../types";

const REGISTRY_PATH = join(homedir(), ".omp", "agent", "sub-sessions.json");

export function loadSessionRegistry(): SessionRegistry {
  try {
    if (existsSync(REGISTRY_PATH)) {
      const raw = readFileSync(REGISTRY_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch {
    // Return empty fallback on parse error
  }
  return { byDir: {} };
}

export function saveSessionRegistry(registry: SessionRegistry): void {
  try {
    const dir = dirname(REGISTRY_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
  } catch {
    // Ignore write errors
  }
}

export function resolveSessionTitle(
  registry: SessionRegistry,
  cwd: string,
  role: string,
  customTitle?: string | null,
  isContinue?: boolean,
  resumeTarget?: string | null
): { title: string; sessionId?: string; isResume: boolean } {
  const dirEntry = registry.byDir[cwd]?.roles?.[role];

  // 1. Explicit Resume Target (-r / --resume=<title_or_id>)
  if (resumeTarget) {
    if (dirEntry?.sessions) {
      // Exact title match
      if (dirEntry.sessions[resumeTarget]) {
        return {
          title: resumeTarget,
          sessionId: dirEntry.sessions[resumeTarget].sessionId,
          isResume: true,
        };
      }
      // Session ID or prefix match
      for (const [title, entry] of Object.entries(dirEntry.sessions)) {
        if (entry.sessionId === resumeTarget || entry.sessionId.startsWith(resumeTarget)) {
          return {
            title,
            sessionId: entry.sessionId,
            isResume: true,
          };
        }
      }
    }
    // Fallback: treat resumeTarget as title
    return { title: resumeTarget, isResume: true };
  }

  // 2. Continue Last Chat (-c / --continue)
  if (isContinue) {
    if (dirEntry?.lastTitle && dirEntry.sessions[dirEntry.lastTitle]) {
      const last = dirEntry.sessions[dirEntry.lastTitle];
      return {
        title: dirEntry.lastTitle,
        sessionId: last.sessionId,
        isResume: true,
      };
    }
  }

  // 3. Custom Title (--title="custom")
  if (customTitle && customTitle.trim()) {
    const title = customTitle.trim();
    const existingSession = dirEntry?.sessions?.[title];
    return {
      title,
      sessionId: existingSession?.sessionId,
      isResume: Boolean(existingSession?.sessionId),
    };
  }

  // 4. Auto-generate Title (role-1, role-2, etc.)
  const existingTitles = dirEntry?.sessions ? Object.keys(dirEntry.sessions) : [];
  let maxNum = 0;
  const rolePrefix = `${role}-`;

  for (const t of existingTitles) {
    if (t.startsWith(rolePrefix)) {
      const numPart = parseInt(t.slice(rolePrefix.length), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  const nextTitle = `${role}-${maxNum + 1}`;
  return { title: nextTitle, isResume: false };
}

export function recordSessionEntry(
  cwd: string,
  role: string,
  title: string,
  sessionId: string
): void {
  const registry = loadSessionRegistry();
  if (!registry.byDir[cwd]) {
    registry.byDir[cwd] = { roles: {} };
  }
  if (!registry.byDir[cwd].roles[role]) {
    registry.byDir[cwd].roles[role] = { sessions: {} };
  }

  const now = new Date().toISOString();
  const existing = registry.byDir[cwd].roles[role].sessions[title];

  registry.byDir[cwd].roles[role].sessions[title] = {
    title,
    sessionId,
    role,
    cwd,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  registry.byDir[cwd].roles[role].lastTitle = title;

  saveSessionRegistry(registry);
}

export function getSessionsForDirectory(
  cwd: string,
  showAll = false
): Array<SessionEntry> {
  const registry = loadSessionRegistry();
  const results: SessionEntry[] = [];

  if (showAll) {
    for (const [, dirData] of Object.entries(registry.byDir)) {
      for (const [, roleData] of Object.entries(dirData.roles)) {
        for (const entry of Object.values(roleData.sessions)) {
          results.push(entry);
        }
      }
    }
  } else {
    const dirData = registry.byDir[cwd];
    if (dirData?.roles) {
      for (const [, roleData] of Object.entries(dirData.roles)) {
        for (const entry of Object.values(roleData.sessions)) {
          results.push(entry);
        }
      }
    }
  }

  return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
