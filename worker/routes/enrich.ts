/**
 * Enrichment API Routes
 * Process images/text through AI pipeline to generate complete listings
 * Supports both BYOK OpenAI Gateway and Cloudflare Models
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import { HybridAIPipeline } from "../lib/ai-hybrid";
import { withTimeout, TimeoutError } from "../lib/sdk-utils";

const AI_TIMEOUT_MS = 30000; // 30 second timeout for AI calls
const GROK_TIMEOUT_MS = 120000; // 120 second timeout for Grok (slow API)

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /api/enrich/folder
 * Process multiple images as a batch
 * Expects multipart/form-data with image files
 */
app.post("/folder", async (c) => {
	try {
		const formData = await c.req.formData();
		const files = formData.getAll("images") as File[];

		if (!files || files.length === 0) {
			return c.json({ success: false, error: "No images provided" }, 400);
		}

		console.log(`[Enrich] Processing ${files.length} images`);

		const pipeline = new HybridAIPipeline(c.env);
		const results = [];
		const errors = [];
		const providerStatus = pipeline.getStatus();

		// Process each image
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const itemFolder = file.name.split("/")[0] || `item-${i + 1}`;

			try {
				console.log(
					`[Enrich] Processing image ${i + 1}/${files.length}: ${file.name}`,
				);

				// Convert image to base64
				const buffer = await file.arrayBuffer();
				const imageBase64 = btoa(
					new Uint8Array(buffer).reduce(
						(acc, byte) => acc + String.fromCharCode(byte),
						"",
					),
				);

				// Run enrichment pipeline
				const enriched = await pipeline.enrichFromImage(imageBase64);

				// Store listing in database
				const listingId = crypto.randomUUID();
				const now = new Date().toISOString();

				await c.env.DB.prepare(
					`
					INSERT INTO listings 
					(id, sku, status, title, description, price_final, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
				)
					.bind(
						listingId,
						itemFolder,
						"ready",
						enriched.title,
						enriched.description,
						enriched.price_suggested,
						now,
						now,
					)
					.run();

				// Store item specifics
				for (const [key, value] of Object.entries(
					enriched.item_specifics,
				)) {
					const fieldId = crypto.randomUUID();
					const valueStr =
						typeof value === "string"
							? value
							: JSON.stringify(value);
					await c.env.DB.prepare(
						`
						INSERT INTO listing_fields (id, listing_id, key, value, ai_suggested, created_at)
						VALUES (?, ?, ?, ?, ?, ?)
					`,
					)
						.bind(fieldId, listingId, key, valueStr, 1, now)
						.run();
				}

				// Store processed image in R2
				const r2Key = `listings/${listingId}/${file.name}`;
				await c.env.MEDIA.put(r2Key, buffer, {
					httpMetadata: { contentType: file.type },
				});

				// Record media asset
				const mediaId = crypto.randomUUID();
				await c.env.DB.prepare(
					`
					INSERT INTO media_assets 
					(id, listing_id, r2_key, original_filename, mime_type, size_bytes, status, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`,
				)
					.bind(
						mediaId,
						listingId,
						r2Key,
						file.name,
						file.type,
						buffer.byteLength,
						"processed",
						now,
					)
					.run();

				results.push({
					folder: itemFolder,
					filename: file.name,
					listing_id: listingId,
					title: enriched.title,
					price: enriched.price_suggested,
					status: "success",
				});

				console.log(
					`[Enrich] ✓ Completed: ${itemFolder} → ${enriched.title}`,
				);
			} catch (error) {
				errors.push({
					folder: itemFolder,
					filename: file.name,
					error: (error as Error).message,
					status: "error",
				});

				console.error(`[Enrich] ✗ Failed: ${itemFolder}`, error);
			}
		}

		return c.json({
			success: true,
			data: {
				processed: results.length,
				failed: errors.length,
				total: files.length,
				provider: providerStatus,
				results,
				errors: errors.length > 0 ? errors : undefined,
			},
		});
	} catch (error) {
		console.error("[Enrich] Folder processing failed:", error);
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

/**
 * POST /api/enrich/text
 * Process text description (Cloudflare Models only - no image needed)
 */
app.post("/text", async (c) => {
	try {
		const { description, folder } = (await c.req.json()) as any;

		if (!description) {
			return c.json(
				{ success: false, error: "Description required" },
				400,
			);
		}

		const pipeline = new HybridAIPipeline(c.env);

		let enriched;
		try {
			enriched = await withTimeout(
				pipeline.enrichFromDescription(description),
				GROK_TIMEOUT_MS, "Grok may take up to 2 minutes",
				"AI text enrichment timed out",
			);
		} catch (error) {
			if (error instanceof TimeoutError) {
				return c.json(
					{
						success: false,
						error: "AI processing timed out. Please try again.",
					},
					504,
				);
			}
			throw error;
		}

		// Create listing
		const listingId = crypto.randomUUID();
		const now = new Date().toISOString();

		await c.env.DB.prepare(
			`
			INSERT INTO listings 
			(id, sku, status, title, description, price_final, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
		)
			.bind(
				listingId,
				folder || "text-item",
				"ready",
				enriched.title,
				enriched.description,
				enriched.price_suggested,
				now,
				now,
			)
			.run();

		// Store specifics
		for (const [key, value] of Object.entries(enriched.item_specifics)) {
			const fieldId = crypto.randomUUID();
			const valueStr =
				typeof value === "string" ? value : JSON.stringify(value);
			await c.env.DB.prepare(
				`
				INSERT INTO listing_fields (id, listing_id, key, value, ai_suggested, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
			)
				.bind(fieldId, listingId, key, valueStr, 1, now)
				.run();
		}

		return c.json({
			success: true,
			data: {
				listing_id: listingId,
				title: enriched.title,
				description: enriched.description,
				price_suggested: enriched.price_suggested,
				item_specifics: enriched.item_specifics,
				provider: enriched.provider,
			},
		});
	} catch (error) {
		console.error("[Enrich] Text processing failed:", error);
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

/**
 * POST /api/enrich/image
 * Process a single image
 */
app.post("/image", async (c) => {
	try {
		const formData = await c.req.formData();
		const imageFile = formData.get("image") as File;
		const folder = (formData.get("folder") as string) || "item";

		if (!imageFile) {
			return c.json({ success: false, error: "No image provided" }, 400);
		}

		const pipeline = new HybridAIPipeline(c.env);
		const buffer = await imageFile.arrayBuffer();
		const mimeType = imageFile.type || "image/jpeg";
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		const imageBase64 = btoa(binary);

		// Run enrichment with timeout
		let enriched;
		try {
			enriched = await withTimeout(
				pipeline.enrichFromImage(imageBase64, mimeType),
				GROK_TIMEOUT_MS, "Grok may take up to 2 minutes",
				GROK_TIMEOUT_MS, "Grok may take up to 2 minutes",
			);
		} catch (error) {
			if (error instanceof TimeoutError) {
				return c.json(
					{
						success: false,
						error: "AI processing timed out. Please try again.",
					},
					504,
				);
			}
			throw error;
		}

		// Create listing
		const listingId = crypto.randomUUID();
		const now = new Date().toISOString();

		await c.env.DB.prepare(
			`
			INSERT INTO listings 
			(id, sku, status, title, description, price_final, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
		)
			.bind(
				listingId,
				folder,
				"ready",
				enriched.title,
				enriched.description,
				enriched.price_suggested,
				now,
				now,
			)
			.run();

		// Store specifics
		for (const [key, value] of Object.entries(enriched.item_specifics)) {
			const fieldId = crypto.randomUUID();
			const valueStr =
				typeof value === "string" ? value : JSON.stringify(value);
			await c.env.DB.prepare(
				`
				INSERT INTO listing_fields (id, listing_id, key, value, ai_suggested, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
			)
				.bind(fieldId, listingId, key, valueStr, 1, now)
				.run();
		}

		// Store image
		const r2Key = `listings/${listingId}/${imageFile.name}`;
		await c.env.MEDIA.put(r2Key, buffer, {
			httpMetadata: { contentType: imageFile.type },
		});

		const mediaId = crypto.randomUUID();
		await c.env.DB.prepare(
			`
			INSERT INTO media_assets 
			(id, listing_id, r2_key, original_filename, mime_type, size_bytes, status, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
		)
			.bind(
				mediaId,
				listingId,
				r2Key,
				imageFile.name,
				imageFile.type,
				buffer.byteLength,
				"processed",
				now,
			)
			.run();

		return c.json({
			success: true,
			data: {
				listing_id: listingId,
				title: enriched.title,
				description: enriched.description,
				price_suggested: enriched.price_suggested,
				item_specifics: enriched.item_specifics,
				provider: enriched.provider,
				analysis: enriched.raw_analysis,
			},
		});
	} catch (error) {
		console.error("[Enrich] Image processing failed:", error);
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

/**
 * GET /api/enrich/info
 * Get enrichment provider status
 */
app.get("/info", async (c) => {
	try {
		const pipeline = new HybridAIPipeline(c.env);
		const status = pipeline.getStatus();

		return c.json({
			success: true,
			data: {
				status,
				endpoints: {
					text: "POST /api/enrich/text — Fast, no image needed",
					image: "POST /api/enrich/image — BYOK if available, falls back to Cloudflare",
					folder: "POST /api/enrich/folder — Batch processing",
				},
				note: status.byok_configured
					? "Using OpenAI Gateway (BYOK) - high quality"
					: "Using Cloudflare Models - free tier",
			},
		});
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

/**
 * GET /api/enrich/:id
 * Get enrichment status for a listing
 */
app.get("/:id", async (c) => {
	try {
		const id = c.req.param("id");

		const listing = (await c.env.DB.prepare(
			"SELECT id, title, description, price_final, status FROM listings WHERE id = ?",
		)
			.bind(id)
			.first()) as any;

		if (!listing) {
			return c.json({ success: false, error: "Listing not found" }, 404);
		}

		const fields = (await c.env.DB.prepare(
			"SELECT key, value FROM listing_fields WHERE listing_id = ?",
		)
			.bind(id)
			.all()) as any;

		const specifics: Record<string, string> = {};
		for (const field of fields?.results || []) {
			specifics[field.key] = field.value;
		}

		return c.json({
			success: true,
			data: {
				...listing,
				item_specifics: specifics,
			},
		});
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

export default app;

/**
 * POST /api/enrich/image/async
 * Queue image for async Grok processing (no timeout issues)
 */
app.post("/image/async", async (c) => {
	try {
		const formData = await c.req.formData();
		const imageFile = formData.get("image") as File;
		const folder = (formData.get("folder") as string) || "item";

		if (!imageFile) {
			return c.json({ success: false, error: "No image provided" }, 400);
		}

		if (!c.env.GROK_API_KEY) {
			return c.json({ success: false, error: "Grok not configured" }, 400);
		}

		const buffer = await imageFile.arrayBuffer();
		const mimeType = imageFile.type || "image/jpeg";
		const bytes = new Uint8Array(buffer);
		let binary = "";
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		const imageBase64 = btoa(binary);

		const jobId = crypto.randomUUID();
		const listingId = crypto.randomUUID();
		const now = new Date().toISOString();

		await c.env.DB.prepare(`
			INSERT INTO grok_jobs (job_id, listing_id, status, folder, created_at)
			VALUES (?, ?, ?, ?, ?)
		`).bind(jobId, listingId, "pending", folder, now).run();

		await c.env.JOBS_QUEUE.send({
			type: "grok-enrich",
			jobId,
			listingId,
			imageBase64,
			mimeType,
			folder,
			createdAt: now,
		});

		return c.json({
			success: true,
			data: {
				job_id: jobId,
				status: "pending",
				message: "Use /image/status/{job_id} to check progress",
			},
		});
	} catch (error) {
		return c.json({ success: false, error: (error as Error).message }, 500);
	}
});

/**
 * GET /api/enrich/image/status/:jobId
 */
app.get("/image/status/:jobId", async (c) => {
	const jobId = c.req.param("jobId");
	const row = await c.env.DB.prepare(`
		SELECT job_id, listing_id, status, result, error, completed_at, created_at
		FROM grok_jobs WHERE job_id = ?
	`).bind(jobId).first() as any;

	if (!row) {
		return c.json({ success: false, error: "Job not found" }, 404);
	}

	return c.json({
		success: true,
		data: {
			job_id: row.job_id,
			listing_id: row.listing_id,
			status: row.status,
			result: row.result ? JSON.parse(row.result) : null,
			error: row.error,
			completed_at: row.completed_at,
		},
	});
});
