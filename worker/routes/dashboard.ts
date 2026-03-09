/**
 * Dashboard Routes
 * Analytics and overview endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

// GET /api/dashboard/stats
app.get("/stats", async (c) => {
	try {
		// Get listing status breakdown
		const statusResult = await c.env.DB.prepare(`
			SELECT 
				COUNT(*) as total,
				SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
				SUM(CASE WHEN status = 'enriching' THEN 1 ELSE 0 END) as enriching,
				SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
				SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
				SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) as live,
				SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
			FROM listings
		`).first() as any;

		const listing_stats = {
			total: statusResult?.total || 0,
			draft: statusResult?.draft || 0,
			enriching: statusResult?.enriching || 0,
			ready: statusResult?.ready || 0,
			published: statusResult?.published || 0,
			live: statusResult?.live || 0,
			error: statusResult?.error || 0,
		};

		// Get recent dispatch activity
		const recentResult = await c.env.DB.prepare(`
			SELECT id, action, platform, status, created_at
			FROM dispatch_log
			ORDER BY created_at DESC
			LIMIT 5
		`).all() as any;

		const recent_activity = (recentResult?.results || []).map((row: any) => ({
			id: row.id,
			title: `${row.action} to ${row.platform}`,
			description: `Status: ${row.status}`,
			timestamp: new Date(row.created_at).toLocaleDateString(),
		}));

		// Placeholder for platform stats (can be expanded with more queries)
		const platform_stats = [
			{ platform: "ebay", published: 0, views: 0, sales: 0 },
			{ platform: "shopify", published: 0, views: 0, sales: 0 },
			{ platform: "tiktok", published: 0, views: 0, sales: 0 },
			{ platform: "pinterest", published: 0, views: 0, sales: 0 },
		];

		return c.json({ success: true, data: { listing_stats, platform_stats, recent_activity } });
	} catch (err) {
		console.error("[Dashboard] Error:", err);
		return c.json({ success: false, error: (err as Error).message }, 500);
	}
});

export default app;
