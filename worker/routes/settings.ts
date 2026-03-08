/**
 * Settings API Routes
 * Configuration read/write endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

// Get all settings
app.get("/", async (c) => {
	const settings = {
		storeName: c.env.STORE_NAME || "My Store",
		defaultMarketplace: c.env.DEFAULT_MARKETPLACE || "ebay",
		defaultCurrency: c.env.DEFAULT_CURRENCY || "USD",
		environment: c.env.ENVIRONMENT || "development",
	};

	return c.json({ success: true, data: settings });
});

// Update settings (stored in KV)
app.put("/", async (c) => {
	try {
		const updates = await c.req.json();

		// Store in KV
		await c.env.KV_CONFIG.put("user_settings", JSON.stringify(updates));

		return c.json({ success: true, data: updates });
	} catch (error) {
		console.error("Settings update error:", error);
		return c.json({ success: false, error: "Failed to update settings" }, 500);
	}
});

// Get platform credentials status
app.get("/platforms", async (c) => {
	const platforms = {
		ebay: {
			connected: !!c.env.EBAY_STORE_NAME,
			storeName: c.env.EBAY_STORE_NAME || null,
		},
		shopify: {
			connected: !!(c.env.SHOPIFY_SHOP_DOMAIN && c.env.SHOPIFY_ACCESS_TOKEN),
			domain: c.env.SHOPIFY_SHOP_DOMAIN || null,
		},
		etsy: {
			connected: !!(c.env.ETSY_KEYSTRING && c.env.ETSY_SHARED_SECRET),
		},
		pinterest: {
			connected: !!(c.env.PINTEREST_APP_ID && c.env.PINTEREST_APP_SECRET),
		},
		facebook: {
			connected: !!(c.env.FACEBOOK_APP_ID && c.env.FACEBOOK_APP_SECRET),
		},
	};

	return c.json({ success: true, data: platforms });
});

export default app;
