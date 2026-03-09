/**
 * Media API Routes
 * Image upload and processing endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import { createMediaAsset, getMediaAssetsByListing } from "../db/listings";

const app = new Hono<{ Bindings: Env }>();

// Upload media for a listing
app.post("/", async (c) => {
	try {
		const formData = await c.req.formData();
		const fileEntry = formData.get("file");
		const listingId = formData.get("listingId") as string;

		if (!fileEntry || typeof fileEntry === "string" || !listingId) {
			return c.json({ success: false, error: "File and listingId required" }, 400);
		}

		// Treat as File-like object from FormData
		interface FileObject {
			name: string;
			type: string;
			size: number;
			arrayBuffer: () => Promise<ArrayBuffer>;
		}
		const file = fileEntry as FileObject;

		// Generate R2 key
		const ext = file.name.split(".").pop() || "bin";
		const r2Key = `listings/${listingId}/${crypto.randomUUID()}.${ext}`;

		// Upload to R2
		await c.env.R2_PROD.put(r2Key, await file.arrayBuffer(), {
			httpMetadata: { contentType: file.type },
		});

		// Create media asset record
		const assetId = await createMediaAsset(c.env.DB, {
			listing_id: listingId,
			r2_key: r2Key,
			original_filename: file.name,
			mime_type: file.type,
			size_bytes: file.size,
			width: null,
			height: null,
			status: "uploaded",
			public_url: null,
		});

		return c.json({
			success: true,
			data: { id: assetId, r2Key },
		}, 201);
	} catch (error) {
		console.error("Media upload error:", error);
		return c.json({ success: false, error: "Upload failed" }, 500);
	}
});

// Get media for a listing
app.get("/listing/:listingId", async (c) => {
	const listingId = c.req.param("listingId");
	const assets = await getMediaAssetsByListing(c.env.DB, listingId);
	return c.json({ success: true, data: assets });
});

export default app;
