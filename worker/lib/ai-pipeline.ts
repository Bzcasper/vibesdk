/**
 * AI Pipeline — BYOK Cloudflare AI Gateway
 * Vision + LLM multi-step enrichment for jewelry listings
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

export class AIPipeline {
	private gatewayUrl: string;

	constructor(private env: Env) {
		this.gatewayUrl = env.AI_GATEWAY_URL;
	}

	/**
	 * Step 1: Vision Analysis
	 * Analyze image(s) to extract jewelry details
	 */
	async analyzeImage(
		imageBase64: string,
		mimeType: string = "image/jpeg",
	): Promise<VisionAnalysis> {
		// Normalize mime type for data URL
		const normalizedMime = mimeType
			.toLowerCase()
			.replace("image/jpg", "image/jpeg");
		try {
			const response = await fetch(
				`${this.gatewayUrl}/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "gpt-4-vision",
						messages: [
							{
								role: "user",
								content: [
									{
										type: "image_url",
										image_url: {
											url: `data:${normalizedMime};base64,${imageBase64}`,
										},
									},
									{
										type: "text",
										text: `Analyze this jewelry item and provide detailed information in JSON format:
{
  "description": "detailed physical description",
  "materials": ["material1", "material2"],
  "condition": "new|excellent|good|fair",
  "notable_features": ["feature1", "feature2"],
  "estimated_era": "approximate year or era or null",
  "colors": ["color1", "color2"]
}

Be specific and accurate for jewelry items.`,
									},
								],
							},
						],
						temperature: 0.3,
						max_tokens: 500,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Vision API error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content = data.choices[0].message.content;

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse vision analysis");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error("[AIPipeline] Vision analysis failed:", error);
			throw error;
		}
	}

	/**
	 * Step 2: Generate SEO-Optimized Title (max 80 chars for eBay)
	 */
	async generateTitle(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.gatewayUrl}/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "gpt-4",
						messages: [
							{
								role: "system",
								content: `You are an expert eBay jewelry listing copywriter. Create concise, SEO-optimized titles that:
- Fit within 80 characters
- Include key descriptors (material, style, era)
- Use high-value keywords for search
- Appeal to buyers
Format: Return ONLY the title text, nothing else.`,
							},
							{
								role: "user",
								content: `Jewelry item analysis:
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Unknown"}
Colors: ${analysis.colors.join(", ")}
Features: ${analysis.notable_features.join(", ")}

Create an 80-character SEO title.`,
							},
						],
						temperature: 0.7,
						max_tokens: 100,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Title generation error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			let title = data.choices[0].message.content.trim();

			// Ensure it's under 80 chars
			if (title.length > 80) {
				title = title.substring(0, 77) + "...";
			}

			return title;
		} catch (error) {
			console.error("[AIPipeline] Title generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 3: Generate Rich, SEO-Optimized Description
	 */
	async generateDescription(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.gatewayUrl}/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "gpt-4",
						messages: [
							{
								role: "system",
								content: `You are an expert jewelry appraiser and copywriter. Write compelling, detailed product descriptions that:
- Highlight quality and craftsmanship
- Include condition assessment
- Mention materials and construction
- Create buyer confidence
- Use natural, persuasive language
- Organize in clear sections (Overview, Condition, Materials, Features)
Format: HTML paragraph tags only, no headers.`,
							},
							{
								role: "user",
								content: `Create a detailed description for:
Description: ${analysis.description}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}
Colors: ${analysis.colors.join(", ")}`,
							},
						],
						temperature: 0.7,
						max_tokens: 1000,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Description generation error: ${response.status}`,
				);
			}

			const data = (await response.json()) as any;
			return data.choices[0].message.content.trim();
		} catch (error) {
			console.error("[AIPipeline] Description generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 4: Suggest Competitive Pricing
	 */
	async suggestPrice(
		analysis: VisionAnalysis,
		title: string,
	): Promise<number> {
		try {
			const response = await fetch(
				`${this.gatewayUrl}/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "gpt-4",
						messages: [
							{
								role: "system",
								content: `You are a jewelry market expert. Analyze market conditions and suggest realistic pricing for jewelry items.
Consider:
- Material value (gold, silver, gemstones)
- Condition (new/excellent commands premium)
- Era/vintage appeal
- Market demand
- Current market rates
Format: Return ONLY a number (price in USD), nothing else.`,
							},
							{
								role: "user",
								content: `Price this jewelry item:
Title: ${title}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}

Suggest a competitive starting price in USD.`,
							},
						],
						temperature: 0.5,
						max_tokens: 50,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Pricing error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const priceText = data.choices[0].message.content.trim();
			const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));

			// Sanity check: jewelry typically $25-$5000
			return Math.max(25, Math.min(5000, price || 99));
		} catch (error) {
			console.error("[AIPipeline] Pricing suggestion failed:", error);
			return 99; // Fallback
		}
	}

	/**
	 * Step 5: Extract Item Specifics (eBay-compatible)
	 */
	async extractItemSpecifics(
		analysis: VisionAnalysis,
		title: string,
		price: number,
	): Promise<Record<string, string>> {
		try {
			const response = await fetch(
				`${this.gatewayUrl}/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model: "gpt-4",
						messages: [
							{
								role: "system",
								content: `You are an eBay jewelry category expert. Extract item specifics as JSON key-value pairs for eBay listings.
Include: Type, Material, Style, Condition, Era/Age, Color, Weight (if possible), Gemstones.
Format: Return ONLY valid JSON object with string values.`,
							},
							{
								role: "user",
								content: `Extract eBay item specifics:
Title: ${title}
Price: $${price}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}
Colors: ${analysis.colors.join(", ")}`,
							},
						],
						temperature: 0.3,
						max_tokens: 500,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Item specifics error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content = data.choices[0].message.content;

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse specifics");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error(
				"[AIPipeline] Item specifics extraction failed:",
				error,
			);
			return {
				Type: "Jewelry",
				Condition: analysis.condition,
				Materials: analysis.materials.join(", "),
			};
		}
	}

	/**
	 * Full Pipeline: Image → Title + Description + Price + Specifics
	 */
	async enrichFromImage(
		imageBase64: string,
		mimeType: string = "image/jpeg",
	): Promise<EnrichedListing> {
		console.log("[AIPipeline] Starting enrichment pipeline");
		console.log("[AIPipeline] Image mime type:", mimeType);

		// Step 1: Vision Analysis
		console.log("[AIPipeline] Step 1: Analyzing image");
		const analysis = await this.analyzeImage(imageBase64, mimeType);

		// Step 2-5: Generate all content in parallel
		console.log(
			"[AIPipeline] Step 2-5: Generating title, description, price, specifics",
		);
		const [title, description, price, specifics] = await Promise.all([
			this.generateTitle(analysis),
			this.generateDescription(analysis),
			this.suggestPrice(analysis, ""),
			this.extractItemSpecifics(analysis, "", 0),
		]);

		// Generate specifics with actual title/price
		const finalSpecifics = await this.extractItemSpecifics(
			analysis,
			title,
			price,
		);

		return {
			title,
			description,
			price_suggested: price,
			item_specifics: finalSpecifics,
			raw_analysis: analysis,
		};
	}
}
