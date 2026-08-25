/**
 * ─────────────────────────────────────────────────────────────
 * Goblin Nexus — Gateway Interceptor Core Types
 * ─────────────────────────────────────────────────────────────
 *
 * Tipe data domain, konfigurasi, dan telemetry untuk GN Gateway
 * Interceptor (Issue #29).
 */

export interface MaskRule {
	name: string;
	regex: string;
	compiled?: RegExp;
}

export interface FallbackConfig {
	enabled: boolean;
	trigger_statuses: number[];
	trigger_status_5xx: boolean;
	fallback_models: Record<string, string | string[]>;
	default_fallback: string | string[];
	endpoints: string[];
}

export interface GatewayRules {
	description?: string;
	enabled: boolean;
	redact_replacement: string;
	patterns: MaskRule[];
	fallback?: FallbackConfig;
}

export interface GatewayHeadersConfig {
	description?: string;
	headers: Record<string, string>;
}

export interface GatewayServerConfig {
	port: number;
	targetHost: string;
	targetPort: number;
	cacheEnabled: boolean;
	cacheTtlMs: number;
	cacheDir: string;
	fixturesDir: string;
	mode: "live" | "record" | "mock";
	mockFixtureFile?: string;
	shieldEnabled: boolean;
	sanitizeLogsOnly: boolean;
}

export interface CacheEntryMetadata {
	hash: string;
	model: string;
	createdAt: number;
	expiresAt: number;
	status: number;
	headers: Record<string, string>;
	isStream: boolean;
	totalChunks?: number;
	promptTokens?: number;
	completionTokens?: number;
}

export interface GatewayStats {
	uptimeSeconds: number;
	totalRequests: number;
	cacheHits: number;
	cacheMisses: number;
	fallbacksTriggered: number;
	activeStreams: number;
	errorsCount: number;
	mode: "live" | "record" | "mock";
}
