/**
 * HTTP Client with retry logic - adapted from @cf-vibesdk/sdk
 */

import { withRetry, type RetryConfig } from "./sdk-utils";

export interface HttpClientOptions {
	baseUrl: string;
	fetchFn?: typeof fetch;
	retry?: RetryConfig;
}

export class HttpClient {
	private baseUrl: string;
	private fetchFn: typeof fetch;
	private retryConfig: RetryConfig;

	constructor(options: HttpClientOptions) {
		this.baseUrl = options.baseUrl.replace(/\/$/, "");
		this.fetchFn = options.fetchFn ?? fetch;
		this.retryConfig = options.retry ?? {
			enabled: true,
			initialDelayMs: 1000,
			maxDelayMs: 10000,
			maxRetries: 3,
		};
	}

	async fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
		const response = await this.fetch(url, init);
		const data = (await response.json()) as T;
		return data;
	}

	async fetch(url: string, init: RequestInit = {}): Promise<Response> {
		const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;

		return withRetry(async () => {
			const response = await this.fetchFn(fullUrl, {
				...init,
				headers: {
					"Content-Type": "application/json",
					...init.headers,
				},
			});

			if (!response.ok) {
				throw new Error(
					`HTTP ${response.status}: ${response.statusText}`,
				);
			}

			return response;
		}, this.retryConfig);
	}
}
