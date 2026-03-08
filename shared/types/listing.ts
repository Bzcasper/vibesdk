import { ListingStatus } from "../../worker/types/env";

export interface Listing {
	id: string;
	sku: string;
	status: ListingStatus;
	createdAt: string;
}

export interface ListingInput {
	type: "freetext" | "structured_form" | "photo_description" | "bulk_csv_row";
	content: string;
	imageCount: number;
}
