/**
 * Pinterest Content Generator
 *
 * Generates Pinterest pin content for listings.
 */

import { z } from "zod";
import { Env } from "../../types/env";
import { EnrichedDraft } from "../listing/enricher";
import { SocialGenerationError } from "./tiktok";
import { TikTokPackage } from "./tiktok";

// ============================================================
// Types
// ============================================================

export interface PinterestPin {
	title: string; // ≤100 chars
	description: string; // ≤500 chars — include price naturally
	alt_text: string; // for accessibility and SEO
	keywords: string[]; // 5-10 search keywords
	board_suggestions: string[]; // 3-5 board names
}

export interface PinterestCarouselPin extends PinterestPin {
	slides: Array<{
		title: string;
		description: string;
	}>;
}

export interface PinterestPackage {
	main_pin: PinterestPin;
	variation_pins: PinterestPin[]; // 2-3 variations
	product_rich_pins: {
		price: string;
		availability: "in stock" | "out of stock" | "preorder";
		brand: string;
		condition: "new" | "used" | "refurbished";
	};
}

// ============================================================
// Zod Schemas
// ============================================================

const PinterestPinSchema = z.object({
	title: z.string().max(100),
	description: z.string().max(500),
	alt_text: z.string(),
	keywords: z.array(z.string()).min(5).max(10),
	board_suggestions: z.array(z.string()).min(3).max(5),
});

const PinterestCarouselPinSchema = PinterestPinSchema.extend({
	slides: z.array(
		z.object({
			title: z.string(),
			description: z.string(),
		})
	),
});

const PinterestPackageSchema = z.object({
	main_pin: PinterestPinSchema,
	variation_pins: z.array(PinterestPinSchema).min(2).max(3),
	product_rich_pins: z.object({
		price: z.string(),
		availability: z.enum(["in stock", "out of stock", "preorder"]),
		brand: z.string(),
		condition: z.enum(["new", "used", "refurbished"]),
	}),
});

// ============================================================
// System Prompt
// ============================================================

const PINTEREST_SYSTEM_PROMPT = `You are a Pinterest content strategist specializing in e-commerce and product listings.

CRITICAL RULES:
- Title must be descriptive and keyword-rich (≤100 chars)
- Description should tell a story and include price naturally (≤500 chars)
- Alt text should describe the product for accessibility and SEO
- Keywords should be search terms people would use to find this product
- Board suggestions should be relevant Pinterest board names
- Include 2-3 variation pins with different angles (gift idea, style inspiration, etc.)

OUTPUT FORMAT:
Return a valid JSON object matching the PinterestPackage schema exactly.`;

// ============================================================
// Generator Function
// ============================================================

export async function generatePinterestPackage(env: Env, draft: EnrichedDraft): Promise<PinterestPackage> {
	const { classification, title, description, pricing } = draft;

	const userPrompt = `Create a Pinterest content package for this listing:

TITLE: ${title}
CONDITION: ${classification.condition_grade}
BRAND: ${classification.brand || "Unknown"}
MODEL: ${classification.model || "N/A"}
PRICE: $${pricing.suggested_price.toFixed(2)}
CATEGORY: ${classification.category_name || "General"}

DESCRIPTION:
${description.short_description}

${description.long_description}

Generate a complete PinterestPackage with main pin, variation pins, and product rich pins data.`;

	// Try twice on parse failure
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const response = (await env.AI.run(
				"@cf/meta/llama-3.1-8b-instruct" as never,
				{
					messages: [
						{ role: "system", content: PINTEREST_SYSTEM_PROMPT },
						{ role: "user", content: userPrompt },
					],
					temperature: 0.7,
					max_tokens: 2000,
				} as never
			)) as { response?: string };

			// Extract text from response
			const responseText = response.response || JSON.stringify(response);

			// Parse JSON from response
			const jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON found in response");
			}

			const parsed = JSON.parse(jsonMatch[0]);
			const validated = PinterestPackageSchema.parse(parsed);
			return validated as PinterestPackage;
		} catch (error) {
			if (attempt === 1) {
				throw new SocialGenerationError("Pinterest package generation failed");
			}
			// Retry on first failure
			continue;
		}
	}

	throw new SocialGenerationError("Pinterest package generation failed after retries");
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate a quick pin title for a listing
 */
export function generatePinTitle(draft: EnrichedDraft): string {
	const { classification, title } = draft;
	const brand = classification.brand ? `${classification.brand} ` : "";
	const condition = classification.condition_grade.toLowerCase().includes("new") ? "New " : "";
	const truncatedTitle = title.slice(0, 70);
	return `${condition}${brand}${truncatedTitle}`;
}

/**
 * Generate pin description with price
 */
export function generatePinDescription(draft: EnrichedDraft): string {
	const { classification, description, pricing } = draft;
	const condition = classification.condition_grade.toLowerCase();
	const price = pricing.suggested_price.toFixed(2);

	let desc = description.short_description;
	if (desc.length > 400) {
		desc = desc.slice(0, 400) + "...";
	}

	return `${desc} Only $${price}! ${condition.includes("new") ? "Brand new" : "Great condition"}. Shop now!`;
}

/**
 * Generate keywords for Pinterest SEO
 */
export function generatePinterestKeywords(draft: EnrichedDraft): string[] {
	const { classification } = draft;
	const keywords: string[] = [];

	if (classification.brand) {
		keywords.push(classification.brand.toLowerCase());
	}

	if (classification.category_name) {
		const categoryWords = classification.category_name
			.toLowerCase()
			.split(/[,&\s]+/)
			.filter((w) => w.length > 3);
		keywords.push(...categoryWords.slice(0, 3));
	}

	if (classification.item_type) {
		keywords.push(classification.item_type.toLowerCase());
	}

	// Add condition-based keywords
	if (classification.condition_grade.toLowerCase().includes("new")) {
		keywords.push("new", "brand new");
	} else {
		keywords.push("vintage", "pre-owned", "thrift find");
	}

	return [...new Set(keywords)].slice(0, 8);
}

/**
 * Generate board suggestions
 */
export function generateBoardSuggestions(draft: EnrichedDraft): string[] {
	const { classification } = draft;
	const boards: string[] = [];

	// Category-based boards
	if (classification.category_name) {
		boards.push(classification.category_name);
	}

	// Brand-based boards
	if (classification.brand) {
		boards.push(`${classification.brand} Finds`, `${classification.brand} Style`);
	}

	// Condition-based boards
	if (classification.condition_grade.toLowerCase().includes("new")) {
		boards.push("New Arrivals", "Must Have Items");
	} else {
		boards.push("Vintage Finds", "Thrift Treasures");
	}

	return boards.slice(0, 5);
}

/**
 * Map condition to Pinterest condition enum
 */
export function mapConditionToPinterest(condition: string): "new" | "used" | "refurbished" {
	const lower = condition.toLowerCase();
	if (lower.includes("new")) {
		return "new";
	} else if (lower.includes("refurbished")) {
		return "refurbished";
	}
	return "used";
}
