/**
 * TikTok Social Content Generator
 *
 * Generates TikTok-optimized content and scripts from enriched listing data.
 */

import { Env } from "../../types/env";
import { EnrichedDraft } from "../listing/enricher";

// ============================================================
// Error Classes
// ============================================================

export class SocialGenerationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SocialGenerationError";
	}
}

// ============================================================
// Types
// ============================================================

export interface TikTokPackage {
	script: string;
	hashtags: string[];
	hooks: string[];
	callToAction: string;
	duration: number; // seconds
	estimatedViews: number;
	contentType: "product_showcase" | "tutorial" | "unboxing" | "review";
}

// ============================================================
// Content Generator
// ============================================================

export async function generateTikTokPackage(env: Env, draft: EnrichedDraft): Promise<TikTokPackage> {
	try {
		// Extract key product details
		const title = typeof draft.title === "string" ? draft.title : "Product";
		const price = draft.pricing?.suggested_price || 0;
		const description = draft.description?.short_description || "";

		// AI Prompt for TikTok content
		const prompt = `You are a TikTok creator specialist. Create a 15-30 second product showcase script for this item:
Product: ${title}
Price: $${price.toFixed(2)}
Description: ${description}

Generate:
1. Script including a hook and product features
2. Trending hashtags (5-10)
3. 3 Alternative hooks (short/punchy)
4. Call to action
5. Content type (product_showcase, tutorial, unboxing, or review)

Format as JSON with keys: script, hashtags, hooks, cta, content_type`;

		const aiResponse = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct" as any, {
			prompt,
		})) as { response?: string };

		const responseText = aiResponse.response || JSON.stringify(aiResponse);
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		
		if (!jsonMatch) {
			// Fallback to basic generation if AI fails
			return generateFallbackTikTokPackage(draft);
		}

		const parsed = JSON.parse(jsonMatch[0]);

		return {
			script: parsed.script || "Check out this product!",
			hashtags: parsed.hashtags || ["#shopping", "#jewelry"],
			hooks: parsed.hooks || ["Wait for it...", "Look at this!"],
			callToAction: parsed.cta || "Link in bio!",
			duration: 20,
			estimatedViews: 1000,
			contentType: parsed.content_type || "product_showcase",
		};
	} catch (error) {
		console.error("TikTok generation AI failure:", error);
		// Fallback to basic generation
		return generateFallbackTikTokPackage(draft);
	}
}

/**
 * Fallback to manual generation logic if AI fails
 */
function generateFallbackTikTokPackage(draft: EnrichedDraft): TikTokPackage {
	const title = typeof draft.title === "string" ? draft.title : "Product";
	const price = draft.pricing?.suggested_price || 0;
	const description = draft.description?.short_description || "";
	const contentType = determineContentType(draft);

	return {
		script: generateScript(title, price, description, contentType),
		hashtags: generateHashtags(draft, contentType),
		hooks: generateHooks(title, price, contentType),
		callToAction: "Link in bio to shop now! 🛍️",
		duration: 15,
		estimatedViews: 500,
		contentType,
	};
}

// ============================================================
// Helper Functions
// ============================================================

function determineContentType(draft: EnrichedDraft): TikTokPackage["contentType"] {
	const description = (draft.description?.short_description || draft.description?.long_description || "").toLowerCase();

	if (description.includes("unbox") || description.includes("new")) {
		return "unboxing";
	} else if (description.includes("how to") || description.includes("tutorial")) {
		return "tutorial";
	} else if (description.includes("review") || description.includes("opinion")) {
		return "review";
	}

	return "product_showcase";
}

function generateScript(
	title: string,
	price: number,
	description: string,
	contentType: TikTokPackage["contentType"]
): string {
	const priceStr = price > 0 ? `$${price.toFixed(2)}` : "Check price";

	switch (contentType) {
		case "unboxing":
			return `Wait for it... 📦\n\nJust unboxed this amazing ${title}!\n\nPrice: ${priceStr}\n\nHave you tried one? 👇`;

		case "tutorial":
			return `Quick tip! ✨\n\nHow to use the ${title}:\n\n1. Open it\n2. Follow the guide\n3. Enjoy!\n\nOnly ${priceStr}! 🎁`;

		case "review":
			return `Honest review: ${title}\n\nPros: Quality, Design, Price (${priceStr})\nCons: None so far!\n\nWorth it? YES! 💯`;

		default:
			return `POV: You found the ${title}\n\n✨ Features:\n• Amazing quality\n• Only ${priceStr}\n• Fast shipping\n\nTap to shop! 👆`;
	}
}

function generateHashtags(draft: EnrichedDraft, contentType: TikTokPackage["contentType"]): string[] {
	const baseTags = [
		"#shopping",
		"#productreview",
		"#ecommerce",
		"#unboxing",
		"#dealsoftheday",
		"#fypviral",
		"#trending",
	];

	const categoryTags: Record<string, string[]> = {
		electronics: ["#gadgets", "#tech", "#techtok"],
		fashion: ["#ootd", "#fashion", "#style"],
		home: ["#homedecor", "#interior", "#lifestyle"],
		beauty: ["#beautytok", "#skincare", "#makeup"],
		sports: ["#fitness", "#workout", "#gym"],
	};

	// Determine category from classification
	const category = (draft.classification?.category_name || "general").toLowerCase();
	const categorySpecificTags = categoryTags[category] || [];

	return [...baseTags, ...categorySpecificTags].slice(0, 15);
}

function generateHooks(title: string, price: number, _contentType: TikTokPackage["contentType"]): string[] {
	const priceStr = price > 0 ? `$${price.toFixed(2)}` : "so cheap";

	return [
		`Wait for the price reveal... 🤩`,
		`This ${title} is INSANE for ${priceStr}`,
		`I can't believe this exists for ${priceStr}`,
		`POV: You find out about this product...`,
		`The ${title} everyone's talking about...`,
	];
}
