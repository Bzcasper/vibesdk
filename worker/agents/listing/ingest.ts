/**
 * Input Ingest Agent
 *
 * Accepts raw input in any format and normalizes it into a ListingDraft.
 */

import { z } from "zod";
import { ListingStatus } from "../../types/env";

// ============================================================
// Types
// ============================================================

export type RawInputType = "freetext" | "structured_form" | "photo_description" | "bulk_csv_row";

export interface RawInput {
	type: RawInputType;
	content: string; // JSON stringified for structured inputs
	imageCount: number;
	sourceUrl?: string;
}

export interface ListingDraft {
	id: string; // UUID
	sku: string; // auto-generated
	rawInput: RawInput;
	fields: Record<string, unknown>; // empty at ingest, filled by enricher
	htmlDescription: string | null;
	csvRow: Record<string, string> | null;
	mediaAssets: string[]; // R2 keys
	status: ListingStatus;
	createdAt: string;
}

// ============================================================
// Validation Schemas
// ============================================================

const RawInputSchema = z.object({
	type: z.enum(["freetext", "structured_form", "photo_description", "bulk_csv_row"]),
	content: z.string(),
	imageCount: z.number().int().nonnegative().default(0),
	sourceUrl: z.string().url().optional(),
});

// ============================================================
// Error Classes
// ============================================================

export class InputValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InputValidationError";
	}
}

// ============================================================
// SKU Generator
// ============================================================

let sequenceCounter = 0;

function generateSKU(): string {
	const date = new Date();
	const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
	const seq = (sequenceCounter++ % 10000).toString().padStart(4, "0");
	return `LST-${dateStr}-${seq}`;
}

// ============================================================
// Main Normalize Function
// ============================================================

export function normalizeInput(input: unknown): ListingDraft {
	// Validate input
	const parsed = RawInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new InputValidationError(`Invalid input: ${parsed.error.message}`);
	}

	const rawInput = parsed.data;

	// Generate ID and SKU
	const id = crypto.randomUUID();
	const sku = generateSKU();

	// Create draft
	const draft: ListingDraft = {
		id,
		sku,
		rawInput: {
			type: rawInput.type,
			content: rawInput.content,
			imageCount: rawInput.imageCount,
			sourceUrl: rawInput.sourceUrl,
		},
		fields: {},
		htmlDescription: null,
		csvRow: null,
		mediaAssets: [],
		status: ListingStatus.DRAFT,
		createdAt: new Date().toISOString(),
	};

	return draft;
}

// ============================================================
// Bulk CSV Row Parser
// ============================================================

export function parseBulkCsvRow(row: Record<string, string>): RawInput {
	// Convert CSV row to structured content
	const parts: string[] = [];

	if (row.title) parts.push(`Title: ${row.title}`);
	if (row.brand) parts.push(`Brand: ${row.brand}`);
	if (row.model) parts.push(`Model: ${row.model}`);
	if (row.condition) parts.push(`Condition: ${row.condition}`);
	if (row.description) parts.push(`Description: ${row.description}`);
	if (row.price) parts.push(`Price: ${row.price}`);
	if (row.category) parts.push(`Category: ${row.category}`);

	return {
		type: "bulk_csv_row",
		content: parts.join("\n"),
		imageCount: 0,
	};
}

// ============================================================
// Structured Form Parser
// ============================================================

export function parseStructuredForm(data: Record<string, unknown>): RawInput {
	return {
		type: "structured_form",
		content: JSON.stringify(data),
		imageCount: typeof data.imageCount === "number" ? data.imageCount : 0,
	};
}
