/**
 * AI Pipeline — Cloudflare Models (Free Alternative)
 * Uses Cloudflare Workers AI without BYOK
 * Models: @cf/meta/llama-2-7b-chat-int8, @cf/stabilityai/stable-diffusion-xl-beta
 */

import { Env } from "../types/env";

export interface VisionAnalysis {
	description: string;
	materials: string[];
	condition: string;
	notable_features: string[];
	estimated_era: string | null;
	colors: string[];
}

export interface EnrichedListing {
	title: string;
	description: string;
	price_suggested: number;
	item_specifics: Record<string, string>;
	raw_analysis: VisionAnalysis;
}

export class CloudflareAIPipeline {
	constructor(private ai: any) {}

	/**
	 * Step 1: Analyze image description using Llama
	 * (Text-based analysis since we don't have image-to-text on CF)
	 */
	async analyzeImageDescription(description: string): Promise<VisionAnalysis> {
		try {
			const prompt = `You are a jewelry expert. Analyze this jewelry description and extract details in JSON format:
"${description}"

Respond with ONLY valid JSON:
{
  "description": "detailed physical description",
  "materials": ["material1", "material2"],
  "condition": "new|excellent|good|fair",
  "notable_features": ["feature1", "feature2"],
  "estimated_era": "approximate year or era or null",
  "colors": ["color1", "color2"]
}`;

			const response = await this.ai.run("@cf/meta/llama-2-7b-chat-int8", {
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}) as any;

			const text = response?.result?.response || response?.response || response;
			const jsonMatch = text.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse analysis");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error("[CloudflareAI] Analysis failed:", error);
			throw error;
		}
	}

	/**
	 * Step 2: Generate SEO Title
	 */
	async generateTitle(analysis: VisionAnalysis): Promise<string> {
		try {
			const prompt = `You are an eBay jewelry expert. Create a concise SEO title (max 80 chars):
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Features: ${analysis.notable_features.join(", ")}

Return ONLY the title text, nothing else.`;

			const response = await this.ai.run("@cf/meta/llama-2-7b-chat-int8", {
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}) as any;

			const text = response?.result?.response || response?.response || response;
			let title = (typeof text === 'string' ? text : JSON.stringify(text)).trim();
			if (title.length > 80) {
				title = title.substring(0, 77) + "...";
			}
			return title;
		} catch (error) {
			console.error("[CloudflareAI] Title generation failed:", error);
			return `${analysis.materials.join(" ")} ${analysis.condition} Jewelry`;
		}
	}

	/**
	 * Step 3: Generate Description
	 */
	async generateDescription(analysis: VisionAnalysis): Promise<string> {
		try {
			const prompt = `Write a compelling jewelry product description:
${analysis.description}

Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Features: ${analysis.notable_features.join(", ")}

Format as HTML paragraphs. Be persuasive and honest.`;

			const response = await this.ai.run("@cf/meta/llama-2-7b-chat-int8", {
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}) as any;

			const text = response?.result?.response || response?.response || response;
			return (typeof text === 'string' ? text : JSON.stringify(text)).trim();
		} catch (error) {
			console.error("[CloudflareAI] Description generation failed:", error);
			return `<p>${analysis.description}</p>`;
		}
	}

	/**
	 * Step 4: Suggest Price (Conservative on Cloudflare)
	 */
	async suggestPrice(analysis: VisionAnalysis, title: string): Promise<number> {
		try {
			const prompt = `Jewelry pricing analysis:
Title: ${title}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}

Suggest a fair starting price in USD. Return ONLY a number.`;

			const response = await this.ai.run("@cf/meta/llama-2-7b-chat-int8", {
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}) as any;

			const text = response?.result?.response || response?.response || response;
			const priceText = (typeof text === 'string' ? text : JSON.stringify(text)).trim();
			const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));

			// Conservative pricing: $25-$999 for Cloudflare safety
			return Math.max(25, Math.min(999, price || 79));
		} catch (error) {
			console.error("[CloudflareAI] Pricing failed:", error);
			return 79; // Conservative fallback
		}
	}

	/**
	 * Step 5: Extract Item Specifics
	 */
	async extractItemSpecifics(
		analysis: VisionAnalysis,
		title: string,
		price: number
	): Promise<Record<string, string>> {
		try {
			const prompt = `Extract eBay item specifics as JSON:
Title: ${title}
Price: $${price}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}

Return JSON only with fields: Type, Material, Condition, Style, Era.`;

			const response = await this.ai.run("@cf/meta/llama-2-7b-chat-int8", {
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			}) as any;

			const text = response?.result?.response || response?.response || response;
			const content = typeof text === 'string' ? text : JSON.stringify(text);
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse specifics");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error("[CloudflareAI] Specifics extraction failed:", error);
			return {
				Type: "Jewelry",
				Condition: analysis.condition,
				Materials: analysis.materials.join(", "),
			};
		}
	}

	/**
	 * Full Pipeline: Text Description → Title + Description + Price + Specifics
	 */
	async enrichFromDescription(textDescription: string): Promise<EnrichedListing> {
		console.log("[CloudflareAI] Starting enrichment pipeline");

		// Step 1: Analyze text
		console.log("[CloudflareAI] Step 1: Analyzing description");
		const analysis = await this.analyzeImageDescription(textDescription);

		// Step 2-5: Generate all in sequence (Cloudflare has rate limits)
		console.log("[CloudflareAI] Step 2: Generating title");
		const title = await this.generateTitle(analysis);

		console.log("[CloudflareAI] Step 3: Generating description");
		const description = await this.generateDescription(analysis);

		console.log("[CloudflareAI] Step 4: Suggesting price");
		const price = await this.suggestPrice(analysis, title);

		console.log("[CloudflareAI] Step 5: Extracting specifics");
		const specifics = await this.extractItemSpecifics(analysis, title, price);

		return {
			title,
			description,
			price_suggested: price,
			item_specifics: specifics,
			raw_analysis: analysis,
		};
	}
}
