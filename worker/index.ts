/**
 * Listing Factory — Multi-Platform Listing Automation System
 * Worker Entry Point
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types/env";
import { ListingSession } from "./durable-objects/ListingSession";
import { BrowserSession } from "./durable-objects/BrowserSession";

// Route imports
import listingsRoutes from "./routes/listings";
import mediaRoutes from "./routes/media";
import exportRoutes from "./routes/export";
import uploadJobsRoutes from "./routes/upload-jobs";
import socialRoutes from "./routes/social";
import settingsRoutes from "./routes/settings";
import dispatchRoutes from "./routes/dispatch";
import dashboardRoutes from "./routes/dashboard";
import enrichRoutes from "./routes/enrich";

// Queue handlers
import {
	handleDispatchQueue,
	handleMediaQueue,
	handleSyncQueue,
} from "./queues/handlers";
import socialJobsHandler from "./queues/social-jobs";
import { handleGrokJob } from "./queues/grok-jobs";

// Export Durable Objects
export { ListingSession, BrowserSession };

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Global Middleware
app.use("/*", cors());

// API Routes
app.route("/api/listings", listingsRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/export", exportRoutes);
app.route("/api/upload-jobs", uploadJobsRoutes);
app.route("/api/social", socialRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/dispatch", dispatchRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/enrich", enrichRoutes);

// ListingSession WebSocket - delegate to Durable Object
app.get("/api/session/:id", async (c) => {
	const id = c.req.param("id");
	const doId = c.env.LISTING_SESSION.idFromName(id);
	const stub = c.env.LISTING_SESSION.get(doId);
	c.executionCtx.waitUntil(stub.fetch(c.req.raw as any));
});

// BrowserSession WebSocket - delegate to Durable Object
app.get("/api/browser/:id", async (c) => {
	const id = c.req.param("id");
	const doId = c.env.BROWSER_SESSION.idFromName(id);
	const stub = c.env.BROWSER_SESSION.get(doId);
	c.executionCtx.waitUntil(stub.fetch(c.req.raw as any));
});

// API 404
app.all("/api/*", (c) => {
	return c.json({ success: false, error: "Not found" }, 404);
});

// Serve Frontend Assets
app.get("*", async (c) => {
	return await c.env.ASSETS.fetch(c.req.raw);
});

// Unified Queue Consumer
export const queue = async (batch: any, env: Env) => {
	// Group messages by type to use specialized handlers
	const dispatchMessages: any[] = [];
	const mediaMessages: any[] = [];
	const socialMessages: any[] = [];
	const syncMessages: any[] = [];
	const grokMessages: any[] = [];

	for (const message of batch.messages) {
		const job =
			typeof message.body === "string"
				? JSON.parse(message.body)
				: message.body;
		const type = job.type || job.action || "";

		if (
			type.includes("_upload") ||
			type.includes("_create") ||
			type === "ebay_upload" ||
			type === "facebook_marketplace_post"
		) {
			dispatchMessages.push(message);
		} else if (type.includes("_generate_content")) {
			socialMessages.push(message);
		} else if (
			type === "validate_image" ||
			type === "optimize_image" ||
			type === "process_batch"
		) {
			mediaMessages.push(message);
		} else if (
			type === "check_dispatch_status" ||
			type === "refresh_inventory"
		) {
			syncMessages.push(message);
		} else if (type === "grok-enrich") {
			grokMessages.push(message);
		} else {
			// Default to dispatch if unknown
			dispatchMessages.push(message);
		}
	}

	// Execute handlers for each group
	if (dispatchMessages.length > 0) {
		await handleDispatchQueue({ messages: dispatchMessages } as any, env);
	}
	if (mediaMessages.length > 0) {
		await handleMediaQueue({ messages: mediaMessages } as any, env);
	}
	if (socialMessages.length > 0) {
		await socialJobsHandler.queue({ messages: socialMessages } as any, env);
	}
	if (grokMessages.length > 0) {
		for (const message of grokMessages) {
			const job =
				typeof message.body === "string"
					? JSON.parse(message.body)
					: message.body;
			await handleGrokJob(job, env.DB, env.MEDIA, env.GROK_API_KEY || "");
		}
	}
	if (syncMessages.length > 0) {
		await handleSyncQueue({ messages: syncMessages } as any, env);
	}
};

// Scheduled Handler
export const scheduled = async (
	_event: ScheduledEvent,
	_env: Env,
	_ctx: ExecutionContext,
) => {
	console.log("Scheduled task received");
	// TODO: Implement scheduled tasks
};

export default {
	fetch: app.fetch,
	queue,
	scheduled,
};
