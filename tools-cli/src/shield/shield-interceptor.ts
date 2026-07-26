import { readFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

// Configuration paths
const VAULT_SECURITY_DIR = join(process.env.GOBLIN_VAULT_ROOT || join(process.env.HOME || "", "civil/goblin-vault"), "tools-cli", "src", "shield");
const LEGACY_SECURITY_DIR = join(process.env.HOME || "", ".shell", "security");

const SECURITY_DIR = existsSync(join(VAULT_SECURITY_DIR, "rules.json")) ? VAULT_SECURITY_DIR : LEGACY_SECURITY_DIR;
const RULES_PATH = join(SECURITY_DIR, "rules.json");
const HEADERS_PATH = join(SECURITY_DIR, "privacy-headers.json");
const SHIELD_LOG_PATH = join(SECURITY_DIR, "shield.log");

// Default Upstream & Listen Ports
const LISTEN_PORT = parseInt(process.env.SHIELD_LISTEN_PORT || "4002", 10);
const TARGET_PORT = parseInt(process.env.SHIELD_TARGET_PORT || "4000", 10);
const TARGET_HOST = process.env.SHIELD_TARGET_HOST || "127.0.0.1";

interface MaskRule {
  name: string;
  regex: string;
  compiled?: RegExp;
}

interface FallbackConfig {
  enabled: boolean;
  trigger_statuses: number[];
  trigger_status_5xx: boolean;
  fallback_models: Record<string, string | string[]>;
  default_fallback: string | string[];
  endpoints: string[];
}

interface ShieldRules {
  enabled: boolean;
  redact_replacement: string;
  patterns: MaskRule[];
  fallback?: FallbackConfig;
}

interface ShieldHeaders {
  headers: Record<string, string>;
}

// ────────────────────────────────────────────────────────────
// Default Fallback Map (used when rules.json has no fallback block)
// Immutability: never mutated at runtime — all transformations return new objects
// ────────────────────────────────────────────────────────────
const DEFAULT_FALLBACK: FallbackConfig = Object.freeze({
  enabled: true,
  trigger_statuses: Object.freeze([410, 429]) as unknown as number[],
  trigger_status_5xx: true,
  fallback_models: Object.freeze({
    "google-antigravity/claude-sonnet-4-6": "google-antigravity/gemini-3.6-flash",
    "google-antigravity/claude-opus-4-6":   "google-antigravity/gemini-3.1-pro",
    "google-antigravity/gemini-3.1-pro":    "google-antigravity/gemini-3.6-flash",
    "google-antigravity/gemini-3.6-flash":  "google-antigravity/gemini-3.1-pro"
  }) as unknown as Record<string, string>,
  default_fallback: "google-antigravity/gemini-3.6-flash",
  endpoints: Object.freeze(["/v1/chat/completions", "/v1/messages"]) as unknown as string[]
});

// Load Rules & Headers
let rules: ShieldRules = { enabled: true, redact_replacement: "[REDACTED]", patterns: [] };
let privacyHeaders: Record<string, string> = {};
let fallbackConfig: FallbackConfig = DEFAULT_FALLBACK;

try {
  if (existsSync(RULES_PATH)) {
    const content = JSON.parse(readFileSync(RULES_PATH, "utf-8"));
    rules = {
      ...content,
      patterns: (content.patterns || []).map((p: MaskRule) => ({
        ...p,
        compiled: new RegExp(p.regex, "g")
      }))
    };
    // Merge fallback config (rules.json takes precedence, but defaults fill gaps)
    if (content.fallback) {
      fallbackConfig = {
        enabled: content.fallback.enabled ?? DEFAULT_FALLBACK.enabled,
        trigger_statuses: content.fallback.trigger_statuses ?? DEFAULT_FALLBACK.trigger_statuses,
        trigger_status_5xx: content.fallback.trigger_status_5xx ?? DEFAULT_FALLBACK.trigger_status_5xx,
        fallback_models: {
          ...DEFAULT_FALLBACK.fallback_models,
          ...(content.fallback.fallback_models || {})
        },
        default_fallback: content.fallback.default_fallback ?? DEFAULT_FALLBACK.default_fallback,
        endpoints: content.fallback.endpoints ?? DEFAULT_FALLBACK.endpoints
      };
    }
  }
  if (existsSync(HEADERS_PATH)) {
    const content = JSON.parse(readFileSync(HEADERS_PATH, "utf-8"));
    privacyHeaders = content.headers || {};
  }
} catch (err) {
  console.error("⚠️ [Goblin Shield] Failed loading rules or headers config:", err);
}

function sanitizeText(text: string): { sanitized: string; maskedCount: number } {
  if (!rules.enabled || !rules.patterns.length) return { sanitized: text, maskedCount: 0 };

  let maskedCount = 0;
  let result = text;

  for (const rule of rules.patterns) {
    if (!rule.compiled) continue;
    const matches = result.match(rule.compiled);
    if (matches && matches.length > 0) {
      maskedCount += matches.length;
      result = result.replace(rule.compiled, rules.redact_replacement);
    }
  }

  return { sanitized: result, maskedCount };
}

// ────────────────────────────────────────────────────────────
// Smart Model Fallback Router
// ────────────────────────────────────────────────────────────

/**
 * Pure helper — decide whether a status code should trigger fallback.
 * Extracted so it can be unit-tested independently.
 */
function shouldTriggerFallback(status: number, cfg: FallbackConfig = fallbackConfig): boolean {
  if (!cfg.enabled) return false;
  if (cfg.trigger_statuses.includes(status)) return true;
  if (cfg.trigger_status_5xx && status >= 500 && status < 600) return true;
  return false;
}

/**
 * Resolve candidate fallback models array for a primary model ID.
 * Supports string arrays in fallback_models config as well as single string fallbacks.
 * Returns empty array if no fallback is available.
 */
function resolveFallbackCandidates(primaryModel: string, cfg: FallbackConfig = fallbackConfig): string[] {
  let result: string[] = [];
  const mapped = cfg.fallback_models[primaryModel];

  if (Array.isArray(mapped)) {
    result = [...mapped];
  } else if (typeof mapped === "string" && !mapped.startsWith("//")) {
    result = [mapped];
  }

  // If no direct mapping, add default fallback candidates if available
  if (result.length === 0) {
    if (Array.isArray(cfg.default_fallback)) {
      result = [...cfg.default_fallback];
    } else if (typeof cfg.default_fallback === "string" && cfg.default_fallback) {
      result = [cfg.default_fallback];
    }
  }

  // Filter out any invalid items, comment keys, or circular self-references
  return result.filter((m) => m && typeof m === "string" && !m.startsWith("//") && m !== primaryModel);
}

/**
 * Pure helper — extract model from request body. Returns null for malformed bodies.
 * Original body is never mutated; parsed object is owned locally.
 */
function extractModelFromBody(bodyStr: string): { parsed: any; model: string | null } | null {
  if (!bodyStr) return null;
  try {
    const parsed = JSON.parse(bodyStr);
    const model = typeof parsed?.model === "string" ? parsed.model : null;
    return { parsed, model };
  } catch {
    return null;
  }
}

/**
 * Build a NEW body string with the model swapped. Original parsed object is not mutated.
 * Returns null if the body is not a JSON object we can safely modify.
 */
function buildFallbackBody(originalParsed: any, newModel: string): string | null {
  if (!originalParsed || typeof originalParsed !== "object") return null;
  // Immutable: create shallow copy then override model field
  const next = { ...originalParsed, model: newModel };
  try {
    return JSON.stringify(next);
  } catch {
    return null;
  }
}

/**
 * Read a header value (case-insensitive) safely from Headers.
 */
function getHeader(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase()) ?? null;
}

/**
 * Append a line to shield.log + echo to console. Single source of truth for fallback events.
 */
function logFallbackEvent(message: string) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    appendFileSync(SHIELD_LOG_PATH, line + "\n");
  } catch {
    // Logging is best-effort; never let file IO crash the proxy
  }
}

/**
 * Compose an outbound Headers object: original request headers minus hop-by-hop
 * + privacy headers injected. Pure function — returns a new Headers instance.
 */
function buildOutboundHeaders(reqHeaders: Headers): Headers {
  const outbound = new Headers(reqHeaders);
  outbound.delete("host");
  // Strip mock/fallback control headers from forwarded request so upstream
  // doesn't see them and the real fault-injection is contained to the shield.
  outbound.delete("x-mock-status");
  outbound.delete("x-force-fallback");
  outbound.delete("X-Mock-Status");
  outbound.delete("X-Force-Fallback");
  for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
    outbound.set(hKey, hVal);
  }
  return outbound;
}

/**
 * Compose response headers, injecting privacy opt-out headers.
 */
function buildResponseHeaders(upstreamHeaders: Headers): Headers {
  const respHeaders = new Headers(upstreamHeaders);
  for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
    respHeaders.set(hKey, hVal);
  }
  return respHeaders;
}

/**
 * Determine if a request is eligible for the fallback path.
 * Method must be POST (or PUT) and the URL must match a configured endpoint.
 */
function isFallbackEligible(method: string, pathname: string, cfg: FallbackConfig = fallbackConfig): boolean {
  if (!cfg.enabled) return false;
  const m = method.toUpperCase();
  if (m !== "POST" && m !== "PUT") return false;
  return cfg.endpoints.some((ep) => pathname === ep || pathname.startsWith(ep + "?"));
}

/**
 * Build a fallback response: re-issue the fetch with new body, return a Response
 * mirroring the upstream one (status/headers/body). Body is streamed as-is.
 */
async function executeFallback(
  targetUrl: string,
  method: string,
  headers: Headers,
  fallbackBody: string
): Promise<Response> {
  return await fetch(targetUrl, {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? undefined : fallbackBody
  });
}

console.log(`🛡️ [Goblin Shield Interceptor Engine] Initializing...`);
console.log(`📡 Listening on: http://127.0.0.1:${LISTEN_PORT}`);
console.log(`🎯 Forwarding to: http://${TARGET_HOST}:${TARGET_PORT}`);
console.log(`🔒 Active Sanitization Rules: ${rules.patterns.length}`);
console.log(`🚫 Zero-Data Headers Injected: ${Object.keys(privacyHeaders).join(", ")}`);
console.log(`♻️  Smart Fallback Router: ${fallbackConfig.enabled ? "ENABLED" : "DISABLED"} (${Object.keys(fallbackConfig.fallback_models).length} model mappings, default → ${fallbackConfig.default_fallback})`);

Bun.serve({
  port: LISTEN_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const targetUrl = `http://${TARGET_HOST}:${TARGET_PORT}${url.pathname}${url.search}`;
    const method = req.method.toUpperCase();

    // ── Fault injection: client can force a simulated upstream error to test fallback
    const mockStatusHeader = getHeader(req.headers, "x-mock-status");
    const forceFallbackHeader = getHeader(req.headers, "x-force-fallback");
    const mockStatus = mockStatusHeader ? parseInt(mockStatusHeader, 10) : 0;
    const forceFallback = forceFallbackHeader === "true" || forceFallbackHeader === "1";

    // Read Request Body (once — we may need to reuse for fallback)
    let reqBodyStr = "";
    if (req.body) {
      reqBodyStr = await req.text();
    }

    // Sanitize Request Body (immutable transform)
    let finalReqBody = reqBodyStr;
    if (reqBodyStr) {
      const { sanitized, maskedCount } = sanitizeText(reqBodyStr);
      if (maskedCount > 0) {
        console.log(`🛡️ [Goblin Shield] Redacted ${maskedCount} sensitive token(s) from incoming payload -> ${url.pathname}`);
      }
      finalReqBody = sanitized;
    }

    // Build outbound headers (strips mock headers so upstream never sees them)
    const outboundHeaders = buildOutboundHeaders(req.headers);

    // Pre-extract fallback eligibility info (no body mutation yet)
    const fallbackEligible = isFallbackEligible(method, url.pathname);
    const parsedBody = fallbackEligible ? extractModelFromBody(finalReqBody) : null;
    const primaryModel = parsedBody?.model ?? null;

    try {
      // ── First upstream call ─────────────────────────────────
      const upstreamResp = await fetch(targetUrl, {
        method,
        headers: outboundHeaders,
        body: ["GET", "HEAD"].includes(method) ? undefined : finalReqBody
      });

      // ── Fault injection: override the response status BEFORE the fallback check
      let effectiveStatus = upstreamResp.status;
      if (forceFallback && fallbackEligible) {
        effectiveStatus = mockStatus || 429;
        logFallbackEvent(`🧪 [Goblin Shield Fault-Injection] x-force-fallback=true — treating upstream response as HTTP ${effectiveStatus} (was ${upstreamResp.status}) for model '${primaryModel ?? "?"}'`);
      } else if (mockStatus && fallbackEligible && shouldTriggerFallback(mockStatus)) {
        effectiveStatus = mockStatus;
        logFallbackEvent(`🧪 [Goblin Shield Fault-Injection] x-mock-status=${mockStatus} — simulating upstream HTTP ${mockStatus} for model '${primaryModel ?? "?"}'`);
      }

      // ── Fast path: 2xx → return as-is, no overhead ─────────
      if (!shouldTriggerFallback(effectiveStatus) || !fallbackEligible || !primaryModel || !parsedBody) {
        const respHeaders = buildResponseHeaders(upstreamResp.headers);
        return new Response(upstreamResp.body, {
          status: upstreamResp.status,
          statusText: upstreamResp.statusText,
          headers: respHeaders
        });
      }

      // ── Fallback path: try candidates in array sequentially ──
      try { await upstreamResp.body?.cancel(); } catch { /* ignore */ }

      const candidates = resolveFallbackCandidates(primaryModel);

      if (candidates.length === 0) {
        logFallbackEvent(`⚠️ [Goblin Shield Fallback] Primary model '${primaryModel}' hit HTTP ${effectiveStatus} but NO fallback models configured — passing through upstream error`);
        const respHeaders = buildResponseHeaders(upstreamResp.headers);
        return new Response(upstreamResp.body, {
          status: upstreamResp.status,
          statusText: upstreamResp.statusText,
          headers: respHeaders
        });
      }

      let lastRetryResp: Response | null = null;
      let successfulFallbackModel: string | null = null;

      for (let index = 0; index < candidates.length; index++) {
        const candidateModel = candidates[index];
        const fallbackBody = buildFallbackBody(parsedBody.parsed, candidateModel);
        if (!fallbackBody) {
          logFallbackEvent(`❌ [Goblin Shield Fallback] Failed to serialize fallback body for candidate '${candidateModel}'`);
          continue;
        }

        logFallbackEvent(`⚠️ [Goblin Shield Fallback Attempt ${index + 1}/${candidates.length}] Primary '${primaryModel}' hit HTTP ${effectiveStatus} -> Retrying with candidate '${candidateModel}'...`);

        const retryResp = await executeFallback(targetUrl, method, outboundHeaders, fallbackBody);
        lastRetryResp = retryResp;

        if (retryResp.ok || !shouldTriggerFallback(retryResp.status)) {
          successfulFallbackModel = candidateModel;
          logFallbackEvent(`✅ [Goblin Shield Fallback Success] Candidate '${candidateModel}' succeeded with HTTP ${retryResp.status} (attempt ${index + 1}/${candidates.length})`);
          break;
        } else {
          logFallbackEvent(`❌ [Goblin Shield Fallback Attempt ${index + 1}/${candidates.length} Failed] Candidate '${candidateModel}' returned HTTP ${retryResp.status}`);
          try { await retryResp.body?.cancel(); } catch { /* ignore */ }
        }
      }

      if (lastRetryResp && successfulFallbackModel) {
        const respHeaders = buildResponseHeaders(lastRetryResp.headers);
        respHeaders.set("X-Goblin-Shield-Fallback", `primary=${primaryModel}; fallback=${successfulFallbackModel}; trigger=${effectiveStatus}`);
        return new Response(lastRetryResp.body, {
          status: lastRetryResp.status,
          statusText: lastRetryResp.statusText,
          headers: respHeaders
        });
      }

      // If all candidates in array failed
      logFallbackEvent(`💥 [Goblin Shield Fallback Exhausted] All ${candidates.length} candidate(s) for primary '${primaryModel}' failed.`);
      if (lastRetryResp) {
        const respHeaders = buildResponseHeaders(lastRetryResp.headers);
        return new Response(lastRetryResp.body, {
          status: lastRetryResp.status,
          statusText: lastRetryResp.statusText,
          headers: respHeaders
        });
      }
    } catch (err: any) {
      console.error(`❌ [Goblin Shield Error] Upstream connection failed (${targetUrl}):`, err.message);
      return new Response(JSON.stringify({
        error: "Goblin Shield Interceptor Connection Error",
        details: err.message
      }), {
        status: 502,
        headers: { "content-type": "application/json" }
      });
    }
  }
});
