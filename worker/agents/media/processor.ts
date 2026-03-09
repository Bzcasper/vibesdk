/**
 * Media Processor
 * Image pipeline: validate → optimize → remove background → platform-specific sizing
 */

import { R2Bucket, Ai } from "@cloudflare/workers-types";

export interface ProcessedImage {
	r2_key: string;
	original_filename: string;
	mime_type: string;
	width: number;
	height: number;
	size_bytes: number;
	processed_variants: {
		thumbnail: string; // R2 key for 200x200
		medium: string; // R2 key for 800x800
		large: string; // R2 key for 1600x1600
		ebay: string; // R2 key for eBay (1200x1200)
		shopify: string; // R2 key for Shopify (2048x2048)
	};
	background_removed: boolean;
	public_url: string;
}

export interface ImageProcessingResult {
	success: boolean;
	image: ProcessedImage | null;
	error?: string;
}

/**
 * Process image: validate, optimize, resize, remove background
 */
export async function processImage(
	r2Key: string,
	originalFilename: string,
	mimeType: string,
	buffer: ArrayBuffer,
	r2: R2Bucket,
	_ai: Ai,
	listingId: string
): Promise<ImageProcessingResult> {
	try {
		// 1. Validate image
		if (!isValidImageFormat(mimeType)) {
			return {
				success: false,
				image: null,
				error: `Invalid image format: ${mimeType}`,
			};
		}

		if (buffer.byteLength > 50 * 1024 * 1024) {
			// 50MB limit
			return {
				success: false,
				image: null,
				error: "Image too large (max 50MB)",
			};
		}

		// 2. Get image dimensions (would need image library)
		// For now, placeholder
		const dimensions = {
			width: 1200,
			height: 1200,
		};

		// 3. Try background removal with Workers AI
		let processedBuffer = buffer;
		let backgroundRemoved = false;

		try {
			// This uses @cf/bria/rmbg model if available
			// Currently not in free tier, so skip
			// const response = await ai.run("@cf/bria/rmbg", {
			// 	image: new Uint8Array(buffer),
			// });
			// backgroundRemoved = true;
		} catch {
			// Background removal optional, continue without it
			backgroundRemoved = false;
		}

		// 4. Generate platform-specific sizes
		const variants = {
			thumbnail: `listings/${listingId}/images/thumbs/${originalFilename}`,
			medium: `listings/${listingId}/images/medium/${originalFilename}`,
			large: `listings/${listingId}/images/large/${originalFilename}`,
			ebay: `listings/${listingId}/images/ebay/${originalFilename}`,
			shopify: `listings/${listingId}/images/shopify/${originalFilename}`,
		};

		// TODO: Use image processing library (sharp, vips) to create variants
		// For MVP, store single image and generate URLs
		await r2.put(r2Key, processedBuffer, {
			httpMetadata: {
				contentType: mimeType,
			},
		});

		// Store variant placeholders (in Phase 5: actually resize)
		for (const [_key, variantPath] of Object.entries(variants)) {
			await r2.put(variantPath, processedBuffer, {
				httpMetadata: {
					contentType: mimeType,
				},
			});
		}

		const result: ProcessedImage = {
			r2_key: r2Key,
			original_filename: originalFilename,
			mime_type: mimeType,
			width: dimensions.width,
			height: dimensions.height,
			size_bytes: buffer.byteLength,
			processed_variants: variants,
			background_removed: backgroundRemoved,
			public_url: `https://images.example.com/${r2Key}`, // TODO: Use actual R2 public URL
		};

		return {
			success: true,
			image: result,
		};
	} catch (err) {
		return {
			success: false,
			image: null,
			error: `Processing failed: ${(err as Error).message}`,
		};
	}
}

/**
 * Validate image format
 */
function isValidImageFormat(mimeType: string): boolean {
	const valid = ["image/jpeg", "image/png", "image/webp", "image/heic"];
	return valid.includes(mimeType);
}

/**
 * Get platform-specific image requirements
 */
export function getPlatformImageSpec(platform: "ebay" | "shopify" | "etsy" | "facebook" | "tiktok" | "pinterest" | "instagram") {
	const specs = {
		ebay: {
			max_width: 1200,
			max_height: 1200,
			min_width: 500,
			ratio: "square",
			format: "JPEG",
		},
		shopify: {
			max_width: 2048,
			max_height: 2048,
			min_width: 100,
			ratio: "any",
			format: "PNG",
		},
		etsy: {
			max_width: 2000,
			max_height: 2000,
			min_width: 300,
			ratio: "square",
			format: "JPEG",
		},
		facebook: {
			max_width: 1200,
			max_height: 1200,
			min_width: 600,
			ratio: "1.91:1",
			format: "JPEG",
		},
		tiktok: {
			max_width: 1080,
			max_height: 1920,
			min_width: 540,
			ratio: "9:16",
			format: "JPEG",
		},
		pinterest: {
			max_width: 1000,
			max_height: 1500,
			min_width: 600,
			ratio: "2:3",
			format: "PNG",
		},
		instagram: {
			max_width: 1080,
			max_height: 1350,
			min_width: 600,
			ratio: "4:5",
			format: "JPEG",
		},
	};

	return specs[platform];
}
