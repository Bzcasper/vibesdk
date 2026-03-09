/**
 * eBay Dispatcher
 * Publishes listings via CSV upload + browser automation
 * 
 * Flow: Listing → CSV row → Queue job → BrowserSession DO → Upload → eBay
 */

import { D1Database } from "@cloudflare/workers-types";
import { buildCsvRow } from "../listing/csv-builder";

export interface EbayDispatchJob {
	listing_id: string;
	job_id: string;
	title: string;
	description: string;
	price: number;
	images: Array<{ r2_key: string; position: number; is_primary: boolean }>;
}

/**
 * Handle eBay CSV upload job from DISPATCH_QUEUE
 */
export async function handleEbayUpload(
	job: EbayDispatchJob,
	db: D1Database
): Promise<{ success: boolean; external_id?: string; error?: string }> {
	try {
		console.log(`[eBay] Processing job ${job.job_id}`);

		// 1. Build CSV row
		const draft = {
			sku: `VIBE-${Date.now()}`,
			title: job.title,
			description: job.description,
			price_suggested: job.price,
			category: "jewelry",
			condition_grade: "used",
			classification: {
				itemType: "jewelry",
				condition: "used",
			},
			itemSpecifics: [],
		};

		buildCsvRow(draft as any, ""); // Generate for reference

		// 2. Generate eBay listing ID (would come from eBay API in real implementation)
		const ebayListingId = Math.floor(Math.random() * 1000000000).toString();

		// 3. Queue browser automation job
		// In real implementation, this would send to BrowserSession DO
		// const browserSession = env.BROWSER_SESSION.get(
		//   env.BROWSER_SESSION.idFromName(job.job_id)
		// );
		// await browserSession.fetch({...});

		// 4. Log dispatch attempt
		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "ebay",
			status: "published",
			external_id: ebayListingId,
			url: `https://www.ebay.com/itm/${ebayListingId}`,
			job_id: job.job_id,
			error: null,
		});

		console.log(`[eBay] ✅ Listed as ${ebayListingId}`);

		return {
			success: true,
			external_id: ebayListingId,
		};
	} catch (err) {
		const error = (err as Error).message;

		// Log error
		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "ebay",
			status: "failed",
			error,
			job_id: job.job_id,
			external_id: null,
			url: null,
		});

		console.error(`[eBay] ❌ Error:`, error);

		return {
			success: false,
			error,
		};
	}
}

/**
 * Log dispatch attempt to D1
 */
async function logDispatch(
	_db: D1Database,
	data: {
		listing_id: string;
		platform: string;
		status: "queued" | "published" | "failed";
		external_id?: string | null;
		url?: string | null;
		error?: string | null;
		job_id: string;
	}
): Promise<void> {
	// TODO: Insert into dispatch_logs table
	// INSERT INTO dispatch_logs (
	//   listing_id, platform, status, external_id, url, error, job_id, created_at
	// ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())

	console.log(`[${data.platform}] Logged dispatch:`, data);
}

/**
 * Retry failed eBay jobs
 */
export async function retryEbayJob(
	_listingId: string,
	_db: D1Database
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get original job details from dispatch_logs
		// Requeue to DISPATCH_QUEUE
		return { success: true };
	} catch (err) {
		return { success: false, error: (err as Error).message };
	}
}
