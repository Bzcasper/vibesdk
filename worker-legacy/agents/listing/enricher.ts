import { z } from "zod";
import { Env } from "../../types/env";
import { ListingDraft } from "./ingest";

// Model Registry
const MODELS = {
	HEAVY: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	FAST: "@cf/meta/llama-3.1-8b-instruct",
};

// Types
export interface ClassificationResult {
	category: string | null;
	categoryName: string;
	ebayCategoryId: number | null;
	itemTypes: string[];
	brandDetected: string | null;
	confidence: number;
}

export interface ExtractedFields {
	brand?: string;
	model?: string;
	material?: string;
	metal?: string;
	gemstone?: string;
	color?: string;
	size?: string;
	weight?: string;
	condition?: string;
	conditionId?: number;
	year?: string;
	era?: string;
	style?: string;
	features: string[];
	dimensions?: {
		length?: string;
		width?: string;
		height?: string;
	};
}

export interface GeneratedTitle {
	ebay: string;
	shopify: string;
	etsy: string;
	facebook: string;
	poshmark: string;
}

export interface GeneratedDescription {
	ebay: string;
	shopify: string;
	etsy: string;
	facebook: string;
	poshmark: string;
}

export interface PricingSuggestion {
	suggestedPrice: number;
	priceRange: [number, number];
	strategy: "premium" | "market" | "competitive" | "liquidation";
	rationale: string;
}

// AI Gateway Helper
async function callAIModel(
	env: Env,
	model: string,
	messages: { role: string; content: string }[],
	temperature: number = 0.3,
): Promise<string> {
	// Try to get user key from Secrets Store
	let apiKey = null;
	try {
		const id = env.USER_SECRETS_STORE.idFromName("global");
		const obj = env.USER_SECRETS_STORE.get(id);
		const resp = await obj.fetch(`https://secrets/get/OPENAI_API_KEY`);
		if (resp.ok) {
			const data = await resp.json<{ value: string }>();
			apiKey = data.value;
		}
	} catch (e) {
		console.error("Failed to fetch user secret:", e);
	}

	const url = `${env.AI_GATEWAY_URL}/${model}`;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: apiKey
				? `Bearer ${apiKey}`
				: `Bearer ${env.AI_GATEWAY_URL.split("/").pop()}`,
		},
		body: JSON.stringify({ messages, temperature }),
	});

	if (!response.ok) {
		throw new Error(`AI Gateway request failed: ${response.statusText}`);
	}

	const data = await response.json<{ response: string }>();
	return data.response;
}

// Enrichment Pipeline
export async function runEnrichmentPipeline(
	env: Env,
	draft: ListingDraft,
	onStep: (step: string) => void,
): Promise<ListingDraft> {
	onStep("classification");
	// ... implement classification ...
	onStep("item_specifics");
	// ... implement item specifics ...
	onStep("title");
	// ... implement title ...
	onStep("description");
	// ... implement description ...
	onStep("pricing");
	// ... implement pricing ...
	return draft;
}
