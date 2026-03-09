/**
 * AI Pipeline — Grok 4.20 Beta Vision (via grok2api)
 * Fast vision analysis using Grok-4.20-beta
 * Flow: Upload image → Get URL → Chat completions with image URL
 */

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

export class GrokAIPipeline {
	private apiKey: string;
	private baseUrl = "https://grok2api-pn1d.onrender.com";
	private model = "grok-4.20-beta";

	constructor(apiKey: string) {
		if (!apiKey) throw new Error("GROK_API_KEY not set");
		this.apiKey = apiKey;
	}

	/**
	 * Upload image and get URL
	 */
	private async uploadImage(
		imageBase64: string,
		mimeType: string,
	): Promise<string> {
		// Decode base64 to binary
		const binaryString = atob(imageBase64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		// Create FormData with image
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([bytes], { type: mimeType }),
			"image.jpg",
		);

		const response = await fetch(`${this.baseUrl}/v1/uploads/image`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const error = await response.text();
			console.error("[Grok] Upload error:", error);
			throw new Error(`Grok upload error: ${response.status}`);
		}

		const data = (await response.json()) as any;
		console.log("[Grok] Uploaded image URL:", data.url);
		return data.url;
	}

	/**
	 * Step 1: Vision Analysis using Grok
	 */
	async analyzeImage(
		imageBase64: string,
		mimeType: string = "image/jpeg",
	): Promise<VisionAnalysis> {
		try {
			// Upload image first to get URL
			const imageUrl = await this.uploadImage(imageBase64, mimeType);
			const fullImageUrl = `${this.baseUrl}${imageUrl}`;

			const response = await fetch(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							{
								role: "user",
								content: [
									{ type: "text", text: "hi" },
									{
										type: "image_url",
										image_url: { url: fullImageUrl },
									},
								],
							},
						],
						stream: false,
						max_tokens: 500,
						temperature: 0.3,
					}),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				console.error("[Grok] Error response:", error);
				throw new Error(`Grok API error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content = data.choices?.[0]?.message?.content;

			if (!content) {
				throw new Error("No content in Grok response");
			}

			// Extract JSON from response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.error("[Grok] No JSON found in response:", content);
				throw new Error("Invalid JSON response from Grok");
			}

			const parsed = JSON.parse(jsonMatch[0]);
			return {
				description: parsed.description || "",
				materials: parsed.materials || [],
				condition: parsed.condition || "unknown",
				notable_features: parsed.notable_features || [],
				estimated_era: parsed.estimated_era || null,
				colors: parsed.colors || [],
			};
		} catch (error) {
			console.error("[Grok] Vision analysis failed:", error);
			throw error;
		}
	}

	/**
	 * Step 2: Generate SEO title
	 */
	async generateTitle(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							{
								role: "user",
								content: `Generate a compelling eBay listing title (max 80 characters) for this jewelry:

Type: ${analysis.notable_features[0] || "Jewelry"}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Colors: ${analysis.colors.join(", ")}

Return ONLY the title, nothing else.`,
							},
						],
						max_tokens: 100,
						temperature: 0.7,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Title generation error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			let title = data.choices?.[0]?.message?.content || "Jewelry Item";
			title = title.trim();

			if (title.length > 80) {
				title = title.substring(0, 77) + "...";
			}

			return title;
		} catch (error) {
			console.error("[Grok] Title generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 3: Generate Description
	 */
	async generateDescription(analysis: VisionAnalysis): Promise<string> {
		try {
			const response = await fetch(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							{
								role: "user",
								content: `You are an expert jewelry appraiser and copywriter. Write a compelling, detailed product description:

Description: ${analysis.description}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}
Colors: ${analysis.colors.join(", ")}

Requirements:
- Write in HTML format with <p> tags
- Focus on the unique selling points
- Include condition details
- Be SEO-friendly for eBay
- 400-600 words

Return ONLY the description.`,
							},
						],
						max_tokens: 1500,
						temperature: 0.7,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Description generation error: ${response.status}`,
				);
			}

			const data = (await response.json()) as any;
			let description = data.choices?.[0]?.message?.content || "";
			description = description.trim();

			return description;
		} catch (error) {
			console.error("[Grok] Description generation failed:", error);
			throw error;
		}
	}

	/**
	 * Step 4: Suggest Price
	 */
	async suggestPrice(analysis: VisionAnalysis): Promise<number> {
		try {
			const response = await fetch(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							{
								role: "user",
								content: `Suggest a resale price in USD for this jewelry item:

Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}

Consider:
- Current gold/silver/platinum prices
- Gemstone value if applicable
- Brand premium if detectable
- Condition impact on value

Return ONLY a number (no $ sign), or "50" if unsure.`,
							},
						],
						max_tokens: 50,
						temperature: 0.3,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(`Price generation error: ${response.status}`);
			}

			const data = (await response.json()) as any;
			const content = data.choices?.[0]?.message?.content || "";

			const match = content.match(/\d+/);
			let price = match ? parseInt(match[0], 10) : 99;

			if (price < 10) price = 99;
			if (price > 100000) price = 9999;

			return price;
		} catch (error) {
			console.error("[Grok] Price generation failed:", error);
			return 99;
		}
	}

	/**
	 * Step 5: Extract eBay Item Specifics
	 */
	async extractItemSpecifics(
		analysis: VisionAnalysis,
		title: string,
		price: number,
	): Promise<Record<string, string>> {
		try {
			const response = await fetch(
				`${this.baseUrl}/v1/chat/completions`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${this.apiKey}`,
					},
					body: JSON.stringify({
						model: this.model,
						messages: [
							{
								role: "user",
								content: `Extract eBay item specifics as JSON:

{
  "Type": "ring|necklace|bracelet|earrings|brooch|pendant|charm|watch|other",
  "Material": "main material",
  "Condition": "New with tags|New|Pre-owned|Used",
  "Style": "style keywords",
  "Era": "era or period if known"
}

Title: ${title}
Materials: ${analysis.materials.join(", ")}
Condition: ${analysis.condition}
Era: ${analysis.estimated_era || "Modern"}
Features: ${analysis.notable_features.join(", ")}

Return ONLY valid JSON with these exact keys: Type, Material, Condition, Style, Era`,
							},
						],
						max_tokens: 200,
						temperature: 0.3,
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Specifics generation error: ${response.status}`,
				);
			}

			const data = (await response.json()) as any;
			const content = data.choices?.[0]?.message?.content || "{}";

			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				const parsed = JSON.parse(jsonMatch[0]);
				return {
					Type: parsed.Type || "Jewelry",
					Material: parsed.Material || analysis.materials[0] || "",
					Condition: parsed.Condition || analysis.condition,
					Style:
						parsed.Style ||
						analysis.notable_features.slice(0, 2).join(", "),
					Era: parsed.Era || analysis.estimated_era || "",
				};
			}

			return {
				Type: "Jewelry",
				Material: analysis.materials[0] || "",
				Condition: analysis.condition,
				Style: analysis.notable_features.slice(0, 2).join(", "),
				Era: analysis.estimated_era || "",
			};
		} catch (error) {
			console.error("[Grok] Specifics generation failed:", error);
			return {
				Type: "Jewelry",
				Material: analysis.materials[0] || "",
				Condition: analysis.condition,
				Style: "",
				Era: analysis.estimated_era || "",
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
		console.log("[Grok] Starting enrichment pipeline");

		// Step 1: Vision Analysis
		console.log("[Grok] Step 1: Analyzing image with Grok Vision");
		const analysis = await this.analyzeImage(imageBase64, mimeType);

		// Step 2-5: Generate all content in parallel
		console.log("[Grok] Steps 2-5: Generating content");
		const [title, description, price, specifics] = await Promise.all([
			this.generateTitle(analysis),
			this.generateDescription(analysis),
			this.suggestPrice(analysis),
			this.extractItemSpecifics(analysis, "", 0),
		]);

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
