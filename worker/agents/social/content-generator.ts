/**
 * Social Media Content Generator
 * Generate platform-specific content (TikTok, Pinterest, Instagram)
 */

import { Ai } from "@cloudflare/workers-types";

export interface SocialContentJob {
	listing_id: string;
	job_id: string;
	platform: "tiktok" | "pinterest" | "instagram";
	title: string;
	description: string;
	images: Array<{ r2_key: string; position: number }>;
}

/**
 * Generate TikTok content (video script + product clips)
 */
export async function generateTikTokContent(
	job: SocialContentJob,
	ai: Ai
): Promise<{
	success: boolean;
	content?: {
		script: string;
		duration_seconds: number;
		music_suggestions: string[];
		product_clips: string[];
		hashtags: string[];
	};
	error?: string;
}> {
	try {
		console.log(`[TikTok] Generating content for ${job.listing_id}`);

		// Generate script using Llama
		const prompt = `You are a TikTok creator specialist. Create a 15-30 second product showcase script for a pre-owned jewelry item.

Product: ${job.title}
Description: ${job.description}

Generate:
1. A catchy opening hook (2-3 seconds)
2. Product feature callouts (8-12 seconds)
3. Call to action (3-5 seconds)
4. Suggested trending music genres
5. Relevant hashtags for jewelry community

Format as JSON with keys: hook, features, cta, music_genres, hashtags`;

		const response = (await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
			prompt,
		})) as any;

		const parsed = JSON.parse(typeof response === "string" ? response : response.response || "{}");

		const content = {
			script: `${parsed.hook}\n\n${parsed.features}\n\n${parsed.cta}`,
			duration_seconds: 20,
			music_suggestions: parsed.music_genres || ["trendy", "upbeat"],
			product_clips: job.images.slice(0, 3).map((img) => img.r2_key),
			hashtags: parsed.hashtags || ["#jewelry", "#preowned", "#fy p"],
		};

		console.log(`[TikTok] ✅ Content generated`);

		return { success: true, content };
	} catch (err) {
		console.error(`[TikTok] ❌ Error:`, err);
		return { success: false, error: (err as Error).message };
	}
}

/**
 * Generate Pinterest content (pin copy + design specs)
 */
export async function generatePinterestContent(
	job: SocialContentJob,
	ai: Ai
): Promise<{
	success: boolean;
	content?: {
		pin_title: string;
		pin_description: string;
		design_specs: {
			dimensions: string;
			text_position: string;
			color_scheme: string;
		};
		hashtags: string[];
		keywords: string[];
	};
	error?: string;
}> {
	try {
		console.log(`[Pinterest] Generating content for ${job.listing_id}`);

		// Generate pin copy using Llama
		const prompt = `You are a Pinterest marketing expert specializing in luxury goods and pre-owned jewelry.

Create a high-converting Pinterest pin description for:
Product: ${job.title}
Details: ${job.description}

Generate:
1. Catchy pin title (8-12 words, optimized for search)
2. Description with benefits (100-150 chars)
3. Design recommendations (text placement, colors for jewelry aesthetic)
4. Search keywords for jewelry
5. Trending hashtags

Format as JSON with keys: title, description, text_position, colors, keywords, hashtags`;

		const response = (await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
			prompt,
		})) as any;

		const parsed = JSON.parse(typeof response === "string" ? response : response.response || "{}");

		const content = {
			pin_title: parsed.title,
			pin_description: parsed.description,
			design_specs: {
				dimensions: "1200x1500px", // Pinterest standard
				text_position: parsed.text_position || "bottom-left",
				color_scheme: parsed.colors || "luxury-dark",
			},
			hashtags: parsed.hashtags || ["#jewelry", "#vintage", "#preowned"],
			keywords: parsed.keywords || ["pre-owned jewelry", "luxury items"],
		};

		console.log(`[Pinterest] ✅ Content generated`);

		return { success: true, content };
	} catch (err) {
		console.error(`[Pinterest] ❌ Error:`, err);
		return { success: false, error: (err as Error).message };
	}
}

/**
 * Generate Instagram content (carousel captions + hashtags)
 */
export async function generateInstagramContent(
	job: SocialContentJob,
	ai: Ai
): Promise<{
	success: boolean;
	content?: {
		carousel_captions: string[]; // 1 per image (max 5)
		main_caption: string;
		hashtag_sets: {
			primary: string[];
			engagement: string[];
			niche: string[];
		};
		call_to_action: string;
	};
	error?: string;
}> {
	try {
		console.log(`[Instagram] Generating content for ${job.listing_id}`);

		// Generate captions using Llama
		const prompt = `You are an Instagram expert specializing in luxury jewelry and pre-owned items.

Create engaging Instagram carousel captions for:
Product: ${job.title}
Details: ${job.description}

Generate:
1. Individual captions for up to 5 carousel slides (hook each slide differently)
   - Slide 1: Story hook
   - Slide 2: Product details
   - Slide 3: Quality/condition
   - Slide 4: Styling tips
   - Slide 5: Call to action

2. Main caption (200-300 chars with emoji)
3. Primary hashtags (trending, high search volume)
4. Engagement hashtags (community focused)
5. Niche hashtags (jewelry specific)
6. Call to action text

Format as JSON with keys: slides, main, primary_tags, engagement_tags, niche_tags, cta`;

		const response = (await ai.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
			prompt,
		})) as any;

		const parsed = JSON.parse(typeof response === "string" ? response : response.response || "{}");

		const content = {
			carousel_captions: parsed.slides || [
				"Story hook",
				"Product details",
				"Quality",
				"Styling tip",
				"CTA",
			],
			main_caption: parsed.main || `Check out this beautiful pre-owned ${job.title}! ✨`,
			hashtag_sets: {
				primary: parsed.primary_tags || ["#jewelry", "#preowned", "#vintage"],
				engagement: parsed.engagement_tags || ["#jewelrylover", "#luxurystyle"],
				niche: parsed.niche_tags || ["#jewelrydesigner", "#statementjewelry"],
			},
			call_to_action: parsed.cta || "Link in bio to shop!",
		};

		console.log(`[Instagram] ✅ Content generated`);

		return { success: true, content };
	} catch (err) {
		console.error(`[Instagram] ❌ Error:`, err);
		return { success: false, error: (err as Error).message };
	}
}
