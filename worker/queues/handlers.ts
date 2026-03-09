/**
 * Queue Handlers
 * Consumes jobs from DISPATCH_QUEUE, MEDIA_QUEUE, and SYNC_QUEUE
 * Executes platform-specific publishing and media processing
 */

import { MessageBatch } from "@cloudflare/workers-types";
import { Env } from "../types/env";
import { handleEbayUpload } from "../agents/dispatch/ebay-dispatcher";
import { handleShopifyCreate, handleEtsyCreate, handleFacebookCreate } from "../agents/dispatch/api-dispatcher";
import { generateTikTokContent, generatePinterestContent, generateInstagramContent } from "../agents/social/content-generator";

// ============================================================
// DISPATCH QUEUE CONSUMER
// ============================================================

export async function handleDispatchQueue(
	batch: MessageBatch,
	env: Env
): Promise<void> {
	const results: Array<{ id: string; success: boolean; error?: string }> = [];

	for (const message of batch.messages) {
		try {
			const job = JSON.parse(typeof message.body === "string" ? message.body : JSON.stringify(message.body));

			console.log(`[DISPATCH] Processing job type: ${job.type}`);

			let success = false;

			switch (job.type) {
				case "ebay_upload": {
					const result = await handleEbayUpload(job, env.DB);
					success = result.success;
					if (!result.success) {
						throw new Error(result.error || "eBay upload failed");
					}
					break;
				}

				case "shopify_create_product": {
					const result = await handleShopifyCreate(job, env.DB, env.CONFIG);
					success = result.success;
					if (!result.success) {
						throw new Error(result.error || "Shopify creation failed");
					}
					break;
				}

				case "etsy_create_listing": {
					const result = await handleEtsyCreate(job, env.DB, env.CONFIG);
					success = result.success;
					if (!result.success) {
						throw new Error(result.error || "Etsy creation failed");
					}
					break;
				}

				case "facebook_marketplace_post": {
					const result = await handleFacebookCreate(job, env.DB, env.CONFIG);
					success = result.success;
					if (!result.success) {
						throw new Error(result.error || "Facebook creation failed");
					}
					break;
				}

				case "poshmark_browser_upload":
				case "whatnot_browser_upload":
				case "mercari_browser_upload": {
					// Browser automation platforms - stub for Phase 6
					console.log(`[${job.platform.toUpperCase()}] Browser upload queued for ${job.listing_id}`);
					success = true;
					break;
				}

				default:
					throw new Error(`Unknown dispatch job type: ${job.type}`);
			}

			results.push({ id: message.id, success });
			message.ack();
		} catch (err) {
			const error = (err as Error).message;
			console.error(`[DISPATCH] Job failed: ${error}`);
			results.push({
				id: message.id,
				success: false,
				error,
			});
			message.ack(); // Ack even on error to prevent infinite retries
		}
	}

	console.log(`[DISPATCH] Batch complete: ${results.filter((r) => r.success).length}/${results.length} succeeded`);
}

// ============================================================
// MEDIA QUEUE CONSUMER
// ============================================================

export async function handleMediaQueue(batch: MessageBatch, _env: Env): Promise<void> {
	for (const message of batch.messages) {
		try {
			const job = JSON.parse(typeof message.body === "string" ? message.body : JSON.stringify(message.body));

			console.log(`[MEDIA] Processing media job: ${job.type}`);

			switch (job.type) {
				case "validate_image": {
					// Validate image format, size, dimensions
					console.log(`[MEDIA] Validating image: ${job.r2_key}`);
					// TODO: Implement image validation
					break;
				}

				case "optimize_image": {
					// Resize, compress, optimize for platform
					console.log(`[MEDIA] Optimizing image: ${job.r2_key} for ${job.platform}`);
					// TODO: Implement image optimization
					break;
				}

				case "process_batch": {
					// Process all images for a listing
					console.log(`[MEDIA] Processing batch for listing: ${job.listing_id}`);
					// TODO: Implement batch processing
					break;
				}

				default:
					throw new Error(`Unknown media job type: ${job.type}`);
			}

			message.ack();
		} catch (err) {
			console.error(`[MEDIA] Job failed: ${(err as Error).message}`);
			message.ack();
		}
	}
}

// ============================================================
// SOCIAL QUEUE CONSUMER
// ============================================================

export async function handleSocialQueue(batch: MessageBatch, env: Env): Promise<void> {
	for (const message of batch.messages) {
		try {
			const job = JSON.parse(typeof message.body === "string" ? message.body : JSON.stringify(message.body));

			console.log(`[SOCIAL] Processing content generation: ${job.type}`);

			switch (job.type) {
				case "tiktok_generate_content": {
					const result = await generateTikTokContent(job, env.AI);
					if (!result.success) {
						throw new Error(result.error || "TikTok generation failed");
					}
					console.log(`[TikTok] ✅ Content generated for ${job.listing_id}`);
					break;
				}

				case "pinterest_generate_content": {
					const result = await generatePinterestContent(job, env.AI);
					if (!result.success) {
						throw new Error(result.error || "Pinterest generation failed");
					}
					console.log(`[Pinterest] ✅ Content generated for ${job.listing_id}`);
					break;
				}

				case "instagram_generate_content": {
					const result = await generateInstagramContent(job, env.AI);
					if (!result.success) {
						throw new Error(result.error || "Instagram generation failed");
					}
					console.log(`[Instagram] ✅ Content generated for ${job.listing_id}`);
					break;
				}

				default:
					throw new Error(`Unknown social job type: ${job.type}`);
			}

			message.ack();
		} catch (err) {
			console.error(`[SOCIAL] Job failed: ${(err as Error).message}`);
			message.ack();
		}
	}
}

// ============================================================
// SYNC QUEUE CONSUMER (Periodic health checks)
// ============================================================

export async function handleSyncQueue(batch: MessageBatch, env: Env): Promise<void> {
	for (const message of batch.messages) {
		try {
			const job = JSON.parse(typeof message.body === "string" ? message.body : JSON.stringify(message.body));

			console.log(`[SYNC] Processing sync job: ${job.type}`);

			switch (job.type) {
				case "check_dispatch_status": {
					// Check if published listings are still live on platforms
					console.log(`[SYNC] Checking dispatch status for listing: ${job.listing_id}`);
					// TODO: Implement status checking
					break;
				}

				case "refresh_inventory": {
					// Refresh listing stats and inventory counts
					console.log(`[SYNC] Refreshing inventory cache`);
					// TODO: Implement inventory refresh
					break;
				}

				default:
					throw new Error(`Unknown sync job type: ${job.type}`);
			}

			message.ack();
		} catch (err) {
			console.error(`[SYNC] Job failed: ${(err as Error).message}`);
			message.ack();
		}
	}
}
