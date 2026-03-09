/**
 * Dispatch Orchestrator
 * Coordinates multi-platform publishing of enriched listings
 * 
 * Flow: Enriched Listing → Platform-specific builders → Queue jobs → Dispatch
 */

import { D1Database, Queue } from "@cloudflare/workers-types";
import type { PlatformName } from "../../../src/api-types";

export interface DispatchResult {
	platform: PlatformName;
	status: "queued" | "success" | "failed";
	job_id?: string;
	error?: string;
	external_id?: string; // Platform's listing ID if published
	url?: string; // Public URL on platform
}

export interface DispatchRequest {
	listing_id: string;
	platforms: PlatformName[];
	listing: {
		title?: string;
		description?: string;
		price_suggested?: number;
		category_id?: string;
	};
	images: Array<{
		r2_key: string;
		position: number;
		is_primary: boolean;
	}>;
}

/**
 * Main dispatch orchestrator
 * Takes enriched listing and publishes to multiple platforms
 */
export async function dispatchToAllPlatforms(
	request: DispatchRequest,
	_db: D1Database,
	queues: {
		dispatch: Queue;
		media: Queue;
		social: Queue;
	}
): Promise<DispatchResult[]> {
	const results: DispatchResult[] = [];

	for (const platform of request.platforms) {
		try {
			const result = await dispatchToPlatform(
				request,
				platform,
				queues
			);
			results.push(result);

			// Log dispatch attempt
			// TODO: Insert into dispatch_logs table
			console.log(`[${platform}] Dispatch queued`, {
				listing_id: request.listing_id,
				job_id: result.job_id,
			});
		} catch (err) {
			results.push({
				platform,
				status: "failed",
				error: `Dispatch error: ${(err as Error).message}`,
			});
		}
	}

	return results;
}

/**
 * Route to platform-specific dispatcher
 */
async function dispatchToPlatform(
	request: DispatchRequest,
	platform: PlatformName,
	queues: { dispatch: Queue; media: Queue; social: Queue }
): Promise<DispatchResult> {
	switch (platform) {
		case "ebay":
			return dispatchEbay(request, queues.dispatch);

		case "shopify":
			return dispatchShopify(request, queues.dispatch);

		case "etsy":
			return dispatchEtsy(request, queues.dispatch);

		case "facebook":
			return dispatchFacebook(request, queues.dispatch);

		case "tiktok":
		case "pinterest":
		case "instagram":
			// Social platforms get content generation first
			return dispatchSocial(request, platform, queues.social);

		case "poshmark":
		case "whatnot":
		case "mercari":
			// Browser-automation platforms
			return dispatchBrowserAutomation(request, platform, queues.dispatch);

		default:
			throw new Error(`Unknown platform: ${platform}`);
	}
}

/**
 * eBay: CSV generation + browser upload
 */
async function dispatchEbay(
	request: DispatchRequest,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `ebay-${request.listing_id}-${Date.now()}`;

	// Queue CSV generation + browser upload job
	await queue.send({
		type: "ebay_upload",
		listing_id: request.listing_id,
		job_id,
		batch_size: 1, // Single listing
	});

	return {
		platform: "ebay",
		status: "queued",
		job_id,
	};
}

/**
 * Shopify, Etsy, Facebook: API-based listing creation
 */
async function dispatchShopify(
	request: DispatchRequest,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `shopify-${request.listing_id}-${Date.now()}`;

	await queue.send({
		type: "shopify_create_product",
		listing_id: request.listing_id,
		job_id,
		title: request.listing.title,
		description: request.listing.description,
		price: request.listing.price_suggested,
		images: request.images,
	});

	return {
		platform: "shopify",
		status: "queued",
		job_id,
	};
}

async function dispatchEtsy(
	request: DispatchRequest,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `etsy-${request.listing_id}-${Date.now()}`;

	await queue.send({
		type: "etsy_create_listing",
		listing_id: request.listing_id,
		job_id,
		title: request.listing.title,
		description: request.listing.description,
		price: request.listing.price_suggested,
		images: request.images,
	});

	return {
		platform: "etsy",
		status: "queued",
		job_id,
	};
}

async function dispatchFacebook(
	request: DispatchRequest,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `facebook-${request.listing_id}-${Date.now()}`;

	await queue.send({
		type: "facebook_marketplace_post",
		listing_id: request.listing_id,
		job_id,
		title: request.listing.title,
		description: request.listing.description,
		price: request.listing.price_suggested,
		images: request.images,
		category: request.listing.category_id,
	});

	return {
		platform: "facebook",
		status: "queued",
		job_id,
	};
}

/**
 * TikTok, Pinterest, Instagram: Generate content first, then queue
 */
async function dispatchSocial(
	request: DispatchRequest,
	platform: PlatformName,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `${platform}-${request.listing_id}-${Date.now()}`;

	await queue.send({
		type: `${platform}_generate_content`,
		listing_id: request.listing_id,
		job_id,
		platform,
		title: request.listing.title,
		description: request.listing.description,
		images: request.images,
	});

	return {
		platform,
		status: "queued",
		job_id,
	};
}

/**
 * Poshmark, Whatnot, Mercari: Browser automation
 */
async function dispatchBrowserAutomation(
	request: DispatchRequest,
	platform: PlatformName,
	queue: Queue
): Promise<DispatchResult> {
	const job_id = `${platform}-${request.listing_id}-${Date.now()}`;

	await queue.send({
		type: `${platform}_browser_upload`,
		listing_id: request.listing_id,
		job_id,
		platform,
		title: request.listing.title,
		description: request.listing.description,
		price: request.listing.price_suggested,
		images: request.images,
	});

	return {
		platform,
		status: "queued",
		job_id,
	};
}
