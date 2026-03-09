/**
 * AI Pipeline — Google Gemini Flash 3.1 (Free Preview)
 * Fast vision analysis using Google's latest model
 * No rate limits, instant processing
 */

import { Env } from "../types/env";

const SUPPORTED_MIMETYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
	"image/gif",
];

function normalizeMimeType(mimeType: string): string {
	const normalized = mimeType.toLowerCase();
	if (SUPPORTED_MIMETYPES.includes(normalized)) {
		return normalized;
	}
	// Handle common variations
	if (normalized === "image/jpg") return "image/jpeg";
	if (normalized.startsWith("image/")) return "image/jpeg"; // Default for unknown
	return "image/jpeg";
}

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

export class GeminiAIPipeline {
	private apiKey: string;
	private baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";
	private model = "gemini-3.1-flash-lite-preview";

	constructor(apiKey: string) {
		if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not set");
		this.apiKey = apiKey;
	}

	/**
	 * Step 1: Vision Analysis using Gemini
	 * Analyze jewelry image directly
	 */
	async analyzeImage(
		imageBase64: string,
		mimeType: string = "image/jpeg",
	): Promise<VisionAnalysis> {
		const normalizedMime = normalizeMimeType(mimeType);
		console.log("[Gemini] Normalized mime type:", normalizedMime);
		try {
			const response = await fetch(
				`${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										inlineData: {
											mimeType: normalizedMime,
											data: imageBase64,
										},
									},
									{
										text: `Analyze this jewelry item and provide details in JSON format:
{
  "description": "detailed physical description of the jewelry",
  "materials": ["material1", "material2"],
  "condition": "new|excellent|good|fair|poor",
  "notable_features": ["feature1", "feature2"],
  "estimated_era": "approximate year or era or null",
  "colors": ["color1", "color2"]
}

Be specific and accurate for jewelry items. Focus on:
- Type of jewelry (ring, necklace, bracelet, etc.)
- Materials (gold, silver, platinum, gemstones)
- Craftsmanship details
- Visible wear or condition
- Style period if identifiable

Respond with ONLY valid JSON.`,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.3,
							maxOutputTokens: 500,
						},
					}),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				console.error("[Gemini] Error response:", error);
				throw new Error(`Gemini API error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

			if (!content) {
				throw new Error("No response from Gemini");
			}

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse vision analysis");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error("[Gemini] Vision analysis failed:", error);
			throw error;
		}
	}

	/**
	 * Step 2: Generate Title
	 */
	async generateTitle(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: `You are an expert eBay jewelry listing copywriter. Create a concise, SEO-optimized title (max 80 characters):

Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Features: ${analysis.notable_features.join(", ")}
Era: ${analysis.estimated_era || "Modern"}

Requirements:
- Exactly 80 characters or less
- Include key descriptors (material, style, era)
- Use high-value keywords for search
- Appeal to buyers

Return ONLY the title text, nothing else.`,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.7,
							maxOutputTokens: 100,
						},
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Title generation error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			let title =
				data.candidates?.[0]?.content?.parts?.[0]?.text ||
				"Jewelry Item";
			title = title.trim();

			// Ensure it's under 80 chars
			if (title.length > 80) {
				title = title.substring(0, 77) + "...";
			}

			return title;
		} catch (error) {
			console.error("[Gemini] Title generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 3: Generate Description
	 */
	async generateDescription(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: `You are an expert jewelry appraiser and copywriter. Write a compelling, detailed product description:

Description: ${analysis.description}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}
Colors: ${analysis.colors.join(", ")}

Requirements:
- Highlight quality and craftsmanship
- Include condition assessment
- Mention materials and construction
- Create buyer confidence
- Use natural, persuasive language
- Organize in clear sections
- Format with HTML paragraph tags only

Write 300-500 words. Be honest and detailed.`,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.7,
							maxOutputTokens: 1000,
						},
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Description generation error: ${response.status}`,
				);
			}

			const data = (await response.json()) as any;
			return (
				data.candidates?.[0]?.content?.parts?.[0]?.text || ""
			).trim();
		} catch (error) {
			console.error("[Gemini] Description generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 4: Suggest Price
	 */
	async suggestPrice(
		analysis: VisionAnalysis,
		title: string,
	): Promise<number> {
		try {
			const response = await fetch(
				`${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: `You are a jewelry market expert. Analyze market conditions and suggest realistic pricing:

Title: ${title}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}

Consider:
- Material value (gold, silver, gemstones)
- Condition (new/excellent commands premium)
- Era/vintage appeal
- Market demand
- Current market rates

Suggest a competitive starting price in USD.
Return ONLY a number (e.g., 299.99), nothing else.`,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.5,
							maxOutputTokens: 50,
						},
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Pricing error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const priceText =
				data.candidates?.[0]?.content?.parts?.[0]?.text || "99";
			const price = parseFloat(
				priceText.toString().replace(/[^0-9.]/g, ""),
			);

			// Sanity check: jewelry typically $25-$5000
			return Math.max(25, Math.min(5000, price || 99));
		} catch (error) {
			console.error("[Gemini] Pricing suggestion failed:", error);
			return 99; // Fallback
		}
	}

	/**
	 * Step 5: Extract Item Specifics
	 */
	async extractItemSpecifics(
		analysis: VisionAnalysis,
		title: string,
		price: number,
	): Promise<Record<string, string>> {
		try {
			const response = await fetch(
				`${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: `You are an eBay jewelry category expert. Extract item specifics as JSON:

Title: ${title}
Price: $${price}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}
Colors: ${analysis.colors.join(", ")}

Return JSON with these fields (all string values):
- Type: jewelry type (Ring, Necklace, Bracelet, etc.)
- Material: primary material
- Condition: condition grade
- Style: jewelry style
- Era: time period or "Modern"

Return ONLY valid JSON object with string values.`,
									},
								],
							},
						],
						generationConfig: {
							temperature: 0.3,
							maxOutputTokens: 500,
						},
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Item specifics error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content =
				data.candidates?.[0]?.content?.parts?.[0]?.text || "";

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error("Could not parse specifics");

			return JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error("[Gemini] Item specifics extraction failed:", error);
			return {
				Type: "Jewelry",
				Condition: analysis.condition,
				Material: analysis.materials.join(", "),
				Style: analysis.notable_features[0] || "Classic",
				Era: analysis.estimated_era || "Modern",
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
		console.log("[Gemini] Starting enrichment pipeline");
		console.log("[Gemini] Image mime type:", mimeType);

		// Step 1: Vision Analysis
		console.log("[Gemini] Step 1: Analyzing image with vision AI");
		const analysis = await this.analyzeImage(imageBase64, mimeType);

		// Step 2-5: Generate all content in parallel
		console.log("[Gemini] Steps 2-5: Generating content");
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
