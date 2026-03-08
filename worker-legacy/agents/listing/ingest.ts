import { ListingStatus } from "../../types/env";
import { z } from "zod";

export type RawInputType =
	| "freetext"
	| "structured_form"
	| "photo_description"
	| "bulk_csv_row";

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
	fields: Record<string, unknown>; // empty at ingest
	htmlDescription: string | null;
	csvRow: Record<string, string> | null;
	mediaAssets: string[]; // R2 keys
	status: ListingStatus;
	createdAt: string;
}

const RawInputSchema = z
	.object({
		type: z.enum([
			"freetext",
			"structured_form",
			"photo_description",
			"bulk_csv_row",
		]),
		content: z.string(),
		imageCount: z.number().int().nonnegative(),
		sourceUrl: z.string().optional(),
	})
	.required({ type: true, content: true, imageCount: true });

export class InputValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InputValidationError";
	}
}

export function normalizeInput(input: unknown): ListingDraft {
	const parsed = RawInputSchema.safeParse(input);
	if (!parsed.success) {
		throw new InputValidationError(
			`Invalid input: ${parsed.error.message}`,
		);
	}

	const id = crypto.randomUUID();
	const sku = `FACTORY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(0, 4).toUpperCase()}`;

	return {
		id,
		sku,
		rawInput: parsed.data as RawInput,
		fields: {},
		htmlDescription: null,
		csvRow: null,
		mediaAssets: [],
		status: ListingStatus.DRAFT,
		createdAt: new Date().toISOString(),
	};
}
