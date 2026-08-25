/**
 * ─────────────────────────────────────────────────────────────
 * Goblin Nexus — Gateway Privacy & Sanitizer Engine
 * ─────────────────────────────────────────────────────────────
 */

import type { GatewayRules } from "./types";

export interface SanitizeResult {
	sanitized: string;
	maskedCount: number;
}

/**
 * Redact sensitive tokens in text based on GatewayRules patterns.
 * Never mutates original text. Returns new string and masked count.
 */
export function sanitizeText(
	text: string,
	rules: GatewayRules,
): SanitizeResult {
	if (
		!rules.enabled ||
		!rules.patterns ||
		rules.patterns.length === 0 ||
		!text
	) {
		return { sanitized: text, maskedCount: 0 };
	}

	let maskedCount = 0;
	let result = text;
	const replacement = rules.redact_replacement || "[REDACTED]";

	for (const rule of rules.patterns) {
		// Instantiate fresh RegExp per invocation to prevent shared state race condition with /g flag
		const reg = rule.regex ? new RegExp(rule.regex, "g") : undefined;
		if (!reg) continue;
		const matches = result.match(reg);
		if (matches && matches.length > 0) {
			maskedCount += matches.length;
			result = result.replace(reg, replacement);
		}
	}

	return { sanitized: result, maskedCount };
}
