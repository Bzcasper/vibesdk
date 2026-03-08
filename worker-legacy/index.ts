/**
 * Listing Factory — Multi-Platform Listing System
 * Worker Entry Point
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types/env";
import { ListingSession } from "./durable-objects/ListingSession";
import { BrowserSession } from "./durable-objects/BrowserSession";

// Export Durable Objects
export { ListingSession, BrowserSession };

const app = new Hono<{ Bindings: Env }>();

// Global Middleware
app.use("/*", cors());

// API Routes
app.get("/api/listings", (c) => c.json({ message: "Listings" }));
app.post("/api/media", (c) => c.json({ message: "Media Upload" }));
app.post("/api/export", (c) => c.json({ message: "CSV Export" }));
app.get("/api/upload-jobs", (c) => c.json({ message: "Upload Jobs" }));
app.get("/api/social", (c) => c.json({ message: "Social Content" }));
app.get("/api/session/:id", (c) => c.json({ message: "Listing Session WS" }));
app.get("/api/browser/:id", (c) => c.json({ message: "Browser Session WS" }));
app.get("/api/settings", (c) => c.json({ message: "Settings" }));

// SPA Fallback
app.get("*", async (c) => {
	if (c.req.path.startsWith("/api/")) {
		return c.json({ error: "Not found" }, 404);
	}
	return c.text("React SPA");
});

export default app;
