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
		// TODO: Fetch from D1 database
		const stats = {
			listing_stats: {
				total: 42,
				draft: 5,
				enriching: 2,
				ready: 10,
				published: 20,
				live: 5,
				error: 0,
			},
			platform_stats: [
				{ platform: "ebay", published: 20, views: 1250, sales: 8 },
				{ platform: "shopify", published: 10, views: 450, sales: 3 },
				{ platform: "etsy", published: 15, views: 680, sales: 5 },
				{ platform: "facebook", published: 8, views: 320, sales: 2 },
				{ platform: "tiktok", published: 12, views: 5600, sales: 1 },
				{ platform: "instagram", published: 18, views: 2100, sales: 4 },
				{ platform: "pinterest", published: 10, views: 890, sales: 2 },
			],
			recent_activity: [
				{
					id: "1",
					title: "Vintage Diamond Ring Published",
					description: "Published to eBay, Shopify, Etsy",
					timestamp: "2 hours ago",
				},
				{
					id: "2",
					title: "Gold Necklace Enriched",
					description: "AI enrichment completed successfully",
					timestamp: "3 hours ago",
				},
				{
					id: "3",
					title: "Emerald Bracelet Listed",
					description: "Published to all 10 platforms",
					timestamp: "5 hours ago",
				},
			],
		};

		return c.json({ success: true, data: stats });
	} catch (err) {
		console.error("[Dashboard] Error:", err);
		return c.json({ success: false, error: (err as Error).message }, 500);
	}
});

export default app;
