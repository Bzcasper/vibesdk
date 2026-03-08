/**
 * Social Content API Routes
 * TikTok, Pinterest, Instagram content generation
 */

import { Hono } from "hono";
import { Env, SocialPlatform } from "../types/env";
import { getListingById, getListingFields, getMediaAssetsByListing } from "../db/listings";

const app = new Hono<{ Bindings: Env }>();

// Get social content for a listing
app.get("/listing/:listingId", async (c) => {
	const listingId = c.req.param("listingId");
	const platform = c.req.query("platform") as SocialPlatform | null;

	const listing = await getListingById(c.env.DB, listingId);
	if (!listing) {
		return c.json({ success: false, error: "Listing not found" }, 404);
	}

	const fields = await getListingFields(c.env.DB, listingId);
	const media = await getMediaAssetsByListing(c.env.DB, listingId);

	// TODO: Generate social content based on platform
	const content = {
		tiktok: {
			script: null,
			hashtags: [],
			suggestedSounds: [],
		},
		pinterest: {
			pinTitle: null,
			pinDescription: null,
			boardSuggestions: [],
		},
		instagram: {
			caption: null,
			hashtags: [],
		},
	};

	return c.json({
		success: true,
		data: {
			listing,
			fields,
			media,
			content,
		},
	});
});

// Generate social content for a listing
app.post("/generate", async (c) => {
	try {
		const { listingId, platform } = await c.req.json();

		if (!listingId || !platform) {
			return c.json({ success: false, error: "listingId and platform required" }, 400);
		}

		// Queue social content generation
		// await c.env.QUEUE_SOCIAL.send({ type: 'generate', listingId, platform });

		return c.json({
			success: true,
			data: { status: "queued", listingId, platform },
		});
	} catch (error) {
		console.error("Social content generation error:", error);
		return c.json({ success: false, error: "Generation failed" }, 500);
	}
});

export default app;
