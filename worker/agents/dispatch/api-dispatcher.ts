/**
 * API-Based Platform Dispatchers
 * Shopify, Etsy, Facebook - REST/Graph API publishing
 */

import { D1Database, KVNamespace } from "@cloudflare/workers-types";

export interface ApiDispatchJob {
	listing_id: string;
	job_id: string;
	platform: "shopify" | "etsy" | "facebook";
	title: string;
	description: string;
	price: number;
	images: Array<{ r2_key: string; position: number; is_primary: boolean }>;
	category?: string;
}

/**
 * Shopify REST API - Create Product
 */
export async function handleShopifyCreate(
	job: ApiDispatchJob,
	db: D1Database,
	kv: KVNamespace
): Promise<{ success: boolean; external_id?: string; error?: string }> {
	try {
		console.log(`[Shopify] Processing job ${job.job_id}`);

		// Get Shopify credentials
		const shopifyConfig = await kv.get("shopify:config");
		if (!shopifyConfig) {
			throw new Error("Shopify not configured");
		}

		const { shop_domain, access_token } = JSON.parse(shopifyConfig);

		// Build Shopify product payload
		const shopifyProduct = {
			product: {
				title: job.title,
				body_html: `<p>${job.description}</p>`,
				vendor: "Your Jewelry Store",
				product_type: "Jewelry",
				variants: [
					{
						price: job.price.toString(),
						weight: 0,
						weight_unit: "g",
					},
				],
				images: job.images.map((img) => ({
					src: `https://r2.example.com/${img.r2_key}`, // TODO: Real R2 URL
					position: img.position,
				})),
				tags: ["pre-owned", "jewelry", "vintage"],
			},
		};

		// Call Shopify API
		const response = await fetch(
			`https://${shop_domain}/admin/api/2024-01/products.json`,
			{
				method: "POST",
				headers: {
					"X-Shopify-Access-Token": access_token,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(shopifyProduct),
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Shopify API error: ${response.status} - ${error}`);
		}

		const { product } = (await response.json()) as { product: { id: number } };
		const productId = product.id.toString();
		const shopifyUrl = `https://${shop_domain}/admin/products/${productId}`;

		// Log success
		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "shopify",
			status: "published",
			external_id: productId,
			url: shopifyUrl,
			job_id: job.job_id,
		});

		console.log(`[Shopify] ✅ Product ${productId} created`);

		return { success: true, external_id: productId };
	} catch (err) {
		const error = (err as Error).message;

		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "shopify",
			status: "failed",
			error,
			job_id: job.job_id,
		});

		console.error(`[Shopify] ❌ Error:`, error);
		return { success: false, error };
	}
}

/**
 * Etsy REST API - Create Listing
 */
export async function handleEtsyCreate(
	job: ApiDispatchJob,
	db: D1Database,
	kv: KVNamespace
): Promise<{ success: boolean; external_id?: string; error?: string }> {
	try {
		console.log(`[Etsy] Processing job ${job.job_id}`);

		// Get Etsy credentials
		const etsyConfig = await kv.get("etsy:config");
		if (!etsyConfig) {
			throw new Error("Etsy not configured");
		}

		const { access_token, shop_id } = JSON.parse(etsyConfig);

		// Build Etsy listing payload
		const etsyListing = {
			quantity: 1,
			title: job.title,
			description: job.description,
			price: job.price,
			category_id: 68887261, // Jewelry category
			listing_type: "fixed",
			tags: ["pre-owned", "jewelry", "vintage"],
		};

		// Call Etsy API
		const response = await fetch(
			`https://openapi.etsy.com/v3/application/shops/${shop_id}/listings`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(etsyListing),
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Etsy API error: ${response.status} - ${error}`);
		}

		const { listing_id } = (await response.json()) as { listing_id: number };
		const etsyUrl = `https://www.etsy.com/listing/${listing_id}`;

		// Log success
		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "etsy",
			status: "published",
			external_id: listing_id.toString(),
			url: etsyUrl,
			job_id: job.job_id,
		});

		console.log(`[Etsy] ✅ Listing ${listing_id} created`);

		return { success: true, external_id: listing_id.toString() };
	} catch (err) {
		const error = (err as Error).message;

		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "etsy",
			status: "failed",
			error,
			job_id: job.job_id,
		});

		console.error(`[Etsy] ❌ Error:`, error);
		return { success: false, error };
	}
}

/**
 * Facebook Graph API - Create Marketplace Listing
 */
export async function handleFacebookCreate(
	job: ApiDispatchJob,
	db: D1Database,
	kv: KVNamespace
): Promise<{ success: boolean; external_id?: string; error?: string }> {
	try {
		console.log(`[Facebook] Processing job ${job.job_id}`);

		// Get Facebook credentials
		const fbConfig = await kv.get("facebook:config");
		if (!fbConfig) {
			throw new Error("Facebook not configured");
		}

		const { access_token, catalog_id } = JSON.parse(fbConfig);

		// Build Facebook marketplace payload
		const fbPayload = {
			name: job.title,
			description: job.description,
			price: Math.round(job.price * 100), // Price in cents
			category: "jewelry",
			availability: "FOR_SALE",
			image_urls: job.images.map((img) => `https://r2.example.com/${img.r2_key}`),
		};

		// Call Facebook Graph API
		const response = await fetch(
			`https://graph.facebook.com/v18.0/${catalog_id}/products`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${access_token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(fbPayload),
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Facebook API error: ${response.status} - ${error}`);
		}

		const { id } = (await response.json()) as { id: string };
		const fbUrl = `https://www.facebook.com/marketplace/item/${id}`;

		// Log success
		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "facebook",
			status: "published",
			external_id: id,
			url: fbUrl,
			job_id: job.job_id,
		});

		console.log(`[Facebook] ✅ Listing ${id} created`);

		return { success: true, external_id: id };
	} catch (err) {
		const error = (err as Error).message;

		await logDispatch(db, {
			listing_id: job.listing_id,
			platform: "facebook",
			status: "failed",
			error,
			job_id: job.job_id,
		});

		console.error(`[Facebook] ❌ Error:`, error);
		return { success: false, error };
	}
}

/**
 * Log dispatch to D1
 */
async function logDispatch(
	_db: D1Database,
	data: {
		listing_id: string;
		platform: string;
		status: "published" | "failed";
		external_id?: string;
		url?: string;
		error?: string;
		job_id: string;
	}
): Promise<void> {
	// TODO: Insert into dispatch_logs
	console.log(`[${data.platform}] Dispatch logged:`, data);
}
