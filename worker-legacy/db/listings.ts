import { D1Database } from "@cloudflare/workers-types";
import { ListingStatus } from "../types/env";

export interface Listing {
	id: string;
	sku: string;
	status: ListingStatus;
	created_at: string;
}

export async function createListing(
	db: D1Database,
	sku: string,
): Promise<string> {
	const id = crypto.randomUUID();
	await db
		.prepare("INSERT INTO listings (id, sku, status) VALUES (?, ?, ?)")
		.bind(id, sku, ListingStatus.DRAFT)
		.run();
	return id;
}

export async function getListingById(
	db: D1Database,
	id: string,
): Promise<Listing | null> {
	const result = await db
		.prepare("SELECT * FROM listings WHERE id = ?")
		.bind(id)
		.first<Listing>();
	return result || null;
}
