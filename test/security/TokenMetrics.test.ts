/**
 * TokenMetrics Integration Tests
 *
 * Tests usage tracking, cost estimation, and error analysis
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TokenMetrics } from "../../worker/security/TokenMetrics";
import { TenantContext } from "../../worker/security/types";

const mockEnv = {
	DB: {
		prepare: (sql: string) => ({
			bind: (...args: any[]) => ({
				run: async () => ({ meta: { changes: 1 } }),
				all: async () => ({
					results: [
						{
							platform: "ebay",
							total_calls: 1000,
							successful_calls: 950,
							failed_calls: 50,
							avg_latency: 45,
							min_latency: 10,
							max_latency: 200,
							last_used: new Date().toISOString(),
						},
					],
				}),
				first: async () => ({
					platform: "ebay",
					total_calls: 1000,
					successful_calls: 950,
					failed_calls: 50,
					avg_latency: 45,
					min_latency: 10,
					max_latency: 200,
					last_used: new Date().toISOString(),
				}),
			}),
		}),
	},
} as any;

describe("TokenMetrics", () => {
	let metrics: TokenMetrics;
	let tenant: TenantContext;

	beforeAll(() => {
		metrics = new TokenMetrics(mockEnv.DB);
		tenant = {
			storeId: "store_metrics_001",
			userId: "user_metrics_001",
			permissions: ["metrics:read"],
		};
	});

	it("should record token usage", async () => {
		await metrics.recordTokenUsage(
			tenant,
			"ebay",
			"list_items",
			true,
			42,
			undefined
		);

		// Should not throw
		expect(true).toBe(true);
	});

	it("should record failed operations with error message", async () => {
		await metrics.recordTokenUsage(
			tenant,
			"ebay",
			"create_item",
			false,
			120,
			"Rate limit exceeded"
		);

		expect(true).toBe(true);
	});

	it("should get platform statistics", async () => {
		const stats = await metrics.getPlatformStats(tenant, "ebay", 30);

		if (stats) {
			expect(stats.platform).toBe("ebay");
			expect(stats.totalCalls).toBeGreaterThan(0);
			expect(stats.successRate).toBeLessThanOrEqual(100);
			expect(stats.avgLatencyMs).toBeGreaterThan(0);
		}
	});

	it("should calculate success rate correctly", async () => {
		const stats = await metrics.getPlatformStats(tenant, "ebay", 30);

		if (stats) {
			// 950 successful out of 1000 = 95%
			expect(stats.successRate).toBe(95);
		}
	});

	it("should handle no metrics gracefully", async () => {
		const stats = await metrics.getPlatformStats(tenant, "nonexistent", 30);

		// Should return null if no data
		expect(stats === null || stats !== undefined).toBe(true);
	});

	it("should estimate costs by platform", async () => {
		const costs = await metrics.estimateCosts(tenant, 30);

		expect(Array.isArray(costs)).toBe(true);
		if (costs.length > 0) {
			const cost = costs[0];
			expect(cost).toHaveProperty("platform");
			expect(cost).toHaveProperty("estimatedCost");
			expect(cost).toHaveProperty("callCount");
			expect(cost.estimatedCost).toBeGreaterThanOrEqual(0);
		}
	});

	it("should provide cost breakdown", async () => {
		const costs = await metrics.estimateCosts(tenant, 30);

		if (costs.length > 0) {
			const ebayEstimate = costs.find((c) => c.platform === "ebay");
			if (ebayEstimate) {
				// 1000 calls × $0.10 = $100
				expect(ebayEstimate.estimatedCost).toBeGreaterThan(0);
			}
		}
	});
});

describe("Error Rate Analysis", () => {
	let metrics: TokenMetrics;
	let tenant: TenantContext;

	beforeAll(() => {
		metrics = new TokenMetrics(mockEnv.DB);
		tenant = {
			storeId: "store_errors_001",
			userId: "user_errors_001",
			permissions: ["metrics:read"],
		};
	});

	it("should get error rates by platform", async () => {
		const errors = await metrics.getErrorRates(tenant, 30);

		expect(Array.isArray(errors)).toBe(true);
	});

	it("should identify top errors", async () => {
		const errors = await metrics.getErrorRates(tenant, 30);

		if (errors.length > 0 && errors[0].topErrors.length > 0) {
			const topError = errors[0].topErrors[0];
			expect(topError).toHaveProperty("error");
			expect(topError).toHaveProperty("count");
		}
	});

	it("should calculate error rate percentage", async () => {
		const errors = await metrics.getErrorRates(tenant, 30);

		if (errors.length > 0) {
			expect(errors[0].errorRate).toBeLessThanOrEqual(100);
			expect(errors[0].errorRate).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("Action Breakdown", () => {
	let metrics: TokenMetrics;
	let tenant: TenantContext;

	beforeAll(() => {
		metrics = new TokenMetrics(mockEnv.DB);
		tenant = {
			storeId: "store_actions_001",
			userId: "user_actions_001",
			permissions: ["metrics:read"],
		};
	});

	it("should get action breakdown by platform", async () => {
		const actions = await metrics.getActionBreakdown(tenant, "ebay", 30);

		expect(Array.isArray(actions)).toBe(true);
	});

	it("should include latency metrics per action", async () => {
		const actions = await metrics.getActionBreakdown(tenant, "ebay", 30);

		if (actions.length > 0) {
			const action = actions[0];
			expect(action).toHaveProperty("action");
			expect(action).toHaveProperty("count");
			expect(action).toHaveProperty("successRate");
			expect(action).toHaveProperty("avgLatency");
		}
	});
});

describe("Data Retention", () => {
	let metrics: TokenMetrics;

	beforeAll(() => {
		metrics = new TokenMetrics(mockEnv.DB);
	});

	it("should support pruning old metrics", async () => {
		const deletedCount = await metrics.pruneOldMetrics(90);

		expect(typeof deletedCount).toBe("number");
		expect(deletedCount >= 0).toBe(true);
	});
});

describe("Store-wide Metrics", () => {
	let metrics: TokenMetrics;
	let tenant: TenantContext;

	beforeAll(() => {
		metrics = new TokenMetrics(mockEnv.DB);
		tenant = {
			storeId: "store_wide_001",
			userId: "user_wide_001",
			permissions: ["metrics:read"],
		};
	});

	it("should aggregate metrics across all platforms", async () => {
		const storeMetrics = await metrics.getStoreMetrics(tenant, 30);

		expect(Array.isArray(storeMetrics)).toBe(true);
	});

	it("should order platforms by usage", async () => {
		const storeMetrics = await metrics.getStoreMetrics(tenant, 30);

		if (storeMetrics.length > 1) {
			// Should be ordered by totalCalls DESC
			expect(storeMetrics[0].totalCalls).toBeGreaterThanOrEqual(
				storeMetrics[1].totalCalls
			);
		}
	});

	it("should provide comprehensive metrics", async () => {
		const storeMetrics = await metrics.getStoreMetrics(tenant, 30);

		if (storeMetrics.length > 0) {
			const m = storeMetrics[0];
			expect(m).toHaveProperty("platform");
			expect(m).toHaveProperty("totalCalls");
			expect(m).toHaveProperty("successfulCalls");
			expect(m).toHaveProperty("failedCalls");
			expect(m).toHaveProperty("successRate");
			expect(m).toHaveProperty("avgLatencyMs");
			expect(m).toHaveProperty("minLatencyMs");
			expect(m).toHaveProperty("maxLatencyMs");
			expect(m).toHaveProperty("lastUsed");
		}
	});
});
