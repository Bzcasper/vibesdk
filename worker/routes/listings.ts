/**
 * Listings API Routes
 * Core listing management endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

// Create a listing
app.post("/", async (c) => {
	return c.json({ success: true, message: "Not yet implemented" }, 501);
});

// Get listing
app.get("/:id", async (c) => {
	return c.json({ success: true, message: "Not yet implemented" }, 501);
});

// Update listing
app.put("/:id", async (c) => {
	return c.json({ success: true, message: "Not yet implemented" }, 501);
});

// Delete listing
app.delete("/:id", async (c) => {
	return c.json({ success: true, message: "Not yet implemented" }, 501);
});

export default app;
