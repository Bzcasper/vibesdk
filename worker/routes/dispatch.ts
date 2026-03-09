/**
 * Dispatch API Routes
 * Publish enriched listings to multiple platforms
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import { dispatchToAllPlatforms, DispatchRequest } from "../agents/dispatch";
import { getListingById } from "../db/listings";
import { PlatformName } from "../../src/api-types";

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/dispatch/publish
 * Publish a listing to specified platforms
 */
app.post("/publish", async (c) => {
	try {
		const { listing_id, platforms } = (await c.req.json()) as {
			listing_id: string;
			platforms: PlatformName[];
		};

		if (!listing_id || !platforms || platforms.length === 0) {
			return c.json(
				{ success: false, error: "listing_id and platforms required" },
				400
			);
		}

		// Get listing from DB
		const listing = await getListingById(c.env.DB, listing_id);
		if (!listing) {
			return c.json(
				{ success: false, error: "Listing not found" },
				404
			);
		}

		// TODO: Get media assets for listing
		const images: Array<{ r2_key: string; position: number; is_primary: boolean }> = [];

		// Dispatch to platforms
		const dispatchRequest: DispatchRequest = {
			listing_id,
			platforms,
			listing: listing as any, // Type casting for now
			images,
		};

		const results = await dispatchToAllPlatforms(
			dispatchRequest,
			c.env.DB,
			{
				dispatch: c.env.JOBS_QUEUE,
				media: c.env.JOBS_QUEUE,
				social: c.env.JOBS_QUEUE,
			}
		);

		return c.json(
			{
				success: true,
				data: {
					listing_id,
					results,
					queued_count: results.filter((r) => r.status === "queued").length,
				},
			},
			202 // Accepted - jobs queued
		);
	} catch (error) {
		console.error("Dispatch error:", error);
		return c.json(
			{ success: false, error: (error as Error).message },
			500
		);
	}
});

/**
 * GET /api/dispatch/status/:listing_id
 * Get dispatch status for a listing across all platforms
 */
app.get("/status/:listing_id", async (c) => {
	const listing_id = c.req.param("listing_id");

	try {
		// TODO: Query dispatch_logs table
		const status = {
			listing_id,
			platforms: {
				ebay: { status: "queued", job_id: null, error: null },
				shopify: { status: "pending", job_id: null, error: null },
				etsy: { status: "pending", job_id: null, error: null },
				facebook: { status: "pending", job_id: null, error: null },
				tiktok: { status: "pending", job_id: null, error: null },
				pinterest: { status: "pending", job_id: null, error: null },
				instagram: { status: "pending", job_id: null, error: null },
			},
		};

		return c.json({ success: true, data: status });
	} catch (error) {
		return c.json(
			{ success: false, error: (error as Error).message },
			500
		);
	}
});

export default app;
