/**
 * Security API Handlers
 *
 * Handlers for compliance reports, metrics, and incident tracking
 */

import { Env } from "../types/env";
import { TenantContext } from "../security/types";
import { ComplianceChecker } from "../security/ComplianceChecker";
import { TokenMetrics } from "../security/TokenMetrics";

/**
 * Extract query parameters from URL
 */
function getQueryParams(
	url: string
): Record<string, string | string[] | undefined> {
	const urlObj = new URL(url);
	const params: Record<string, string | string[] | undefined> = {};

	for (const [key, value] of urlObj.searchParams.entries()) {
		if (params[key]) {
			if (typeof params[key] === "string") {
				params[key] = [params[key] as string, value];
			} else {
				(params[key] as string[]).push(value);
			}
		} else {
			params[key] = value;
		}
	}

	return params;
}

/**
 * Generate SOC2 compliance report
 */
export async function handleComplianceSoc2(env: Env, req: Request): Promise<Response> {
	try {
		// Extract tenant context from auth header (TODO: implement auth middleware)
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["tokens:read", "compliance:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "90");
		const format = (query.format as string) || "json"; // "json" or "csv"

		const checker = new ComplianceChecker(env.DB);
		const report = await checker.generateSOC2Report(tenant, days);

		// Store report
		await checker.storeComplianceReport(tenant, report);

		if (format === "csv") {
			const csv = await checker.exportAuditTrailCSV(tenant, days);
			return new Response(csv, {
				headers: {
					"Content-Type": "text/csv",
					"Content-Disposition": `attachment; filename="compliance-report-${report.reportId}.csv"`,
				},
			});
		}

		return new Response(JSON.stringify(report), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Check for security incidents
 */
export async function handleSecurityIncidents(
	env: Env,
	req: Request
): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["compliance:read"],
		};

		const query = getQueryParams(req.url);
		const hours = parseInt((query.hours as string) || "24");

		const checker = new ComplianceChecker(env.DB);
		const incidents = await checker.checkSecurityIncidents(tenant, hours);

		return new Response(JSON.stringify(incidents), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Get platform usage metrics
 */
export async function handlePlatformMetrics(
	env: Env,
	req: Request,
	platform: string
): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["metrics:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "30");

		const metrics = new TokenMetrics(env.DB);
		const stats = await metrics.getPlatformStats(tenant, platform, days);

		if (!stats) {
			return new Response(
				JSON.stringify({ error: "No metrics found for platform" }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		return new Response(JSON.stringify(stats), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Get all store metrics
 */
export async function handleStoreMetrics(env: Env, req: Request): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["metrics:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "30");

		const metrics = new TokenMetrics(env.DB);
		const stats = await metrics.getStoreMetrics(tenant, days);

		return new Response(JSON.stringify(stats), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Get cost estimates
 */
export async function handleCostMetrics(env: Env, req: Request): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["metrics:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "30");

		const metrics = new TokenMetrics(env.DB);
		const costs = await metrics.estimateCosts(tenant, days);

		return new Response(JSON.stringify(costs), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Get error rates
 */
export async function handleErrorMetrics(env: Env, req: Request): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["metrics:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "30");

		const metrics = new TokenMetrics(env.DB);
		const errorRates = await metrics.getErrorRates(tenant, days);

		return new Response(JSON.stringify(errorRates), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Get action breakdown for platform
 */
export async function handleActionMetrics(
	env: Env,
	req: Request,
	platform: string
): Promise<Response> {
	try {
		const tenant: TenantContext = {
			storeId: "store_default",
			userId: "user_default",
			permissions: ["metrics:read"],
		};

		const query = getQueryParams(req.url);
		const days = parseInt((query.days as string) || "30");

		const metrics = new TokenMetrics(env.DB);
		const actions = await metrics.getActionBreakdown(tenant, platform, days);

		return new Response(JSON.stringify(actions), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
