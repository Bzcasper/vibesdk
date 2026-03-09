/**
 * CSV Builder
 *
 * Generates eBay File Exchange CSV format for bulk uploads.
 * Supports all required eBay listing fields.
 */

import { EnrichedDraft } from "./enricher";

// ============================================================
// eBay File Exchange Column Headers
// ============================================================

const EBAY_CSV_HEADERS = [
	"Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
	"ItemID",
	"Title",
	"Subtitle",
	"Relationship",
	"RelationshipDetails",
	"*StartPrice",
	"BuyItNowPrice",
	"ReservePrice",
	"Quantity",
	"Duration",
	"Location",
	"PostalCode",
	"PayPalAccepted",
	"PayPalEmailAddress",
	"PaymentInstructions",
	"StoreCategory",
	"StoreCategory2",
	"ConditionID",
	"Brand",
	"MPN",
	"UPC",
	"EAN",
	"ISBN",
	"PicURL",
	"Description",
	"Format",
	"BestOfferEnabled",
	"BestOfferAutoAcceptPrice",
	"BestOfferAutoDeclinePrice",
	"DispatchTimeMax",
	"ShippingType",
	"ShippingServiceCost:1",
	"ShippingServiceAdditionalCost:1",
	"ShippingService:1",
	"FreeShipping:1",
	"ShippingServiceCost:2",
	"ShippingServiceAdditionalCost:2",
	"ShippingService:2",
	"FreeShipping:2",
	"ReturnPolicy",
	"ReturnsAcceptedOption",
	"ReturnsWithinOption",
	"ShippingCostPaidByOption",
	"RefundOption",
	"Category",
	"C:Brand",
	"C:Model",
	"C:Type",
	"C:Material",
	"C:Color",
	"C:Size",
	"C:Style",
	"C:Features",
	"CustomLabel",
	"SKU",
	"OutOfStockControl",
	"StartTime",
	"EndTime",
	"HitCounter",
	"ViewItemURL",
	"ListingType",
	"PrimaryCategoryName",
	"SecondaryCategory",
	"SecondaryCategoryName",
];

// ============================================================
// Condition ID Mapping
// ============================================================

const CONDITION_ID_MAP: Record<string, string> = {
	New: "1000",
	"New with tags": "1000",
	"New without tags": "1500",
	"New with defects": "1750",
	Excellent: "2000",
	"Very Good": "2020",
	VeryGood: "2020",
	Good: "3000",
	"Good - Refurbished": "2030",
	Fair: "4000",
	"For parts or not working": "7000",
	"Manufacturer refurbished": "2500",
	"Seller refurbished": "3000",
	Used: "3000",
};

// ============================================================
// CSV Row Builder
// ============================================================

export function buildCsvRow(draft: EnrichedDraft, imageUrl: string = ""): Record<string, string> {
	const { classification, itemSpecifics, title, description, pricing } = draft;
	const sku = draft.sku || `SKU-${Date.now()}`;

	// Build item specifics columns
	const specifics: Record<string, string> = {};
	for (const spec of itemSpecifics) {
		const key = `C:${spec.name}`;
		specifics[key] = spec.value;
	}

	// Build the CSV row
	const row: Record<string, string> = {
		"Action(SiteID=US|Country=US|Currency=USD|Version=1193)": "Add",
		ItemID: "",
		Title: title.slice(0, 80),
		Subtitle: "",
		Relationship: "",
		RelationshipDetails: "",
		"*StartPrice": pricing.suggested_price.toFixed(2),
		BuyItNowPrice: "",
		ReservePrice: "",
		Quantity: "1",
		Duration: "GTC", // Good 'Til Cancelled
		Location: "United States",
		PostalCode: "",
		PayPalAccepted: "1",
		PayPalEmailAddress: "",
		PaymentInstructions: "",
		StoreCategory: "",
		StoreCategory2: "",
		ConditionID: CONDITION_ID_MAP[classification.condition_grade] || "3000",
		Brand: classification.brand || "",
		MPN: classification.model || "",
		UPC: "Does not apply",
		EAN: "",
		ISBN: "",
		PicURL: imageUrl,
		Description: description.short_description,
		Format: "FixedPrice",
		BestOfferEnabled: "0",
		BestOfferAutoAcceptPrice: "",
		BestOfferAutoDeclinePrice: "",
		DispatchTimeMax: "3",
		ShippingType: "Flat",
		"ShippingServiceCost:1": "0.00",
		"ShippingServiceAdditionalCost:1": "0.00",
		"ShippingService:1": "USPSPriority",
		"FreeShipping:1": "1",
		"ShippingServiceCost:2": "",
		"ShippingServiceAdditionalCost:2": "",
		"ShippingService:2": "",
		"FreeShipping:2": "",
		ReturnPolicy: "",
		ReturnsAcceptedOption: "ReturnsAccepted",
		"ReturnsWithinOption": "Days_30",
		"ShippingCostPaidByOption": "Buyer",
		RefundOption: "MoneyBack",
		Category: classification.ebay_category_id?.toString() || "",
		"C:Brand": classification.brand || "",
		"C:Model": classification.model || "",
		"C:Type": classification.item_type || "",
		"C:Material": classification.primary_material || "",
		"C:Color": "",
		"C:Size": "",
		"C:Style": "",
		"C:Features": "",
		CustomLabel: sku,
		SKU: sku,
		OutOfStockControl: "0",
		StartTime: "",
		EndTime: "",
		HitCounter: "NoHitCounter",
		ViewItemURL: "",
		ListingType: "FixedPriceItem",
		PrimaryCategoryName: classification.category_name || "",
		SecondaryCategory: "",
		SecondaryCategoryName: "",
		...specifics,
	};

	return row;
}

// ============================================================
// CSV String Builder
// ============================================================

function escapeCsvField(value: string): string {
	if (!value) return "";
	// If contains comma, quote, or newline, wrap in quotes
	if (value.includes(",") || value.includes('"') || value.includes("\n")) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

export function buildCsvString(rows: Record<string, string>[]): string {
	// Header row
	const headerLine = EBAY_CSV_HEADERS.join(",");

	// Data rows
	const dataLines = rows.map((row) => {
		return EBAY_CSV_HEADERS.map((header) => escapeCsvField(row[header] || "")).join(",");
	});

	return [headerLine, ...dataLines].join("\n");
}

// ============================================================
// Bulk CSV Generator
// ============================================================

export interface CsvExportResult {
	csv: string;
	rowCount: number;
	errors: Array<{ sku: string; error: string }>;
}

export function buildBulkCsv(
	drafts: EnrichedDraft[],
	imageUrls: Map<string, string> = new Map()
): CsvExportResult {
	const rows: Record<string, string>[] = [];
	const errors: Array<{ sku: string; error: string }> = [];

	for (const draft of drafts) {
		try {
			const imageUrl = imageUrls.get(draft.id) || "";
			const row = buildCsvRow(draft, imageUrl);
			rows.push(row);
		} catch (error) {
			errors.push({
				sku: draft.sku,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return {
		csv: buildCsvString(rows),
		rowCount: rows.length,
		errors,
	};
}

// ============================================================
// CSV Validation
// ============================================================

export function validateCsvRow(row: Record<string, string>): string[] {
	const errors: string[] = [];

	// Required fields
	if (!row.Title || row.Title.length === 0) {
		errors.push("Title is required");
	}
	if (row.Title && row.Title.length > 80) {
		errors.push("Title must be 80 characters or less");
	}
	if (!row["*StartPrice"] || parseFloat(row["*StartPrice"]) < 0) {
		errors.push("Valid start price is required");
	}
	if (!row.Category && !row.PrimaryCategoryName) {
		errors.push("Category is required");
	}

	return errors;
}

export function validateBulkCsv(rows: Record<string, string>[]): Map<number, string[]> {
	const results = new Map<number, string[]>();

	rows.forEach((row, index) => {
		const errors = validateCsvRow(row);
		if (errors.length > 0) {
			results.set(index, errors);
		}
	});

	return results;
}
