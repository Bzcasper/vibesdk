/**
 * Media Jobs Queue Handler
 *
 * Handles image validation and optimization using Workers AI and R2.
 */

import { Message } from "@cloudflare/workers-types";
import { Env } from "../types/env";
import { logDispatch } from "../db/listings";

// ============================================================
// Types
// ============================================================

export interface MediaJobMessage {
	listingId: string;
	action: "validate_images" | "optimize_images";
	imageKeys: string[];
	userId: string;
}

export interface MediaJobResult {
	listingId: string;
	success: boolean;
	action: string;
	processedImages: number;
	validImages: string[];
	optimizedImages?: string[];
	error?: string;
	details?: Record<string, unknown>;
}

// ============================================================
// Queue Handler
// ============================================================

export async function handleMediaJobsBatch(
	messages: Message<MediaJobMessage>[],
	env: Env
): Promise<void> {
	const results: MediaJobResult[] = [];

	for (const message of messages) {
		const { listingId, action, imageKeys } = message.body;

		try {
			const result: MediaJobResult = {
				listingId,
				action,
				success: false,
				processedImages: 0,
				validImages: [],
			};

			if (action === "validate_images") {
				result.success = await handleValidateImages(env, listingId, imageKeys, result);
			} else if (action === "optimize_images") {
				result.success = await handleOptimizeImages(env, listingId, imageKeys, result);
			} else {
				throw new Error(`Unknown action: ${action}`);
			}

			// Log result
			await logDispatch(env.DB, {
				listingId: listingId,
				action: `media_${action}`,
				status: result.success ? "success" : "error",
				details: JSON.stringify({
					action,
					processedImages: result.processedImages,
					validCount: result.validImages.length,
					error: result.error,
				}),
			});

			results.push(result);
			message.ack();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";

			await logDispatch(env.DB, {
				listingId: listingId,
				action: `media_${message.body.action}`,
				status: "error",
				details: errorMsg,
			});

			results.push({
				listingId,
				action,
				success: false,
				processedImages: 0,
				validImages: [],
				error: errorMsg,
			});

			message.retry();
		}
	}
}

// ============================================================
// Action Handlers
// ============================================================

async function handleValidateImages(
	env: Env,
	listingId: string,
	imageKeys: string[],
	result: MediaJobResult
): Promise<boolean> {
	try {
		const validImages: string[] = [];

		for (const imageKey of imageKeys) {
			try {
				// Get image from R2
				const object = await env.MEDIA.get(imageKey);
				if (!object) {
					continue;
				}

				// Validate image properties
				const contentType = object.httpMetadata?.contentType || "";
				const contentLength = object.size || 0;

				// Basic validation: must be image, under 10MB
				if (!contentType.startsWith("image/")) {
					continue;
				}

				if (contentLength > 10 * 1024 * 1024) {
					continue;
				}

				validImages.push(imageKey);
				result.processedImages++;
			} catch (error) {
				// Skip invalid images
				continue;
			}
		}

		result.validImages = validImages;
		result.details = {
			totalProvided: imageKeys.length,
			validCount: validImages.length,
			skipped: imageKeys.length - validImages.length,
		};

		return validImages.length > 0;
	} catch (error) {
		result.error = error instanceof Error ? error.message : "Validation failed";
		return false;
	}
}

async function handleOptimizeImages(
	env: Env,
	listingId: string,
	imageKeys: string[],
	result: MediaJobResult
): Promise<boolean> {
	try {
		const optimizedImages: string[] = [];

		for (const imageKey of imageKeys) {
			try {
				// Get original image
				const object = await env.MEDIA.get(imageKey);
				if (!object) {
					continue;
				}

				// Generate optimized variants
				const optimizedKey = `optimized/${listingId}/${imageKey}`;

				// In production, use Workers AI for image optimization
				// For now, copy to optimized location
				const arrayBuffer = await object.arrayBuffer();

				await env.MEDIA.put(optimizedKey, arrayBuffer, {
					httpMetadata: {
						contentType: object.httpMetadata?.contentType || "image/jpeg",
						cacheControl: "public, max-age=31536000",
					},
					customMetadata: {
						source: imageKey,
						listingId: listingId,
						optimizedAt: new Date().toISOString(),
					},
				});

				optimizedImages.push(optimizedKey);
				result.processedImages++;
			} catch (error) {
				// Skip failed optimizations
				continue;
			}
		}

		result.optimizedImages = optimizedImages;
		result.details = {
			totalProvided: imageKeys.length,
			optimizedCount: optimizedImages.length,
			failed: imageKeys.length - optimizedImages.length,
		};

		return optimizedImages.length > 0;
	} catch (error) {
		result.error = error instanceof Error ? error.message : "Optimization failed";
		return false;
	}
}

// ============================================================
// Queue Consumer Export
// ============================================================

export default {
	async queue(batch: { messages: Message<MediaJobMessage>[] }, env: Env): Promise<void> {
		await handleMediaJobsBatch(batch.messages, env);
	},
};
