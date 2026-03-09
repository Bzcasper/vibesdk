/**
 * Social Jobs Queue Handler
 *
 * Handles social content generation jobs from the queue.
 * Integrates with TokenVault for TikTok/Pinterest authentication.
 */

import { Message } from "@cloudflare/workers-types";
import { Env, ListingStatus } from "../types/env";
import { getListingById, getListingFields, logDispatch, updateListingStatus } from "../db/listings";
import { generateTikTokPackage, TikTokPackage } from "../agents/social/tiktok";
import { generatePinterestPackage, PinterestPackage } from "../agents/social/pinterest";
import { EnrichedDraft } from "../agents/listing/enricher";
import { TokenVault } from "../security/TokenVault";
import { TokenRotationManager } from "../security/TokenRotation";
import { TenantContext } from "../security/types";

// ============================================================
// Types
// ============================================================

export interface SocialJobMessage {
	listingId?: string;
	listing_id?: string; // Support snake_case
	action?: string;
	type?: string; // Support 'type' from dispatch.ts
	platforms?: ("tiktok" | "pinterest")[];
	platform?: "tiktok" | "pinterest"; // Support single platform
	userId?: string;
	user_id?: string;
}

export interface SocialJobResult {
	listingId: string;
	success: boolean;
	tiktok?: TikTokPackage;
	pinterest?: PinterestPackage;
	error?: string;
}

// ============================================================
// Queue Handler
// ============================================================

export async function handleSocialJobsBatch(
	messages: Message<SocialJobMessage>[],
	env: Env
): Promise<void> {
	const results: SocialJobResult[] = [];

	// Initialize vault for token management
	let vault: TokenVault;
	let rotationMgr: TokenRotationManager;
	try {
		vault = await TokenVault.create(env);
		rotationMgr = new TokenRotationManager(vault, env.DB, env);
	} catch (error) {
		console.error("Failed to initialize token vault:", error);
		// Continue without vault (fallback to old method)
	}

	for (const message of messages) {
		const body = message.body;
		const listingId = body.listingId || body.listing_id;
		const userId = body.userId || body.user_id || "user_default";
		const platforms = body.platforms || (body.platform ? [body.platform] : []);
		const type = body.type || body.action;

		if (!listingId) {
			console.error("No listingId in social job message");
			message.ack();
			continue;
		}

		try {
			// Step 0: Create tenant context (placeholder - should come from auth middleware in production)
			const tenant: TenantContext = {
				storeId: "store_default", // TODO: Get from listing ownership if implemented
				userId: userId,
				permissions: ["tokens:read", "tokens:write"],
			};

			// Step 1: Get the listing from D1
			const listing = await getListingById(env.DB, listingId);
			if (!listing) {
				await logDispatch(env.DB, {
					listingId: listingId,
					action: "social_generation",
					status: "error",
					details: "Listing not found",
				});
				message.ack();
				continue;
			}

			// Step 2: Get listing fields to reconstruct EnrichedDraft
			const fields = await getListingFields(env.DB, listingId);

			// Reconstruct EnrichedDraft from listing and fields
			// Note: In production, fields would be properly typed from D1
			const draft = {
				id: listing.id,
				sku: listing.sku,
				rawInput: (fields.rawInput || {}) as EnrichedDraft["rawInput"],
				fields: fields,
				htmlDescription: listing.html_description,
				csvRow: null,
				mediaAssets: [],
				status: listing.status as ListingStatus,
				createdAt: listing.created_at,
				classification: (fields.classification || {}) as EnrichedDraft["classification"],
				itemSpecifics: (fields.itemSpecifics || []) as EnrichedDraft["itemSpecifics"],
				title: (typeof fields.title === "string" ? fields.title : (fields.title as { value?: string })?.value) || listing.title,
				description: (fields.description || {}) as EnrichedDraft["description"],
				pricing: (fields.pricing || {}) as EnrichedDraft["pricing"],
			} as EnrichedDraft;

			const result: SocialJobResult = {
				listingId,
				success: false,
			};

			// Step 3: Generate TikTok package if requested
			if (platforms.includes("tiktok")) {
				try {
					if (vault && rotationMgr) {
						// Check if token needs rotation
						const shouldRotate = await rotationMgr.shouldRotate(tenant, "tiktok");
						if (shouldRotate) {
							// Retrieve token even if expired to get refresh_token
							const currentToken = await vault.retrieveToken(tenant, "tiktok", { ignoreExpiration: true });
							if (currentToken.refresh_token) {
								await rotationMgr.rotateToken(tenant, "tiktok", currentToken);
							}
						}
					}
					result.tiktok = await generateTikTokPackage(env, draft);
				} catch (error) {
					console.error("TikTok generation error:", error);
					await logDispatch(env.DB, {
						listingId: listingId,
						action: "tiktok_generation",
						status: "error",
						details: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			// Step 4: Generate Pinterest package if requested
			if (platforms.includes("pinterest")) {
				try {
					if (vault && rotationMgr) {
						// Check if token needs rotation
						const shouldRotate = await rotationMgr.shouldRotate(tenant, "pinterest");
						if (shouldRotate) {
							// Retrieve token even if expired to get refresh_token
							const currentToken = await vault.retrieveToken(tenant, "pinterest", { ignoreExpiration: true });
							if (currentToken.refresh_token) {
								await rotationMgr.rotateToken(tenant, "pinterest", currentToken);
							}
						}
					}
					result.pinterest = await generatePinterestPackage(env, draft);
				} catch (error) {
					console.error("Pinterest generation error:", error);
					await logDispatch(env.DB, {
						listingId: listingId,
						action: "pinterest_generation",
						status: "error",
						details: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			// Step 5: Store social content in D1
			if (result.tiktok || result.pinterest) {
				await storeSocialContent(env, listingId, result);
			}

			// Step 6: Update listing status
			await updateListingStatus(env.DB, listingId, ListingStatus.READY);

			// Step 7: Log success
			await logDispatch(env.DB, {
				listingId: listingId,
				action: "social_generation",
				status: "success",
				details: JSON.stringify({
					platforms: platforms,
					tiktok: !!result.tiktok,
					pinterest: !!result.pinterest,
				}),
			});

			result.success = true;
			results.push(result);
			message.ack();
		} catch (error) {
			// Log error and retry
			await logDispatch(env.DB, {
				listingId: listingId,
				action: "social_generation",
				status: "error",
				details: error instanceof Error ? error.message : "Unknown error",
			});

			results.push({
				listingId,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});

			message.retry();
		}
	}
}

// ============================================================
// Storage Helpers
// ============================================================

async function storeSocialContent(env: Env, listingId: string, result: SocialJobResult): Promise<void> {
	// Store TikTok content
	if (result.tiktok) {
		await env.DB.prepare(
			`INSERT INTO social_content (id, listing_id, platform, content, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(listing_id, platform) DO UPDATE SET content = excluded.content, updated_at = ?`
		)
			.bind(
				crypto.randomUUID(),
				listingId,
				"tiktok",
				JSON.stringify(result.tiktok),
				new Date().toISOString(),
				new Date().toISOString()
			)
			.run();
	}

	// Store Pinterest content
	if (result.pinterest) {
		await env.DB.prepare(
			`INSERT INTO social_content (id, listing_id, platform, content, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(listing_id, platform) DO UPDATE SET content = excluded.content, updated_at = ?`
		)
			.bind(
				crypto.randomUUID(),
				listingId,
				"pinterest",
				JSON.stringify(result.pinterest),
				new Date().toISOString(),
				new Date().toISOString()
			)
			.run();
	}
}

// ============================================================
// Queue Consumer Export
// ============================================================

export default {
	async queue(batch: { messages: Message<SocialJobMessage>[] }, env: Env): Promise<void> {
		await handleSocialJobsBatch(batch.messages, env);
	},
};
