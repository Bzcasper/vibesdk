/**
 * Listings API Routes
 * Core listing management endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

// Create a listing
app.post("/", async (c) => {
	try {
		const { sku, title, description, category_id } = await c.req.json() as any;
		if (!sku) return c.json({ success: false, error: "SKU required" }, 400);

		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		
		const result = await c.env.DB.prepare(
			"INSERT INTO listings (id, sku, status, title, description, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
		).bind(id, sku, "draft", title || null, description || null, category_id || null, now, now).run();

		return c.json({ success: true, data: { id } }, 201);
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

// Get listing
app.get("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const result = await c.env.DB.prepare("SELECT * FROM listings WHERE id = ?").bind(id).first();
		
		if (!result) return c.json({ success: false, error: "Listing not found" }, 404);
		return c.json({ success: true, data: result });
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

// Update listing
app.put("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		const { title, description, price_final, status } = await c.req.json() as any;
		const now = new Date().toISOString();

		const result = await c.env.DB.prepare(
			"UPDATE listings SET title = ?, description = ?, price_final = ?, status = ?, updated_at = ? WHERE id = ?"
		).bind(title || null, description || null, price_final || null, status || "draft", now, id).run();

		return c.json({ success: true, data: { id } });
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

// Delete listing
app.delete("/:id", async (c) => {
	try {
		const id = c.req.param("id");
		await c.env.DB.prepare("DELETE FROM listings WHERE id = ?").bind(id).run();
		return c.json({ success: true });
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

export default app;
