/**
 * TokenMetrics - Token Usage & Performance Observability
 *
 * Tracks:
 * - API call metrics per platform
 * - Token operation latency
 * - Success/failure rates
 * - Cost tracking
 */

import { D1Database } from "@cloudflare/workers-types";
import { TenantContext } from "./types";

export interface TokenUsageMetric {
	id: string;
	storeId: string;
	userId: string;
	platform: string;
	action: string; // "list_items", "create_item", etc.
	success: boolean;
	durationMs: number;
	errorMessage?: string;
	createdAt: string;
}

export interface PlatformStats {
	platform: string;
	totalCalls: number;
	successfulCalls: number;
	failedCalls: number;
	successRate: number;
	avgLatencyMs: number;
	minLatencyMs: number;
	maxLatencyMs: number;
	lastUsed: string;
}

export interface CostMetrics {
	storeId: string;
	platform: string;
	period: string;
	estimatedCost: number; // In USD
	callCount: number;
	avgLatency: number;
}

export class TokenMetrics {
	constructor(private db: D1Database) {}

	/**
	 * Record token usage metric
	 */
	async recordTokenUsage(
		tenant: TenantContext,
		platform: string,
		action: string,
		success: boolean,
		durationMs: number,
		errorMessage?: string
	): Promise<void> {
		try {
			const metric: TokenUsageMetric = {
				id: crypto.randomUUID(),
				storeId: tenant.storeId,
				userId: tenant.userId,
				platform,
				action,
				success,
				durationMs,
				errorMessage,
				createdAt: new Date().toISOString(),
			};

			await this.db
				.prepare(
					`
				INSERT INTO token_usage_metrics
				(id, store_id, user_id, platform, action, success, duration_ms, error_message, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
				)
				.bind(
					metric.id,
					metric.storeId,
					metric.userId,
					metric.platform,
					metric.action,
					metric.success ? 1 : 0,
					metric.durationMs,
					metric.errorMessage || null,
					metric.createdAt
				)
				.run();
		} catch (error) {
			// Fail silently to avoid breaking operations
			console.error("Failed to record token usage metric:", error);
		}
	}

	/**
	 * Get platform statistics
	 */
	async getPlatformStats(
		tenant: TenantContext,
		platform: string,
		days: number = 30
	): Promise<PlatformStats | null> {
		const result = await this.db
			.prepare(
				`
			SELECT 
				platform,
				COUNT(*) as total_calls,
				SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
				SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls,
				AVG(duration_ms) as avg_latency,
				MIN(duration_ms) as min_latency,
				MAX(duration_ms) as max_latency,
				MAX(created_at) as last_used
			FROM token_usage_metrics
			WHERE store_id = ? AND platform = ? AND created_at > datetime('now', '-${days} days')
			GROUP BY platform
		`
			)
			.bind(tenant.storeId, platform)
			.first<{
				platform: string;
				total_calls: number;
				successful_calls: number;
				failed_calls: number;
				avg_latency: number;
				min_latency: number;
				max_latency: number;
				last_used: string;
			}>();

		if (!result) return null;

		return {
			platform: result.platform,
			totalCalls: result.total_calls,
			successfulCalls: result.successful_calls,
			failedCalls: result.failed_calls,
			successRate:
				result.total_calls > 0
					? (result.successful_calls / result.total_calls) * 100
					: 0,
			avgLatencyMs: Math.round(result.avg_latency),
			minLatencyMs: result.min_latency,
			maxLatencyMs: result.max_latency,
			lastUsed: result.last_used,
		};
	}

	/**
	 * Get all platform statistics for store
	 */
	async getStoreMetrics(
		tenant: TenantContext,
		days: number = 30
	): Promise<PlatformStats[]> {
		const result = await this.db
			.prepare(
				`
			SELECT 
				platform,
				COUNT(*) as total_calls,
				SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
				SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls,
				AVG(duration_ms) as avg_latency,
				MIN(duration_ms) as min_latency,
				MAX(duration_ms) as max_latency,
				MAX(created_at) as last_used
			FROM token_usage_metrics
			WHERE store_id = ? AND created_at > datetime('now', '-${days} days')
			GROUP BY platform
			ORDER BY total_calls DESC
		`
			)
			.bind(tenant.storeId)
			.all<{
				platform: string;
				total_calls: number;
				successful_calls: number;
				failed_calls: number;
				avg_latency: number;
				min_latency: number;
				max_latency: number;
				last_used: string;
			}>();

		return (result.results || []).map((r) => ({
			platform: r.platform,
			totalCalls: r.total_calls,
			successfulCalls: r.successful_calls,
			failedCalls: r.failed_calls,
			successRate:
				r.total_calls > 0 ? (r.successful_calls / r.total_calls) * 100 : 0,
			avgLatencyMs: Math.round(r.avg_latency),
			minLatencyMs: r.min_latency,
			maxLatencyMs: r.max_latency,
			lastUsed: r.last_used,
		}));
	}

	/**
	 * Estimate costs based on usage
	 * Rates: ~$0.05-0.10 per API call (varies by platform)
	 */
	async estimateCosts(
		tenant: TenantContext,
		days: number = 30
	): Promise<CostMetrics[]> {
		const platformRates: Record<string, number> = {
			ebay: 0.10,
			shopify: 0.05,
			etsy: 0.08,
			facebook: 0.05,
			tiktok: 0.08,
			pinterest: 0.05,
		};

		const metrics = await this.getStoreMetrics(tenant, days);

		return metrics.map((m) => ({
			storeId: tenant.storeId,
			platform: m.platform,
			period: `${days} days`,
			estimatedCost: m.totalCalls * (platformRates[m.platform] || 0.07),
			callCount: m.totalCalls,
			avgLatency: m.avgLatencyMs,
		}));
	}

	/**
	 * Get error rate by platform
	 */
	async getErrorRates(
		tenant: TenantContext,
		days: number = 30
	): Promise<
		Array<{
			platform: string;
			errorRate: number;
			failureCount: number;
			topErrors: Array<{ error: string; count: number }>;
		}>
	> {
		const result = await this.db
			.prepare(
				`
			SELECT 
				platform,
				error_message,
				COUNT(*) as error_count
			FROM token_usage_metrics
			WHERE store_id = ? AND success = 0 AND created_at > datetime('now', '-${days} days')
			GROUP BY platform, error_message
			ORDER BY platform, error_count DESC
		`
			)
			.bind(tenant.storeId)
			.all<{
				platform: string;
				error_message: string;
				error_count: number;
			}>();

		const errorsByPlatform: Record<
			string,
			Array<{ error: string; count: number }>
		> = {};

		if (result.results) {
			for (const row of result.results) {
				if (!errorsByPlatform[row.platform]) {
					errorsByPlatform[row.platform] = [];
				}
				errorsByPlatform[row.platform].push({
					error: row.error_message || "Unknown",
					count: row.error_count,
				});
			}
		}

		const stats = await this.getStoreMetrics(tenant, days);

		return stats.map((s) => ({
			platform: s.platform,
			errorRate: 100 - s.successRate,
			failureCount: s.failedCalls,
			topErrors: errorsByPlatform[s.platform] || [],
		}));
	}

	/**
	 * Get action breakdown
	 */
	async getActionBreakdown(
		tenant: TenantContext,
		platform: string,
		days: number = 30
	): Promise<
		Array<{
			action: string;
			count: number;
			successRate: number;
			avgLatency: number;
		}>
	> {
		const result = await this.db
			.prepare(
				`
			SELECT 
				action,
				COUNT(*) as total,
				SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
				AVG(duration_ms) as avg_latency
			FROM token_usage_metrics
			WHERE store_id = ? AND platform = ? AND created_at > datetime('now', '-${days} days')
			GROUP BY action
			ORDER BY total DESC
		`
			)
			.bind(tenant.storeId, platform)
			.all<{
				action: string;
				total: number;
				successful: number;
				avg_latency: number;
			}>();

		return (result.results || []).map((r) => ({
			action: r.action,
			count: r.total,
			successRate: r.total > 0 ? (r.successful / r.total) * 100 : 0,
			avgLatency: Math.round(r.avg_latency),
		}));
	}

	/**
	 * Cleanup old metrics (retention policy)
	 */
	async pruneOldMetrics(days: number = 90): Promise<number> {
		const result = await this.db
			.prepare(
				`
			DELETE FROM token_usage_metrics
			WHERE created_at < datetime('now', '-${days} days')
		`
			)
			.run();

		return result.meta.changes;
	}
}
