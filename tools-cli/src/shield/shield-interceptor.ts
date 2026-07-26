import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Configuration paths
const VAULT_SECURITY_DIR = join(process.env.GOBLIN_VAULT_ROOT || join(process.env.HOME || "", "civil/goblin-vault"), "tools-cli", "src", "shield");
const LEGACY_SECURITY_DIR = join(process.env.HOME || "", ".shell", "security");

const SECURITY_DIR = existsSync(join(VAULT_SECURITY_DIR, "rules.json")) ? VAULT_SECURITY_DIR : LEGACY_SECURITY_DIR;
const RULES_PATH = join(SECURITY_DIR, "rules.json");
const HEADERS_PATH = join(SECURITY_DIR, "privacy-headers.json");

// Default Upstream & Listen Ports
const LISTEN_PORT = parseInt(process.env.SHIELD_LISTEN_PORT || "4002", 10);
const TARGET_PORT = parseInt(process.env.SHIELD_TARGET_PORT || "4000", 10);
const TARGET_HOST = process.env.SHIELD_TARGET_HOST || "127.0.0.1";

interface MaskRule {
  name: string;
  regex: string;
  compiled?: RegExp;
}

interface ShieldRules {
  enabled: boolean;
  redact_replacement: string;
  patterns: MaskRule[];
}

interface ShieldHeaders {
  headers: Record<string, string>;
}

// Load Rules & Headers
let rules: ShieldRules = { enabled: true, redact_replacement: "[REDACTED]", patterns: [] };
let privacyHeaders: Record<string, string> = {};

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

console.log(`🛡️ [Goblin Shield Interceptor Engine] Initializing...`);
console.log(`📡 Listening on: http://127.0.0.1:${LISTEN_PORT}`);
console.log(`🎯 Forwarding to: http://${TARGET_HOST}:${TARGET_PORT}`);
console.log(`🔒 Active Sanitization Rules: ${rules.patterns.length}`);
console.log(`🚫 Zero-Data Headers Injected: ${Object.keys(privacyHeaders).join(", ")}`);

Bun.serve({
  port: LISTEN_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const targetUrl = `http://${TARGET_HOST}:${TARGET_PORT}${url.pathname}${url.search}`;

    // Read Request Body
    let reqBodyStr = "";
    if (req.body) {
      reqBodyStr = await req.text();
    }

    // Sanitize Request Body if any
    let finalReqBody = reqBodyStr;
    if (reqBodyStr) {
      const { sanitized, maskedCount } = sanitizeText(reqBodyStr);
      if (maskedCount > 0) {
        console.log(`🛡️ [Goblin Shield] Redacted ${maskedCount} sensitive token(s) from incoming payload -> ${url.pathname}`);
      }
      finalReqBody = sanitized;
    }

    // Construct Outbound Headers (Inject Privacy Headers & Keep Original Headers)
    const outboundHeaders = new Headers(req.headers);
    outboundHeaders.delete("host"); // Let fetch rewrite host

    // Inject Zero-Data Retention Opt-Out Headers
    for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
      outboundHeaders.set(hKey, hVal);
    }

    try {
      // Forward request to local target (OMP Gateway / Upstream Proxy)
      const upstreamResp = await fetch(targetUrl, {
        method: req.method,
        headers: outboundHeaders,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : finalReqBody
      });

      // Prepare response back to client with Privacy Headers intact
      const respHeaders = new Headers(upstreamResp.headers);
      for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
        respHeaders.set(hKey, hVal);
      }

      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: respHeaders
      });
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
