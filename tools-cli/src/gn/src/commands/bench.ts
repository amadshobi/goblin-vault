import { readGnCache, writeGnCache, getGnCacheFilePath } from "../utils/paths";
import {
	printGnHeader,
	formatTable,
	ANSI_BOLD,
	ANSI_RESET,
	ANSI_GRAY,
	ANSI_CYAN,
	ANSI_GREEN,
	ANSI_RED,
	ANSI_YELLOW,
} from "../utils/formatter";

export interface BenchModelMetric {
	model: string;
	status: "OK" | "FAIL" | "RATELIMIT" | "TIMEOUT";
	statusCode: number;
	latencyMs: number;
	tokensPerSec: number;
	completionTokens: number;
	logLine?: string;
}

export interface BenchCachePayload {
	timestamp: number;
	provider: string;
	engineVersion: string;
	metrics: {
		totalTested: number;
		successful: number;
		failed: number;
		avgLatencyMs: number;
		avgTokensPerSec: number;
	};
	results: {
		logLines: string[];
		models: BenchModelMetric[];
	};
}

async function runLiveBenchmark(
	provider: string,
	runs: number,
): Promise<BenchCachePayload> {
	const logLines: string[] = [];
	const models: BenchModelMetric[] = [];

	let totalTested = 0;
	let successful = 0;
	let failed = 0;
	let totalLatency = 0;
	let totalTokPerSec = 0;

	try {
		const res = await fetch("http://127.0.0.1:4000/v1/models", {
			signal: AbortSignal.timeout(3000),
		});
		if (!res.ok) {
			logLines.push(
				`  💥 [FAIL]        OMP Gateway models query      | 🛑 HTTP ${res.status}`,
			);
			return {
				timestamp: Date.now(),
				provider,
				engineVersion: "2.0.0",
				metrics: {
					totalTested: 0,
					successful: 0,
					failed: 0,
					avgLatencyMs: 0,
					avgTokensPerSec: 0,
				},
				results: { logLines, models },
			};
		}

		const data = (await res.json()) as {
			data?: Array<{ id: string; owned_by?: string }>;
		};
		const allModels = data.data || [];
		const filtered = allModels.filter((m) => {
			const owned = (m.owned_by || "").toLowerCase();
			const id = (m.id || "").toLowerCase();
			const provLower = provider.toLowerCase();
			return (
				provLower === "all" ||
				owned.includes(provLower) ||
				id.startsWith(provLower + "/")
			);
		});

		const targetList =
			filtered.length > 0
				? filtered.slice(0, 10)
				: [{ id: "google-antigravity/gemini-3.6-flash" }];

		for (const item of targetList) {
			totalTested++;
			const start = Bun.nanoseconds();
			let statusCode = 0;
			let completionTokens = 0;
			let tokPerSec = 0;
			let status: "OK" | "FAIL" | "RATELIMIT" | "TIMEOUT" = "FAIL";

			try {
				let benchRes = await fetch(
					"http://127.0.0.1:4000/v1/chat/completions",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							model: item.id,
							messages: [
								{
									role: "user",
									content:
										"Write a 30-word response testing performance benchmark speed.",
								},
							],
							max_tokens: 60,
						}),
						signal: AbortSignal.timeout(8000),
					},
				);

				// Auto-retry with reasoning_effort: "low" if thinking level MINIMAL is unsupported
				if (benchRes.status === 400) {
					try {
						const errRaw = await benchRes.clone().text();
						if (
							errRaw.toLowerCase().includes("thinking") ||
							errRaw.toLowerCase().includes("reasoning")
						) {
							benchRes = await fetch(
								"http://127.0.0.1:4000/v1/chat/completions",
								{
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										model: item.id,
										messages: [
											{
												role: "user",
												content:
													"Write a 30-word response testing performance benchmark speed.",
											},
										],
										max_tokens: 150,
										reasoning_effort: "low",
									}),
									signal: AbortSignal.timeout(8000),
								},
							);
						}
					} catch {}
				}

				statusCode = benchRes.status;
				const latencyMs = Math.round((Bun.nanoseconds() - start) / 1000000);

				if (benchRes.ok) {
					status = "OK";
					successful++;
					totalLatency += latencyMs;

					const json = (await benchRes.json()) as any;
					completionTokens = json.usage?.completion_tokens || 30;
					tokPerSec = parseFloat(
						(completionTokens / (latencyMs / 1000) || 0).toFixed(1),
					);
					totalTokPerSec += tokPerSec;

					const line = `  ✅ [200 OK]      ${item.id.padEnd(30, " ")} | ⏱️ ${latencyMs.toString().padStart(5, " ")}ms | 🚀 ${tokPerSec.toFixed(1).padStart(5, " ")} tok/s | 📝 ${completionTokens} tokens`;
					logLines.push(line);
					models.push({
						model: item.id,
						status,
						statusCode,
						latencyMs,
						tokensPerSec: tokPerSec,
						completionTokens,
						logLine: line,
					});
				} else {
					failed++;
					status = statusCode === 429 ? "RATELIMIT" : "FAIL";
					const line = `  💥 [${statusCode} FAIL]   ${item.id.padEnd(30, " ")} | 🛑 Error HTTP ${statusCode}`;
					logLines.push(line);
					models.push({
						model: item.id,
						status,
						statusCode,
						latencyMs,
						tokensPerSec: 0,
						completionTokens: 0,
						logLine: line,
					});
				}
			} catch (err: any) {
				failed++;
				const latencyMs = Math.round((Bun.nanoseconds() - start) / 1000000);
				const line = `  💥 [TIMEOUT]     ${item.id.padEnd(30, " ")} | 🛑 Request Timeout / Error`;
				logLines.push(line);
				models.push({
					model: item.id,
					status: "TIMEOUT",
					statusCode: 504,
					latencyMs,
					tokensPerSec: 0,
					completionTokens: 0,
					logLine: line,
				});
			}
		}
	} catch (err: any) {
		logLines.push(
			`  💥 [FAIL]        Could not execute benchmark: ${err.message}`,
		);
	}

	const avgLatencyMs =
		successful > 0 ? Math.round(totalLatency / successful) : 0;
	const avgTokensPerSec =
		successful > 0 ? parseFloat((totalTokPerSec / successful).toFixed(1)) : 0;

	return {
		timestamp: Date.now(),
		provider,
		engineVersion: "2.0.0",
		metrics: {
			totalTested,
			successful,
			failed,
			avgLatencyMs,
			avgTokensPerSec,
		},
		results: {
			logLines,
			models,
		},
	};
}

export async function handleBenchCommand(argv: string[]): Promise<number> {
	const hasJsonFlag = argv.includes("--json");
	const forceFlag = argv.includes("--force") || argv.includes("-f");

	let provider = "google-antigravity";
	let runs = 5;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "-n" || arg === "--runs") {
			const parsed = parseInt(argv[i + 1], 10);
			if (Number.isFinite(parsed) && parsed > 0) runs = parsed;
		} else if (!arg.startsWith("-") && arg !== "bench" && arg !== "b") {
			provider = arg;
		}
	}

	let payload: BenchCachePayload | null = null;
	let isFromCache = false;

	if (!forceFlag) {
		payload = readGnCache<BenchCachePayload>("bench", provider);
		if (payload) {
			isFromCache = true;
		}
	}

	if (!payload || forceFlag) {
		payload = await runLiveBenchmark(provider, runs);
		writeGnCache("bench", provider, payload);
		isFromCache = false;
	}

	if (hasJsonFlag) {
		console.log(JSON.stringify(payload, null, 2));
		return 0;
	}

	const cachePath = getGnCacheFilePath("bench", provider);
	const timeStr = payload.timestamp
		? new Date(payload.timestamp).toLocaleString("id-ID")
		: "Unknown";

	printGnHeader(`BENCHMARK ENGINE — ${provider.toUpperCase()}`);
	console.log(
		`  Source       : ${isFromCache ? `${ANSI_CYAN}CACHE (Instant ~5ms)${ANSI_RESET} [${cachePath}]` : `${ANSI_YELLOW}LIVE BENCHMARK HIT (--force)${ANSI_RESET}`}`,
	);
	console.log(`  Target       : ${provider}`);
	console.log(`  Last Tested  : ${timeStr}`);

	if (payload.metrics) {
		console.log(
			`  Metrics      : ${ANSI_GREEN}${payload.metrics.successful} PASSED${ANSI_RESET} / ${ANSI_RED}${payload.metrics.failed} FAILED${ANSI_RESET} (Total: ${payload.metrics.totalTested})`,
		);
		console.log(
			`  Avg Latency  : ${ANSI_CYAN}${payload.metrics.avgLatencyMs} ms${ANSI_RESET} | Avg Throughput: ${ANSI_BOLD}${payload.metrics.avgTokensPerSec} tok/s${ANSI_RESET}`,
		);
	}
	console.log("");

	if (payload.results && Array.isArray(payload.results.logLines)) {
		payload.results.logLines.forEach((line) => console.log(line));
	} else {
		console.log(`  ${ANSI_GRAY}No benchmark log entries found.${ANSI_RESET}`);
	}

	console.log("");
	if (isFromCache) {
		console.log(
			`  ${ANSI_GRAY}💡 Hint: Jalankan '${ANSI_CYAN}gn bench ${provider} --force${ANSI_GRAY}' untuk nembak live benchmark request & memperbarui cache.${ANSI_RESET}\n`,
		);
	}

	return 0;
}
