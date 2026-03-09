/**
 * Hybrid AI Pipeline
 * Supports Gemini (best), Grok, OpenAI Gateway (BYOK), and Cloudflare Models
 * Falls back gracefully between implementations
 */

import { Env } from "../types/env";
import { AIPipeline } from "./ai-pipeline";
import { CloudflareAIPipeline } from "./ai-cloudflare";
import { GeminiAIPipeline } from "./ai-gemini";
import { GrokAIPipeline } from "./ai-grok";

export interface EnrichedListing {
	title: string;
	description: string;
	price_suggested: number;
	item_specifics: Record<string, string>;
	raw_analysis: any;
	provider: "gemini" | "grok" | "openai-gateway" | "cloudflare-models";
}

export class HybridAIPipeline {
	private geminiPipeline: GeminiAIPipeline | null = null;
	private grokPipeline: GrokAIPipeline | null = null;
	private byokPipeline: AIPipeline | null = null;
	private cfPipeline: CloudflareAIPipeline | null = null;
	private preferredProvider: "gemini" | "grok" | "openai" | "cloudflare" =
		"cloudflare";

	constructor(private env: Env) {
		// Check if Google Gemini is configured (highest priority)
		if (env.GOOGLE_AI_API_KEY) {
			try {
				this.geminiPipeline = new GeminiAIPipeline(
					env.GOOGLE_AI_API_KEY,
				);
				this.preferredProvider = "gemini";
				console.log("[HybridAI] Gemini configured");
			} catch (error) {
				console.warn("[HybridAI] Gemini initialization failed:", error);
			}
		}

		// Check if Grok is configured (second priority)
		if (env.GROK_API_KEY) {
			try {
				this.grokPipeline = new GrokAIPipeline(env.GROK_API_KEY);
				if (!this.geminiPipeline) {
					this.preferredProvider = "grok";
				}
				console.log("[HybridAI] Grok configured");
			} catch (error) {
				console.warn("[HybridAI] Grok initialization failed:", error);
			}
		}

		// Check if OpenAI BYOK is configured
		if (
			env.AI_GATEWAY_URL &&
			env.AI_GATEWAY_URL.includes("gateway.ai.cloudflare.com")
		) {
			this.byokPipeline = new AIPipeline(env);
			if (this.preferredProvider === "cloudflare") {
				this.preferredProvider = "openai";
			}
			console.log(
				"[HybridAI] OpenAI BYOK configured as tertiary provider",
			);
		}

		// Cloudflare Models always available (fallback)
		if (env.AI) {
			this.cfPipeline = new CloudflareAIPipeline(env.AI);
			console.log("[HybridAI] Cloudflare Models available as fallback");
		}
	}

	/**
	 * Enrich from base64 image (try Gemini → OpenAI → Cloudflare)
	 */
	async enrichFromImage(
		imageBase64: string,
		mimeType: string = "image/jpeg",
	): Promise<EnrichedListing> {
		// Try Gemini first if configured (best vision)
		if (this.geminiPipeline && this.preferredProvider === "gemini") {
			try {
				console.log(
					"[HybridAI] Using Google Gemini Flash 1.5 (best vision)",
				);
				console.log(
					"[HybridAI] Gemini pipeline exists:",
					!!this.geminiPipeline,
				);
				const result = await this.geminiPipeline.enrichFromImage(
					imageBase64,
					mimeType,
				);
				return {
					...result,
					provider: "gemini",
				};
			} catch (error) {
				console.error("[HybridAI] Gemini failed with error:", error);
				console.warn("[HybridAI] Gemini failed, falling back:", error);
			}
		}

		// Try Grok second if configured
		if (this.grokPipeline) {
			try {
				console.log("[HybridAI] Using Grok 4.20 Beta (vision)");
				const result = await this.grokPipeline.enrichFromImage(
					imageBase64,
					mimeType,
				);
				return {
					...result,
					provider: "grok",
				};
			} catch (error) {
				console.warn("[HybridAI] Grok failed, falling back:", error);
			}
		}

		// Try OpenAI BYOK third if configured
		if (this.byokPipeline && this.preferredProvider !== "cloudflare") {
			try {
				console.log("[HybridAI] Using OpenAI Gateway (BYOK)");
				const result = await this.byokPipeline.enrichFromImage(
					imageBase64,
					mimeType,
				);
				return {
					...result,
					provider: "openai-gateway",
				};
			} catch (error) {
				console.warn("[HybridAI] BYOK failed, falling back:", error);
			}
		}

		// Fall back to Cloudflare (text-only, always available)
		if (this.cfPipeline) {
			console.log("[HybridAI] Using Cloudflare Models (free fallback)");
			const result = await this.cfPipeline.enrichFromDescription(
				"Jewelry item from image - analyze for eBay listing",
			);
			return {
				...result,
				provider: "cloudflare-models",
			};
		}

		throw new Error(
			"No AI provider configured. Set GOOGLE_AI_API_KEY, AI_GATEWAY_URL, or enable Cloudflare AI.",
		);
	}

	/**
	 * Enrich from text description (Cloudflare only, faster)
	 */
	async enrichFromDescription(description: string): Promise<EnrichedListing> {
		if (!this.cfPipeline) {
			throw new Error("Cloudflare Models not available");
		}

		console.log(
			"[HybridAI] Using Cloudflare Models for text enrichment (text only, no vision needed)",
		);
		try {
			const result =
				await this.cfPipeline.enrichFromDescription(description);
			return {
				...result,
				provider: "cloudflare-models",
			};
		} catch (error) {
			console.error("[HybridAI] Text enrichment failed:", error);
			// Fallback: create minimal enrichment from text
			return {
				title: description.split(".")[0].substring(0, 80),
				description: `<p>${description}</p>`,
				price_suggested: 79,
				item_specifics: { Description: description },
				raw_analysis: {
					description,
					materials: [],
					condition: "unknown",
					colors: [],
					features: [],
				},
				provider: "cloudflare-models",
			};
		}
	}

	/**
	 * Get provider status
	 */
	getStatus(): {
		gemini_configured: boolean;
		grok_configured: boolean;
		byok_configured: boolean;
		cloudflare_available: boolean;
		preferred_provider: string;
	} {
		return {
			gemini_configured: !!this.geminiPipeline,
			grok_configured: !!this.grokPipeline,
			byok_configured: !!this.byokPipeline,
			cloudflare_available: !!this.cfPipeline,
			preferred_provider: this.preferredProvider,
		};
	}
}
