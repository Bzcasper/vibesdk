/**
 * Listings API Routes
 * CRUD operations for listing records
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import {
	createListing,
	getListingById,
	listListingsByStatus,
	updateListingStatus,
} from "../db/listings";

const app = new Hono<{ Bindings: Env }>();

// List all listings (with optional status filter)
app.get("/", async (c) => {
	const status = c.req.query("status");
	const limit = parseInt(c.req.query("limit") || "50");
	const offset = parseInt(c.req.query("offset") || "0");

	try {
		const listings = status
			? await listListingsByStatus(c.env.DB, status as any, limit, offset)
			: await listListingsByStatus(c.env.DB, "draft" as any, limit, offset);
		return c.json({ success: true, data: listings });
	} catch (error) {
		return c.json(
			{ success: false, error: "Failed to fetch listings" },
			500,
		);
	}
});

// Get single listing by ID
app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const listing = await getListingById(c.env.DB, id);

	if (!listing) {
		return c.json({ success: false, error: "Listing not found" }, 404);
	}

	return c.json({ success: true, data: listing });
});

// Create new listing
app.post("/", async (c) => {
	try {
		const body = await c.req.json();
		const { sku } = body;

		if (!sku) {
			return c.json({ success: false, error: "SKU is required" }, 400);
		}

		const id = await createListing(c.env.DB, sku);
		return c.json({ success: true, data: { id, sku } }, 201);
	} catch (error) {
		return c.json(
			{ success: false, error: "Failed to create listing" },
			500,
		);
	}
});

// Update listing status
app.patch("/:id/status", async (c) => {
	const id = c.req.param("id");
	const { status } = await c.req.json();

	try {
		await updateListingStatus(c.env.DB, id, status);
		return c.json({ success: true });
	} catch (error) {
		return c.json(
			{ success: false, error: "Failed to update status" },
			500,
		);
	}
});

export default app;
