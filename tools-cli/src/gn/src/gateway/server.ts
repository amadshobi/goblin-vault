/**
 * ─────────────────────────────────────────────────────────────
 * Goblin Nexus — Master Gateway Interceptor Server
 * ─────────────────────────────────────────────────────────────
 */

import { calculateCost } from "../../telemetry/pricing";
import { logTelemetry } from "../../telemetry/db";
import { GN_VERSION } from "../version";
import {
	computePromptHash,
	formatCachedStreamChunks,
	PromptCacheManager,
} from "./cache";
import {
	buildFallbackBody,
	extractModelFromBody,
	recordModelFailure,
	recordModelSuccess,
	resolveFallbackCandidates,
	shouldTriggerFallback,
} from "./circuit-breaker";
import {
	DEFAULT_FALLBACK,
	loadGatewayRules,
	loadPrivacyHeaders,
} from "./rules";
import { FixtureManager } from "./replay";
import { sanitizeText, normalizeUpstreamTools } from "./sanitizer";
import { AccessLogManager, type FallbackHop } from "./access-log";
import type { GatewayServerConfig, GatewayStats } from "./types";

export function createGatewayServer(
	customConfig: Partial<GatewayServerConfig> = {},
) {
	const config: GatewayServerConfig = {
		port:
			customConfig.port ?? parseInt(process.env.GN_GATEWAY_PORT || "4010", 10),
		targetHost:
			customConfig.targetHost ??
			(process.env.GN_GATEWAY_TARGET_HOST || "127.0.0.1"),
		targetPort:
			customConfig.targetPort ??
			parseInt(process.env.GN_GATEWAY_TARGET_PORT || "4000", 10),
		cacheEnabled: customConfig.cacheEnabled ?? true,
		cacheTtlMs: customConfig.cacheTtlMs ?? 2 * 60 * 60 * 1000,
		cacheDir: customConfig.cacheDir ?? "",
		fixturesDir: customConfig.fixturesDir ?? "",
		mode: customConfig.mode ?? "live",
		mockFixtureFile: customConfig.mockFixtureFile,
		shieldEnabled: customConfig.shieldEnabled ?? true,
		sanitizeLogsOnly: customConfig.sanitizeLogsOnly ?? false,
	};

	const startTime = Date.now();
	const rules = loadGatewayRules();
	const privacyHeaders = loadPrivacyHeaders();
	const cacheManager = new PromptCacheManager(
		config.cacheDir ? config.cacheDir : undefined,
		config.cacheTtlMs,
	);
	const fixtureManager = new FixtureManager(
		config.fixturesDir ? config.fixturesDir : undefined,
	);
	const accessLog = new AccessLogManager();

	const stats: GatewayStats = {
		uptimeSeconds: 0,
		totalRequests: 0,
		cacheHits: 0,
		cacheMisses: 0,
		fallbacksTriggered: 0,
		activeStreams: 0,
		errorsCount: 0,
		mode: config.mode,
	};

	let serverInstance: any = null;

	function splitProviderModel(model: string): {
		provider: string;
		model: string;
	} {
		if (!model || typeof model !== "string")
			return { provider: "unknown", model: "unknown" };
		const slashIdx = model.indexOf("/");
		if (slashIdx > 0 && slashIdx < model.length - 1) {
			return {
				provider: model.slice(0, slashIdx),
				model: model.slice(slashIdx + 1),
			};
		}
		return { provider: "unknown", model };
	}

	function fireTelemetry(
		modelString: string,
		bodyText: string,
		statusCode: number,
		latencyMs: number,
	) {
		try {
			const parsed = JSON.parse(bodyText);
			const usage = parsed?.usage;
			if (!usage) return;

			const { provider, model } = splitProviderModel(modelString);
			const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
			const completionTokens =
				usage.completion_tokens ?? usage.output_tokens ?? 0;
			const cacheReadTokens =
				usage.prompt_tokens_details?.cached_tokens ??
				usage.cache_read_input_tokens ??
				0;
			const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
			const totalTokens =
				usage.total_tokens ??
				promptTokens + completionTokens + cacheReadTokens + cacheWriteTokens;

			const cost = calculateCost(
				provider,
				model,
				promptTokens,
				completionTokens,
				cacheReadTokens + cacheWriteTokens,
			);

			logTelemetry({
				provider,
				model,
				clientApp: "gn-gateway",
				promptTokens,
				completionTokens,
				cacheReadTokens,
				cacheWriteTokens,
				totalTokens,
				costUsd: cost.total,
				latencyMs,
				statusCode,
				timestamp: Date.now(),
			});
		} catch {
			// Best-effort
		}
	}

	function buildOutboundHeaders(reqHeaders: Headers): Headers {
		const outbound = new Headers(reqHeaders);
		outbound.delete("host");
		// Strip internal & mock headers
		outbound.delete("x-mock-status");
		outbound.delete("x-force-fallback");
		outbound.delete("X-Mock-Status");
		outbound.delete("X-Force-Fallback");
		outbound.delete("x-gn-no-cache");
		outbound.delete("X-GN-No-Cache");
		outbound.delete("x-gn-fixture");
		outbound.delete("X-GN-Fixture");

		for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
			outbound.set(hKey, hVal);
		}
		return outbound;
	}

	function buildResponseHeaders(upstreamHeaders: Headers): Headers {
		const respHeaders = new Headers(upstreamHeaders);
		for (const [hKey, hVal] of Object.entries(privacyHeaders)) {
			respHeaders.set(hKey, hVal);
		}
		return respHeaders;
	}

	const server = {
		getStats(): GatewayStats {
			return {
				...stats,
				uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
			};
		},

		stop() {
			if (serverInstance) {
				serverInstance.stop(true);
				serverInstance = null;
			}
		},

		start() {
			serverInstance = Bun.serve({
				port: config.port,
				hostname: "127.0.0.1",
				idleTimeout: 255, // Max Bun idleTimeout (255s) to accommodate upstream long-lived SSE streams
				async fetch(req) {
					stats.totalRequests++;
					const reqStartTime = Date.now();
					const url = new URL(req.url);
					const method = req.method.toUpperCase();

					// Health / Status Endpoints
					if (url.pathname === "/health" || url.pathname === "/gn/health") {
						return new Response(
							JSON.stringify({
								status: "ok",
								version: GN_VERSION,
								port: config.port,
								target: `http://${config.targetHost}:${config.targetPort}`,
								uptime: Math.floor((Date.now() - startTime) / 1000),
								mode: config.mode,
								cacheEnabled: config.cacheEnabled,
								shieldEnabled: config.shieldEnabled,
							}),
							{
								status: 200,
								headers: { "content-type": "application/json" },
							},
						);
					}

					if (url.pathname === "/gn/stats") {
						return new Response(JSON.stringify(server.getStats(), null, 2), {
							status: 200,
							headers: { "content-type": "application/json" },
						});
					}

					// Mock mode handler
					if (config.mode === "mock" && config.mockFixtureFile) {
						let bodyObj: any = null;
						try {
							bodyObj = await req.json();
						} catch {
							bodyObj = {};
						}
						const mocked = fixtureManager.mock(config.mockFixtureFile, bodyObj);
						if (mocked) return mocked;
					}

					const targetUrl = `http://${config.targetHost}:${config.targetPort}${url.pathname}${url.search}`;
					const noCacheHeader =
						req.headers.get("x-gn-no-cache") ||
						req.headers.get("X-GN-No-Cache");
					const forceNoCache =
						noCacheHeader === "true" || noCacheHeader === "1";

					let reqBodyStr = "";
					if (req.body) {
						reqBodyStr = await req.text();
					}

					// Shield sanitization
					let finalReqBody = reqBodyStr;
					let maskedTokensCount = 0;
					if (config.shieldEnabled && !config.sanitizeLogsOnly && reqBodyStr) {
						const { sanitized, maskedCount } = sanitizeText(reqBodyStr, rules);
						maskedTokensCount = maskedCount;
						if (maskedCount > 0) {
							console.log(
								`🛡️  [GN Gateway Shield] Redacted ${maskedCount} token(s) from incoming payload -> ${url.pathname}`,
							);
						}
						finalReqBody = sanitized;
					}

					const outboundHeaders = buildOutboundHeaders(req.headers);
					const isLlmEndpoint =
						url.pathname.includes("/chat/completions") ||
						url.pathname.includes("/messages");
					const parsedBodyInfo = isLlmEndpoint
						? extractModelFromBody(finalReqBody)
						: null;
					let primaryModel = parsedBodyInfo?.model ?? null;
					const initialModel = primaryModel ?? "unknown";
					const isStreamReq = parsedBodyInfo?.parsed?.stream === true;
					const fallbackChain: FallbackHop[] = [];

					// Upstream tool schema normalization (e.g. CommandCode Anthropic tools)
					if (isLlmEndpoint && finalReqBody) {
						finalReqBody = normalizeUpstreamTools(
							finalReqBody,
							targetUrl,
							initialModel,
						);
					}

					// Caching check
					let promptHash = "";
					if (
						config.cacheEnabled &&
						!forceNoCache &&
						isLlmEndpoint &&
						parsedBodyInfo?.parsed
					) {
						promptHash = computePromptHash(parsedBodyInfo.parsed);
						const cached = cacheManager.get(promptHash);

						if (cached) {
							stats.cacheHits++;
							const respHeaders = new Headers(cached.meta.headers || {});
							respHeaders.set("X-GN-Cache", "HIT");
							respHeaders.set("X-GN-Cache-Hash", promptHash);

							accessLog.write({
								ts: reqStartTime,
								method,
								path: url.pathname,
								initialModel,
								servedModel: cached.meta.model || primaryModel || "unknown",
								status: cached.meta.status || 200,
								latencyMs: Date.now() - reqStartTime,
								cache: "HIT",
								stream: cached.isStream,
								shieldRedacted: maskedTokensCount,
							});

							if (cached.isStream && cached.chunks.length > 0) {
								respHeaders.set(
									"content-type",
									"text/event-stream; charset=utf-8",
								);
								respHeaders.set("cache-control", "no-cache");
								respHeaders.set("connection", "keep-alive");
								respHeaders.set("x-accel-buffering", "no");

								const stream = formatCachedStreamChunks(cached.chunks);
								return new Response(stream, {
									status: cached.meta.status || 200,
									headers: respHeaders,
								});
							} else {
								return new Response(cached.body || "", {
									status: cached.meta.status || 200,
									headers: respHeaders,
								});
							}
						} else {
							stats.cacheMisses++;
						}
					}

					// Upstream forwarder with abort propagation & TTFB timeout (15s)
					const abortController = new AbortController();
					if (req.signal) {
						req.signal.addEventListener("abort", () => {
							abortController.abort();
						});
					}

					try {
						const TTFB_TIMEOUT_MS = 15_000;
						let timeoutId: any = null;
						const timeoutPromise = new Promise<never>((_, reject) => {
							timeoutId = setTimeout(() => {
								abortController.abort();
								reject(new Error("TTFB_TIMEOUT"));
							}, TTFB_TIMEOUT_MS);
						});

						let upstreamResp: Response;
						try {
							upstreamResp = await Promise.race([
								fetch(targetUrl, {
									method,
									headers: outboundHeaders,
									body: ["GET", "HEAD"].includes(method)
										? undefined
										: finalReqBody,
									signal: abortController.signal,
								}),
								timeoutPromise,
							]);
						} catch (fetchErr: any) {
							if (fetchErr.message === "TTFB_TIMEOUT") {
								// Mock 504 Gateway Timeout for fallback eligibility
								upstreamResp = new Response(
									JSON.stringify({ error: "Gateway TTFB Timeout" }),
									{
										status: 504,
										headers: { "content-type": "application/json" },
									},
								);
							} else {
								throw fetchErr;
							}
						} finally {
							if (timeoutId) clearTimeout(timeoutId);
						}

						let effectiveStatus = upstreamResp.status;
						let fallbackUsedInfo: string | null = null;

						// Check if fallback applies
						const fallbackEligible =
							isLlmEndpoint && Boolean(primaryModel) && Boolean(parsedBodyInfo);

						if (
							fallbackEligible &&
							shouldTriggerFallback(
								effectiveStatus,
								rules.fallback || DEFAULT_FALLBACK,
							)
						) {
							stats.fallbacksTriggered++;
							recordModelFailure(primaryModel!);
							fallbackChain.push({
								model: primaryModel!,
								status: effectiveStatus,
								ok: false,
							});
							try {
								await upstreamResp.body?.cancel();
							} catch {
								/* noop */
							}

							const candidates = resolveFallbackCandidates(
								primaryModel!,
								rules.fallback || DEFAULT_FALLBACK,
							);
							let fallbackResp: Response | null = null;
							let successfulCandidate: string | null = null;

							for (const candidate of candidates) {
								const fallbackBody = buildFallbackBody(
									parsedBodyInfo!.parsed,
									candidate,
								);
								if (!fallbackBody) continue;

								try {
									const retryResp = await fetch(targetUrl, {
										method,
										headers: outboundHeaders,
										body: fallbackBody,
										signal: abortController.signal,
									});

									if (
										retryResp.ok ||
										!shouldTriggerFallback(
											retryResp.status,
											rules.fallback || DEFAULT_FALLBACK,
										)
									) {
										fallbackChain.push({
											model: candidate,
											status: retryResp.status,
											ok: true,
										});
										fallbackResp = retryResp;
										successfulCandidate = candidate;
										recordModelSuccess(candidate);
										break;
									} else {
										fallbackChain.push({
											model: candidate,
											status: retryResp.status,
											ok: false,
										});
										recordModelFailure(candidate);
										try {
											await retryResp.body?.cancel();
										} catch {
											/* noop */
										}
									}
								} catch {
									fallbackChain.push({
										model: candidate,
										status: 500,
										ok: false,
									});
									recordModelFailure(candidate);
								}
							}

							if (fallbackResp && successfulCandidate) {
								fallbackUsedInfo = `primary=${primaryModel}; fallback=${successfulCandidate}; trigger=${effectiveStatus}`;
								upstreamResp = fallbackResp;
								primaryModel = successfulCandidate;
							}
						} else if (primaryModel && upstreamResp.ok) {
							recordModelSuccess(primaryModel);
						}

						// Normal Streaming or Standard response
						const respHeaders = buildResponseHeaders(upstreamResp.headers);
						if (fallbackUsedInfo) {
							respHeaders.set("X-GN-Fallback", fallbackUsedInfo);
						}
						if (promptHash) {
							respHeaders.set("X-GN-Cache", "MISS");
							respHeaders.set("X-GN-Cache-Hash", promptHash);
						}

						// If streaming response
						const contentType = upstreamResp.headers.get("content-type") || "";
						const isMessagesReq = url.pathname.includes("/messages");
						const isStreamingResponse =
							(contentType.includes("text/event-stream") || isStreamReq) &&
							(!isMessagesReq || isStreamReq || contentType.includes("text/event-stream"));

						if (isStreamingResponse && upstreamResp.body) {
							stats.activeStreams++;
							const reader = upstreamResp.body.getReader();
							const decoder = new TextDecoder();
							const encoder = new TextEncoder();
							const recordedChunks: string[] = [];
							let hasUsageChunk = false;
							let streamedContentLength = 0;

							// Approximate prompt token size from input payload
							const approxPromptTokens = Math.max(
								1,
								Math.ceil((reqBodyStr?.length || 100) / 3.8),
							);

							const stream = new ReadableStream({
								async pull(controller) {
									try {
										const { done, value } = await reader.read();
										if (done) {
											// If upstream did not provide a usage chunk (e.g. CommandCode for OpenAI chat completions)
											if (!hasUsageChunk && upstreamResp.ok && !isMessagesReq) {
												const approxCompletionTokens = Math.max(
													1,
													Math.ceil(streamedContentLength / 3.5),
												);
												const usagePayload = {
													id: "chatcmpl-gn-usage",
													object: "chat.completion.chunk",
													created: Math.floor(Date.now() / 1000),
													model: primaryModel || initialModel,
													choices: [],
													usage: {
														prompt_tokens: approxPromptTokens,
														completion_tokens: approxCompletionTokens,
														total_tokens:
															approxPromptTokens + approxCompletionTokens,
													},
												};
												const usageChunkStr = `data: ${JSON.stringify(usagePayload)}\n\n`;
												recordedChunks.push(usageChunkStr);
												controller.enqueue(encoder.encode(usageChunkStr));

												// Fire telemetry for stream
												fireTelemetry(
													primaryModel || initialModel,
													JSON.stringify({
														usage: {
															prompt_tokens: approxPromptTokens,
															completion_tokens: approxCompletionTokens,
															total_tokens:
																approxPromptTokens + approxCompletionTokens,
														},
													}),
													upstreamResp.status,
													Date.now() - reqStartTime,
												);
											}

											stats.activeStreams = Math.max(
												0,
												stats.activeStreams - 1,
											);
											controller.close();

											// Cache streamed response chunks
											if (
												config.cacheEnabled &&
												promptHash &&
												recordedChunks.length > 0 &&
												upstreamResp.ok
											) {
												const headerObj: Record<string, string> = {};
												respHeaders.forEach((v, k) => {
													headerObj[k] = v;
												});
												cacheManager.set(
													promptHash,
													{
														model: primaryModel || "unknown",
														status: upstreamResp.status,
														headers: headerObj,
														isStream: true,
														totalChunks: recordedChunks.length,
													},
													recordedChunks,
													config.cacheTtlMs,
												);
											}

											// Catat access log untuk streaming selesai
											accessLog.write({
												ts: reqStartTime,
												method,
												path: url.pathname,
												initialModel: initialModel || "unknown",
												servedModel: primaryModel || initialModel || "unknown",
												status: upstreamResp.status,
												latencyMs: Date.now() - reqStartTime,
												cache: promptHash ? "MISS" : "BYPASS",
												stream: true,
												fallback:
													fallbackChain.length > 1
														? {
																chain: fallbackChain,
																hopCount: fallbackChain.length,
															}
														: undefined,
												shieldRedacted: maskedTokensCount,
											});

											// Record fixture if in record mode
											if (config.mode === "record") {
												const recordedReqBody = config.shieldEnabled
													? sanitizeText(
															JSON.stringify(parsedBodyInfo?.parsed || {}),
															rules,
														).sanitized
													: parsedBodyInfo?.parsed;

												fixtureManager.record(
													config.mockFixtureFile || "default-session",
													{
														url: url.pathname,
														method,
														model: primaryModel || undefined,
														body:
															typeof recordedReqBody === "string"
																? JSON.parse(recordedReqBody)
																: recordedReqBody,
													},
													{
														status: upstreamResp.status,
														headers: {},
														isStream: true,
														chunks: recordedChunks,
													},
												);
											}

											return;
										}

										if (value) {
											const text = decoder.decode(value, { stream: true });
											recordedChunks.push(text);
											if (
												text.includes('"usage":') ||
												text.includes('"prompt_tokens":')
											) {
												hasUsageChunk = true;
											}
											streamedContentLength += text.length;
											controller.enqueue(value);
										}
									} catch (err) {
										stats.activeStreams = Math.max(0, stats.activeStreams - 1);
										controller.error(err);
									}
								},
								cancel() {
									stats.activeStreams = Math.max(0, stats.activeStreams - 1);
									reader.cancel();
									abortController.abort();
								},
							});

							return new Response(stream, {
								status: upstreamResp.status,
								statusText: upstreamResp.statusText,
								headers: respHeaders,
							});
						}

						// Non-streaming response: read body text safely to eliminate race conditions
						const bodyText = await upstreamResp.text();
						const latency = Date.now() - reqStartTime;

						if (primaryModel && upstreamResp.ok) {
							fireTelemetry(
								primaryModel,
								bodyText,
								upstreamResp.status,
								latency,
							);
						}

						// Catat access log untuk non-streaming request
						accessLog.write({
							ts: reqStartTime,
							method,
							path: url.pathname,
							initialModel: initialModel || "unknown",
							servedModel: primaryModel || initialModel || "unknown",
							status: upstreamResp.status,
							latencyMs: latency,
							cache: promptHash ? "MISS" : "BYPASS",
							stream: false,
							fallback:
								fallbackChain.length > 1
									? {
											chain: fallbackChain,
											hopCount: fallbackChain.length,
										}
									: undefined,
							shieldRedacted: maskedTokensCount,
						});

						if (config.cacheEnabled && promptHash && upstreamResp.ok) {
							const headerObj: Record<string, string> = {};
							respHeaders.forEach((v, k) => {
								headerObj[k] = v;
							});
							cacheManager.set(
								promptHash,
								{
									model: primaryModel || "unknown",
									status: upstreamResp.status,
									headers: headerObj,
									isStream: false,
								},
								bodyText,
								config.cacheTtlMs,
							);
						}

						if (config.mode === "record") {
							const recordedReqBody = config.shieldEnabled
								? sanitizeText(
										JSON.stringify(parsedBodyInfo?.parsed || {}),
										rules,
									).sanitized
								: parsedBodyInfo?.parsed;

							fixtureManager.record(
								config.mockFixtureFile || "default-session",
								{
									url: url.pathname,
									method,
									model: primaryModel || undefined,
									body:
										typeof recordedReqBody === "string"
											? JSON.parse(recordedReqBody)
											: recordedReqBody,
								},
								{
									status: upstreamResp.status,
									headers: {},
									isStream: false,
									body: bodyText,
								},
							);
						}

						return new Response(bodyText, {
							status: upstreamResp.status,
							statusText: upstreamResp.statusText,
							headers: respHeaders,
						});
					} catch (err: any) {
						stats.errorsCount++;
						accessLog.write({
							ts: reqStartTime,
							method,
							path: url.pathname,
							initialModel: initialModel || "unknown",
							servedModel: primaryModel || initialModel || "unknown",
							status: 502,
							latencyMs: Date.now() - reqStartTime,
							cache: "NONE",
							stream: isStreamReq,
							fallback:
								fallbackChain.length > 1
									? {
											chain: fallbackChain,
											hopCount: fallbackChain.length,
										}
									: undefined,
							shieldRedacted: maskedTokensCount,
							error: err.message,
						});
						return new Response(
							JSON.stringify({
								error: "GN Gateway Connection Error",
								details: err.message,
								target: targetUrl,
							}),
							{
								status: 502,
								headers: { "content-type": "application/json" },
							},
						);
					}
				},
			});

			return serverInstance;
		},
	};

	return server;
}
