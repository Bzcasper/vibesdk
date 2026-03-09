/**
 * Utilities adapted from @cf-vibesdk/sdk for worker use
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class TimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TimeoutError";
	}
}

export async function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	message = "Operation timed out",
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new TimeoutError(message)), ms);
	});
	try {
		return await Promise.race([promise, timeout]);
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
	}
}

export type RetryConfig = {
	enabled?: boolean;
	initialDelayMs?: number;
	maxDelayMs?: number;
	maxRetries?: number;
};

export type NormalizedRetryConfig = Required<RetryConfig>;

export function normalizeRetryConfig(
	retry: RetryConfig | undefined,
	defaults: NormalizedRetryConfig,
): NormalizedRetryConfig {
	return {
		enabled: retry?.enabled ?? defaults.enabled,
		initialDelayMs: retry?.initialDelayMs ?? defaults.initialDelayMs,
		maxDelayMs: retry?.maxDelayMs ?? defaults.maxDelayMs,
		maxRetries: retry?.maxRetries ?? defaults.maxRetries,
	};
}

export function computeBackoffMs(
	attempt: number,
	cfg: NormalizedRetryConfig,
): number {
	const base = Math.min(
		cfg.maxDelayMs,
		cfg.initialDelayMs * Math.pow(2, Math.max(0, attempt)),
	);
	const jitter = base * 0.2;
	return Math.max(0, Math.floor(base - jitter + Math.random() * jitter * 2));
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig = {},
): Promise<T> {
	const cfg = normalizeRetryConfig(config, {
		enabled: true,
		initialDelayMs: 1000,
		maxDelayMs: 10000,
		maxRetries: 3,
	});

	let lastError: Error | undefined;
	for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;
			if (attempt < cfg.maxRetries && cfg.enabled) {
				const delay = computeBackoffMs(attempt, cfg);
				await sleep(delay);
			}
		}
	}
	throw lastError;
}
