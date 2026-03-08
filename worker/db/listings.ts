/**
 * D1 Query Layer for Listings
 * All queries use prepared statements with .bind() — no string concatenation in SQL
 */

import { D1Database } from "@cloudflare/workers-types";
import { z } from "zod";
import { ListingStatus, UploadJobStatus } from "../types/env";

// ============================================================
// Zod Schemas for D1 Row Validation
// ============================================================

export const ListingSchema = z.object({
	id: z.string(),
	sku: z.string(),
	status: z.nativeEnum(ListingStatus),
	title: z.string().nullable(),
	description: z.string().nullable(),
	category_id: z.string().nullable(),
	condition_grade: z.string().nullable(),
	brand: z.string().nullable(),
	model: z.string().nullable(),
	price_suggested: z.number().nullable(),
	price_final: z.number().nullable(),
	quantity: z.number().default(1),
	platforms: z.string().nullable(), // JSON string
	html_description: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	published_at: z.string().nullable(),
});

export const ListingFieldSchema = z.object({
	id: z.string(),
	listing_id: z.string(),
	key: z.string(),
	value: z.string(),
	ai_suggested: z.number().transform((v) => v === 1),
	confidence: z.number().nullable(),
	created_at: z.string(),
});

export const MediaAssetSchema = z.object({
	id: z.string(),
	listing_id: z.string(),
	r2_key: z.string(),
	original_filename: z.string().nullable(),
	mime_type: z.string(),
	size_bytes: z.number(),
	width: z.number().nullable(),
	height: z.number().nullable(),
	status: z.string(),
	public_url: z.string().nullable(),
	created_at: z.string(),
});

export const CSVExportSchema = z.object({
	id: z.string(),
	listing_count: z.number(),
	r2_key: z.string().nullable(),
	status: z.string(),
	error_message: z.string().nullable(),
	created_at: z.string(),
	completed_at: z.string().nullable(),
});

export const UploadJobSchema = z.object({
	id: z.string(),
	export_id: z.string(),
	status: z.nativeEnum(UploadJobStatus),
	success_count: z.number().default(0),
	error_count: z.number().default(0),
	error_messages: z.string().nullable(), // JSON string
	started_at: z.string().nullable(),
	completed_at: z.string().nullable(),
	created_at: z.string(),
});

export const DispatchLogSchema = z.object({
	id: z.string(),
	listing_id: z.string(),
	action: z.string(),
	platform: z.string().nullable(),
	status: z.string(),
	details: z.string().nullable(), // JSON string
	created_at: z.string(),
});

// ============================================================
// Types
// ============================================================

export type Listing = z.infer<typeof ListingSchema>;
export type ListingField = z.infer<typeof ListingFieldSchema>;
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
export type CSVExport = z.infer<typeof CSVExportSchema>;
export type UploadJob = z.infer<typeof UploadJobSchema>;
export type DispatchLogEntry = z.infer<typeof DispatchLogSchema>;

export interface ListingWithFields extends Listing {
	fields: Record<string, { value: string; aiSuggested: boolean; confidence: number | null }>;
}

// ============================================================
// Listing Queries
// ============================================================

export async function createListing(
	db: D1Database,
	params: { sku: string; title?: string; description?: string }
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO listings (id, sku, status, title, description, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(id, params.sku, ListingStatus.DRAFT, params.title || null, params.description || null, now, now)
		.run();

	return id;
}

export async function getListingById(db: D1Database, id: string): Promise<Listing | null> {
	const result = await db
		.prepare("SELECT * FROM listings WHERE id = ?")
		.bind(id)
		.first();

	if (!result) return null;

	return ListingSchema.parse(result);
}

export async function getListingBySku(db: D1Database, sku: string): Promise<Listing | null> {
	const result = await db
		.prepare("SELECT * FROM listings WHERE sku = ?")
		.bind(sku)
		.first();

	if (!result) return null;

	return ListingSchema.parse(result);
}

export async function listListingsByStatus(
	db: D1Database,
	status: ListingStatus,
	limit: number = 50,
	offset: number = 0
): Promise<Listing[]> {
	const results = await db
		.prepare("SELECT * FROM listings WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
		.bind(status, limit, offset)
		.all();

	return results.results.map((r) => ListingSchema.parse(r));
}

export async function listAllListings(
	db: D1Database,
	limit: number = 50,
	offset: number = 0
): Promise<Listing[]> {
	const results = await db
		.prepare("SELECT * FROM listings ORDER BY created_at DESC LIMIT ? OFFSET ?")
		.bind(limit, offset)
		.all();

	return results.results.map((r) => ListingSchema.parse(r));
}

export async function updateListingStatus(
	db: D1Database,
	id: string,
	status: ListingStatus
): Promise<void> {
	const now = new Date().toISOString();
	const publishedAt = status === ListingStatus.PUBLISHED ? now : null;

	await db
		.prepare("UPDATE listings SET status = ?, updated_at = ?, published_at = COALESCE(?, published_at) WHERE id = ?")
		.bind(status, now, publishedAt, id)
		.run();
}

export async function updateListing(
	db: D1Database,
	id: string,
	updates: Partial<Omit<Listing, 'id' | 'created_at'>>
): Promise<void> {
	const fields: string[] = [];
	const values: unknown[] = [];

	if (updates.title !== undefined) {
		fields.push("title = ?");
		values.push(updates.title);
	}
	if (updates.description !== undefined) {
		fields.push("description = ?");
		values.push(updates.description);
	}
	if (updates.category_id !== undefined) {
		fields.push("category_id = ?");
		values.push(updates.category_id);
	}
	if (updates.condition_grade !== undefined) {
		fields.push("condition_grade = ?");
		values.push(updates.condition_grade);
	}
	if (updates.brand !== undefined) {
		fields.push("brand = ?");
		values.push(updates.brand);
	}
	if (updates.model !== undefined) {
		fields.push("model = ?");
		values.push(updates.model);
	}
	if (updates.price_suggested !== undefined) {
		fields.push("price_suggested = ?");
		values.push(updates.price_suggested);
	}
	if (updates.price_final !== undefined) {
		fields.push("price_final = ?");
		values.push(updates.price_final);
	}
	if (updates.html_description !== undefined) {
		fields.push("html_description = ?");
		values.push(updates.html_description);
	}

	if (fields.length === 0) return;

	fields.push("updated_at = ?");
	values.push(new Date().toISOString());
	values.push(id);

	await db
		.prepare(`UPDATE listings SET ${fields.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

export async function deleteListing(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM listings WHERE id = ?").bind(id).run();
}

// ============================================================
// Listing Fields (Key-Value Store)
// ============================================================

export async function setListingField(
	db: D1Database,
	params: {
		listingId: string;
		key: string;
		value: string;
		aiSuggested: boolean;
		confidence: number | null;
	}
): Promise<void> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO listing_fields (id, listing_id, key, value, ai_suggested, confidence, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(listing_id, key) DO UPDATE SET
				value = excluded.value,
				ai_suggested = excluded.ai_suggested,
				confidence = excluded.confidence
		`)
		.bind(
			id,
			params.listingId,
			params.key,
			params.value,
			params.aiSuggested ? 1 : 0,
			params.confidence,
			now
		)
		.run();
}

export async function getListingFields(
	db: D1Database,
	listingId: string
): Promise<Record<string, { value: string; aiSuggested: boolean; confidence: number | null }>> {
	const results = await db
		.prepare("SELECT * FROM listing_fields WHERE listing_id = ?")
		.bind(listingId)
		.all();

	const fields: Record<string, { value: string; aiSuggested: boolean; confidence: number | null }> = {};

	for (const row of results.results) {
		const parsed = ListingFieldSchema.parse(row);
		fields[parsed.key] = {
			value: parsed.value,
			aiSuggested: parsed.ai_suggested,
			confidence: parsed.confidence,
		};
	}

	return fields;
}

export async function getListingWithFields(
	db: D1Database,
	id: string
): Promise<ListingWithFields | null> {
	const listing = await getListingById(db, id);
	if (!listing) return null;

	const fields = await getListingFields(db, id);
	return { ...listing, fields };
}

// ============================================================
// Media Assets
// ============================================================

export async function createMediaAsset(
	db: D1Database,
	asset: Omit<MediaAsset, "id" | "created_at">
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO media_assets (id, listing_id, r2_key, original_filename, mime_type, size_bytes, width, height, status, public_url, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(
			id,
			asset.listing_id,
			asset.r2_key,
			asset.original_filename,
			asset.mime_type,
			asset.size_bytes,
			asset.width,
			asset.height,
			asset.status,
			asset.public_url,
			now
		)
		.run();

	return id;
}

export async function getMediaAssetsByListing(db: D1Database, listingId: string): Promise<MediaAsset[]> {
	const results = await db
		.prepare("SELECT * FROM media_assets WHERE listing_id = ? ORDER BY created_at")
		.bind(listingId)
		.all();

	return results.results.map((r) => MediaAssetSchema.parse(r));
}

export async function updateMediaAssetStatus(
	db: D1Database,
	id: string,
	status: string,
	publicUrl?: string
): Promise<void> {
	if (publicUrl) {
		await db
			.prepare("UPDATE media_assets SET status = ?, public_url = ? WHERE id = ?")
			.bind(status, publicUrl, id)
			.run();
	} else {
		await db
			.prepare("UPDATE media_assets SET status = ? WHERE id = ?")
			.bind(status, id)
			.run();
	}
}

// ============================================================
// CSV Exports
// ============================================================

export async function createCSVExport(
	db: D1Database,
	listingIds: string[]
): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO csv_exports (id, listing_count, status, created_at)
			VALUES (?, ?, ?, ?)
		`)
		.bind(id, listingIds.length, "pending", now)
		.run();

	return id;
}

export async function getCSVExportById(db: D1Database, id: string): Promise<CSVExport | null> {
	const result = await db
		.prepare("SELECT * FROM csv_exports WHERE id = ?")
		.bind(id)
		.first();

	if (!result) return null;
	return CSVExportSchema.parse(result);
}

export async function updateCSVExport(
	db: D1Database,
	id: string,
	updates: Partial<Pick<CSVExport, 'r2_key' | 'status' | 'error_message' | 'completed_at'>>
): Promise<void> {
	const fields: string[] = [];
	const values: unknown[] = [];

	if (updates.r2_key !== undefined) {
		fields.push("r2_key = ?");
		values.push(updates.r2_key);
	}
	if (updates.status !== undefined) {
		fields.push("status = ?");
		values.push(updates.status);
	}
	if (updates.error_message !== undefined) {
		fields.push("error_message = ?");
		values.push(updates.error_message);
	}
	if (updates.completed_at !== undefined) {
		fields.push("completed_at = ?");
		values.push(updates.completed_at);
	}

	if (fields.length === 0) return;
	values.push(id);

	await db
		.prepare(`UPDATE csv_exports SET ${fields.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

// ============================================================
// Upload Jobs
// ============================================================

export async function createUploadJob(db: D1Database, exportId: string): Promise<string> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO upload_jobs (id, export_id, status, created_at)
			VALUES (?, ?, ?, ?)
		`)
		.bind(id, exportId, UploadJobStatus.PENDING, now)
		.run();

	return id;
}

export async function getUploadJobById(db: D1Database, id: string): Promise<UploadJob | null> {
	const result = await db
		.prepare("SELECT * FROM upload_jobs WHERE id = ?")
		.bind(id)
		.first();

	if (!result) return null;
	return UploadJobSchema.parse(result);
}

export async function updateUploadJob(
	db: D1Database,
	id: string,
	updates: Partial<Omit<UploadJob, 'id' | 'export_id' | 'created_at'>>
): Promise<void> {
	const fields: string[] = [];
	const values: unknown[] = [];

	if (updates.status !== undefined) {
		fields.push("status = ?");
		values.push(updates.status);
	}
	if (updates.success_count !== undefined) {
		fields.push("success_count = ?");
		values.push(updates.success_count);
	}
	if (updates.error_count !== undefined) {
		fields.push("error_count = ?");
		values.push(updates.error_count);
	}
	if (updates.error_messages !== undefined) {
		fields.push("error_messages = ?");
		values.push(updates.error_messages);
	}
	if (updates.started_at !== undefined) {
		fields.push("started_at = ?");
		values.push(updates.started_at);
	}
	if (updates.completed_at !== undefined) {
		fields.push("completed_at = ?");
		values.push(updates.completed_at);
	}

	if (fields.length === 0) return;
	values.push(id);

	await db
		.prepare(`UPDATE upload_jobs SET ${fields.join(", ")} WHERE id = ?`)
		.bind(...values)
		.run();
}

// ============================================================
// Dispatch Log
// ============================================================

export async function logDispatch(
	db: D1Database,
	entry: {
		listingId: string;
		action: string;
		platform?: string;
		status: string;
		details?: string;
	}
): Promise<void> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db
		.prepare(`
			INSERT INTO dispatch_log (id, listing_id, action, platform, status, details, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`)
		.bind(id, entry.listingId, entry.action, entry.platform || null, entry.status, entry.details || null, now)
		.run();
}

export async function getDispatchLogByListing(
	db: D1Database,
	listingId: string
): Promise<DispatchLogEntry[]> {
	const results = await db
		.prepare("SELECT * FROM dispatch_log WHERE listing_id = ? ORDER BY created_at DESC")
		.bind(listingId)
		.all();

	return results.results.map((r) => DispatchLogSchema.parse(r));
}
