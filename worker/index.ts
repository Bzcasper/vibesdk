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

// Queue handlers
import { handleDispatchQueue, handleMediaQueue, handleSyncQueue } from "./queues/handlers";
import socialJobsHandler from "./queues/social-jobs";

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

// SPA Fallback - serve from R2 or return placeholder
app.get("*", async (c) => {
	// Try to serve from R2
	try {
		const url = new URL(c.req.url);
		const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
		const asset = await c.env.R2_PROD.get(`dist/${path}`);

		if (asset) {
			const contentType = getContentType(path);
			return new Response(asset.body as any, {
				headers: { "Content-Type": contentType },
			});
		}
	} catch {
		// Fall through to index.html
	}

	// Return index.html for client-side routing
	try {
		const indexHtml = await c.env.R2_PROD.get("dist/index.html");
		if (indexHtml) {
			return new Response(indexHtml.body as any, {
				headers: { "Content-Type": "text/html" },
			});
		}
	} catch {
		// Fall through
	}

	// Development placeholder
	return c.html(`
		<!DOCTYPE html>
		<html>
		<head><title>Listing Factory</title></head>
		<body>
			<h1>Listing Factory</h1>
			<p>Multi-Platform Listing Automation System</p>
			<p>Build and deploy the frontend to see the full UI.</p>
		</body>
		</html>
	`);
});

// Unified Queue Consumer
export const queue = async (batch: any, env: Env) => {
	// Group messages by type to use specialized handlers
	const dispatchMessages: any[] = [];
	const mediaMessages: any[] = [];
	const socialMessages: any[] = [];
	const syncMessages: any[] = [];

	for (const message of batch.messages) {
		const job = typeof message.body === "string" ? JSON.parse(message.body) : message.body;
		const type = job.type || job.action || "";

		if (type.includes("_upload") || type.includes("_create") || type === "ebay_upload" || type === "facebook_marketplace_post") {
			dispatchMessages.push(message);
		} else if (type.includes("_generate_content")) {
			socialMessages.push(message);
		} else if (type === "validate_image" || type === "optimize_image" || type === "process_batch") {
			mediaMessages.push(message);
		} else if (type === "check_dispatch_status" || type === "refresh_inventory") {
			syncMessages.push(message);
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
	if (syncMessages.length > 0) {
		await handleSyncQueue({ messages: syncMessages } as any, env);
	}
};

// Scheduled Handler
export const scheduled = async (_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext) => {
	console.log("Scheduled task received");
	// TODO: Implement scheduled tasks
};

// Content type helper
function getContentType(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase();
	const types: Record<string, string> = {
		html: "text/html",
		css: "text/css",
		js: "application/javascript",
		json: "application/json",
		png: "image/png",
		jpg: "image/jpeg",
		svg: "image/svg+xml",
		ico: "image/x-icon",
		woff: "font/woff",
		woff2: "font/woff2",
	};
	return types[ext || ""] || "application/octet-stream";
}

export default {
	fetch: app.fetch,
	queue,
	scheduled,
};
