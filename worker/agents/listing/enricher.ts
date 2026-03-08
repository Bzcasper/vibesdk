/**
 * AI Enricher Pipeline
 *
 * Processes raw listing input through multiple AI-powered enrichment steps:
 * 1. Classification - Determine category, condition, brand, model
 * 2. Item Specifics - Generate eBay-compatible item specifics
 * 3. Title Generation - Create optimized 80-char title
 * 4. Description Generation - Write honest, buyer-protective copy
 * 5. Pricing Suggestion - Suggest competitive pricing
 */

import { z } from "zod";
import { Env } from "../../types/env";
import { ListingDraft } from "./ingest";

// ============================================================
// Zod Schemas for AI Responses
// ============================================================

export const ClassificationResultSchema = z.object({
	category_name: z.string(),
	ebay_category_id: z.number(),
	item_type: z.string(),
	brand: z.string().nullable(),
	model: z.string().nullable(),
	condition_grade: z.enum(["New", "Excellent", "VeryGood", "Good", "Fair"]),
	era_or_year: z.string().nullable(),
	primary_material: z.string().nullable(),
});

export const ItemSpecificSchema = z.object({
	name: z.string(),
	value: z.string(),
});

export const TitleResultSchema = z.object({
	title: z.string(),
	char_count: z.number(),
});

export const DescriptionResultSchema = z.object({
	short_description: z.string(),
	long_description: z.string(),
	condition_details: z.string(),
	what_is_included: z.string(),
	shipping_note: z.string(),
});

export const PricingResultSchema = z.object({
	suggested_price: z.number(),
	price_range: z.tuple([z.number(), z.number()]),
	strategy: z.enum(["premium", "market", "competitive", "liquidation"]),
	rationale: z.string(),
});

// ============================================================
// Types
// ============================================================

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
export type ItemSpecific = z.infer<typeof ItemSpecificSchema>;
export type TitleResult = z.infer<typeof TitleResultSchema>;
export type DescriptionResult = z.infer<typeof DescriptionResultSchema>;
export type PricingResult = z.infer<typeof PricingResultSchema>;

export interface EnrichedDraft extends ListingDraft {
	classification: ClassificationResult;
	itemSpecifics: ItemSpecific[];
	title: string;
	description: DescriptionResult;
	pricing: PricingResult;
}

export type StepCallback = (step: string, status: "start" | "complete" | "error", data?: unknown) => Promise<void>;

// ============================================================
// System Prompts
// ============================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert at analyzing product descriptions and classifying items for eBay listings.

Given a product description, determine:
1. The most appropriate eBay category name and ID
2. The item type (what the item is)
3. Brand and model if identifiable
4. Condition grade based on the description
5. Era/year if applicable (for vintage/antique items)
6. Primary material if identifiable

Respond ONLY with valid JSON matching the required schema.`;

const ITEM_SPECIFICS_SYSTEM_PROMPT = `You are an expert at creating eBay Item Specifics for product listings.

Given a product classification and description, generate up to 20 item specifics that are:
- Relevant to the category
- Using official eBay Item Specific names
- Using values from eBay's accepted value lists where applicable
- Accurate based on the provided information

Respond ONLY with a JSON array of { name, value } objects.`;

const TITLE_SYSTEM_PROMPT = `You are an expert at writing eBay titles that maximize visibility and sales.

Rules:
- Maximum 80 characters
- Keyword-first structure: [Brand] [Key Spec] [Item Type] [Condition Signal]
- Include the most important search terms
- No promotional words like "amazing" or "best"
- Be specific and accurate

Respond ONLY with valid JSON: { "title": "...", "char_count": number }`;

const DESCRIPTION_SYSTEM_PROMPT = `You are an expert at writing honest, buyer-protective product descriptions for eBay.

Rules:
- Be accurate and honest about condition
- Include all relevant details
- Mention any flaws or issues clearly
- Describe what is included
- Add a helpful shipping note

Respond ONLY with valid JSON matching the required schema.`;

const PRICING_SYSTEM_PROMPT = `You are an expert at suggesting competitive pricing for eBay listings.

Rules:
- Consider the item type, condition, and market
- Provide a suggested price and range
- Choose a pricing strategy
- Include a rationale with caveat about knowledge cutoff
- Never present prices as definitive - always as suggestions

Respond ONLY with valid JSON matching the required schema.`;

// ============================================================
// AI Helper Functions
// ============================================================

async function callAI(
	env: Env,
	systemPrompt: string,
	userPrompt: string,
	temperature: number = 0.3
): Promise<string> {
	const response = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userPrompt },
		],
		temperature,
		max_tokens: 1024,
	});

	// Handle different response formats
	const text = typeof response === "string" 
		? response 
		: (response as any).response || (response as any).generated_text || JSON.stringify(response);

	return text;
}

function parseAIJSON<T>(text: string, schema: z.ZodSchema<T>): T {
	// Try to extract JSON from the response
	let jsonStr = text.trim();
	
	// Remove markdown code blocks if present
	if (jsonStr.startsWith("```")) {
		jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
	}

	// Try to find JSON object or array
	const jsonMatch = jsonStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
	if (jsonMatch) {
		jsonStr = jsonMatch[1];
	}

	const parsed = JSON.parse(jsonStr);
	return schema.parse(parsed);
}

// ============================================================
// Enrichment Steps
// ============================================================

export async function runClassification(
	env: Env,
	draft: ListingDraft
): Promise<ClassificationResult> {
	const userPrompt = `Analyze this product and classify it for eBay:

Product Description:
${draft.rawInput.content}

${draft.rawInput.imageCount > 0 ? `Note: ${draft.rawInput.imageCount} image(s) are attached to this listing.` : ""}

Respond with the classification as JSON.`;

	const response = await callAI(env, CLASSIFICATION_SYSTEM_PROMPT, userPrompt, 0.1);
	
	try {
		return parseAIJSON(response, ClassificationResultSchema);
	} catch (error) {
		// Retry with error correction prompt
		const retryPrompt = `The previous response was invalid. Please fix and respond with ONLY valid JSON matching this schema:
{
  "category_name": "string",
  "ebay_category_id": number,
  "item_type": "string",
  "brand": "string or null",
  "model": "string or null",
  "condition_grade": "New" | "Excellent" | "VeryGood" | "Good" | "Fair",
  "era_or_year": "string or null",
  "primary_material": "string or null"
}

Original product: ${draft.rawInput.content.slice(0, 500)}`;

		const retryResponse = await callAI(env, CLASSIFICATION_SYSTEM_PROMPT, retryPrompt, 0.1);
		return parseAIJSON(retryResponse, ClassificationResultSchema);
	}
}

export async function runItemSpecificsGeneration(
	env: Env,
	draft: ListingDraft,
	classification: ClassificationResult
): Promise<ItemSpecific[]> {
	const userPrompt = `Generate eBay Item Specifics for this product:

Category: ${classification.category_name}
Item Type: ${classification.item_type}
Brand: ${classification.brand || "Unknown"}
Model: ${classification.model || "Unknown"}
Condition: ${classification.condition_grade}
Material: ${classification.primary_material || "Unknown"}

Product Description:
${draft.rawInput.content}

Respond with a JSON array of up to 20 item specifics.`;

	const response = await callAI(env, ITEM_SPECIFICS_SYSTEM_PROMPT, userPrompt, 0.2);
	
	try {
		const parsed = JSON.parse(response.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, ""));
		return z.array(ItemSpecificSchema).parse(parsed);
	} catch {
		return [];
	}
}

export async function runTitleGeneration(
	env: Env,
	draft: ListingDraft,
	classification: ClassificationResult
): Promise<TitleResult> {
	const userPrompt = `Write an eBay title for this product:

Item: ${classification.item_type}
Brand: ${classification.brand || ""}
Model: ${classification.model || ""}
Condition: ${classification.condition_grade}

Product Description:
${draft.rawInput.content.slice(0, 500)}

Maximum 80 characters. Keyword-first structure.`;

	const response = await callAI(env, TITLE_SYSTEM_PROMPT, userPrompt, 0.5);
	const result = parseAIJSON(response, TitleResultSchema);

	// Validate char count
	if (result.char_count > 80) {
		result.title = result.title.slice(0, 80);
		result.char_count = 80;
	}

	return result;
}

export async function runDescriptionGeneration(
	env: Env,
	draft: ListingDraft,
	classification: ClassificationResult
): Promise<DescriptionResult> {
	const userPrompt = `Write an eBay description for this product:

Item: ${classification.item_type}
Brand: ${classification.brand || ""}
Model: ${classification.model || ""}
Condition: ${classification.condition_grade}
Material: ${classification.primary_material || ""}

Product Description:
${draft.rawInput.content}

Be honest and accurate. Include condition details and what's included.`;

	const response = await callAI(env, DESCRIPTION_SYSTEM_PROMPT, userPrompt, 0.6);
	return parseAIJSON(response, DescriptionResultSchema);
}

export async function runPricingSuggestion(
	env: Env,
	draft: ListingDraft,
	classification: ClassificationResult
): Promise<PricingResult> {
	const userPrompt = `Suggest pricing for this eBay listing:

Item: ${classification.item_type}
Brand: ${classification.brand || ""}
Model: ${classification.model || ""}
Condition: ${classification.condition_grade}

Product Description:
${draft.rawInput.content.slice(0, 500)}

Note: Your pricing data may be stale. Include a caveat in your rationale.`;

	const response = await callAI(env, PRICING_SYSTEM_PROMPT, userPrompt, 0.3);
	return parseAIJSON(response, PricingResultSchema);
}

// ============================================================
// Main Pipeline Orchestrator
// ============================================================

export async function runEnrichmentPipeline(
	env: Env,
	draft: ListingDraft,
	onStep?: StepCallback
): Promise<EnrichedDraft> {
	const enriched: Partial<EnrichedDraft> = { ...draft };

	// Step 1: Classification
	if (onStep) await onStep("classification", "start");
	try {
		enriched.classification = await runClassification(env, draft);
		if (onStep) await onStep("classification", "complete", enriched.classification);
	} catch (error) {
		if (onStep) await onStep("classification", "error", error);
		throw error;
	}

	// Step 2: Item Specifics
	if (onStep) await onStep("item_specifics", "start");
	try {
		enriched.itemSpecifics = await runItemSpecificsGeneration(env, draft, enriched.classification!);
		if (onStep) await onStep("item_specifics", "complete", enriched.itemSpecifics);
	} catch (error) {
		if (onStep) await onStep("item_specifics", "error", error);
		enriched.itemSpecifics = [];
	}

	// Step 3: Title
	if (onStep) await onStep("title", "start");
	try {
		const titleResult = await runTitleGeneration(env, draft, enriched.classification!);
		enriched.title = titleResult.title;
		if (onStep) await onStep("title", "complete", { title: enriched.title });
	} catch (error) {
		if (onStep) await onStep("title", "error", error);
		enriched.title = `${enriched.classification!.brand || ""} ${enriched.classification!.item_type}`.trim();
	}

	// Step 4: Description
	if (onStep) await onStep("description", "start");
	try {
		enriched.description = await runDescriptionGeneration(env, draft, enriched.classification!);
		if (onStep) await onStep("description", "complete", enriched.description);
	} catch (error) {
		if (onStep) await onStep("description", "error", error);
		enriched.description = {
			short_description: draft.rawInput.content.slice(0, 200),
			long_description: draft.rawInput.content,
			condition_details: enriched.classification!.condition_grade,
			what_is_included: "See description",
			shipping_note: "Standard shipping applies",
		};
	}

	// Step 5: Pricing
	if (onStep) await onStep("pricing", "start");
	try {
		enriched.pricing = await runPricingSuggestion(env, draft, enriched.classification!);
		if (onStep) await onStep("pricing", "complete", enriched.pricing);
	} catch (error) {
		if (onStep) await onStep("pricing", "error", error);
		enriched.pricing = {
			suggested_price: 0,
			price_range: [0, 0],
			strategy: "market",
			rationale: "Unable to generate pricing suggestion",
		};
	}

	return enriched as EnrichedDraft;
}
