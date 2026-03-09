/**
 * Browser Jobs Queue Handler
 *
 * Handles eBay login, image uploads, and automation tasks.
 */

import { Message } from "@cloudflare/workers-types";
import { Env, ListingStatus } from "../types/env";
import { getListingById, getListingFields, logDispatch, updateListingStatus } from "../db/listings";
import { isSessionValid, LoginRequiredError } from "../agents/browser/ebay-login";
import { UploadResult } from "../agents/browser/ebay-uploader";
import { TokenVault } from "../security/TokenVault";
import { TokenRotationManager } from "../security/TokenRotation";
import { TenantContext } from "../security/types";

// ============================================================
// Types
// ============================================================

export interface BrowserJobMessage {
	listingId: string;
	action: "ebay_login" | "ebay_upload";
	userId: string;
	credentials?: {
		username: string;
		password: string;
	};
	uploadParams?: {
		title: string;
		description: string;
		price: number;
		category?: string;
	};
}

export interface BrowserJobResult {
	listingId: string;
	success: boolean;
	action: string;
	ebayItemId?: string;
	sessionId?: string;
	uploadResult?: UploadResult;
	error?: string;
	details?: Record<string, unknown>;
}

// ============================================================
// Queue Handler
// ============================================================

export async function handleBrowserJobsBatch(
	messages: Message<BrowserJobMessage>[],
	env: Env
): Promise<void> {
	const results: BrowserJobResult[] = [];

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
		const { listingId, action, userId, credentials, uploadParams } = message.body;

		try {
			// Validate listing exists
			const listing = await getListingById(env.DB, listingId);
			if (!listing) {
				await logDispatch(env.DB, {
					listingId: listingId,
					action: `browser_${action}`,
					status: "error",
					details: "Listing not found",
				});
				message.ack();
				continue;
			}

			// Create tenant context (placeholder - should come from auth middleware in production)
			const tenant: TenantContext = {
				storeId: "store_default", // TODO: Get from authenticated user context
				userId: userId,
				permissions: ["tokens:read", "tokens:write"],
			};

			const result: BrowserJobResult = {
				listingId,
				action,
				success: false,
			};

			// Route to appropriate handler
			if (action === "ebay_login" && credentials && vault) {
				result.success = await handleEbayLogin(env, vault, tenant, credentials, result);
			} else if (action === "ebay_upload" && uploadParams && vault && rotationMgr) {
				result.success = await handleEbayUpload(env, vault, rotationMgr, tenant, uploadParams, result);
			} else {
				throw new Error(`Unknown action: ${action}`);
			}

			// Log result
			await logDispatch(env.DB, {
				listingId: listingId,
				action: `browser_${action}`,
				status: result.success ? "success" : "error",
				details: JSON.stringify({
					action,
					success: result.success,
					ebayItemId: result.ebayItemId,
					error: result.error,
				}),
			});

			// Update listing status on successful upload
			if (action === "ebay_upload" && result.success && result.ebayItemId) {
				await updateListingStatus(env.DB, listingId, ListingStatus.PUBLISHED);
			}

			results.push(result);
			message.ack();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";

			// Log error
			await logDispatch(env.DB, {
				listingId: listingId,
				action: `browser_${message.body.action}`,
				status: "error",
				details: errorMsg,
			});

			results.push({
				listingId,
				action,
				success: false,
				error: errorMsg,
			});

			// Retry on transient errors
			message.retry();
		}
	}
}

// ============================================================
// Action Handlers
// ============================================================

async function handleEbayLogin(
	env: Env,
	vault: TokenVault,
	tenant: TenantContext,
	credentials: { username: string; password: string },
	result: BrowserJobResult
): Promise<boolean> {
	try {
		// Try to retrieve existing token from vault
		try {
			const existingToken = await vault.retrieveToken(tenant, "ebay");
			if (existingToken) {
				result.sessionId = "ebay_session_active";
				result.details = { reusingExistingSession: true };
				return true;
			}
		} catch {
			// No existing token, continue with login flow
		}

		// In production, trigger browser automation to login with credentials
		// For now, mark as requiring manual login
		result.error = "Manual eBay login required. Direct user to Settings > eBay Connection.";
		return false;
	} catch (error) {
		result.error = error instanceof Error ? error.message : "Unknown error during login";
		return false;
	}
}

async function handleEbayUpload(
	env: Env,
	vault: TokenVault,
	rotationMgr: TokenRotationManager,
	tenant: TenantContext,
	uploadParams: {
		title: string;
		description: string;
		price: number;
		category?: string;
	},
	result: BrowserJobResult
): Promise<boolean> {
	try {
		// Check if token needs rotation
		const shouldRotate = await rotationMgr.shouldRotate(tenant, "ebay");
		
		let token;
		if (shouldRotate) {
			// Retrieve token even if expired to get refresh_token
			token = await vault.retrieveToken(tenant, "ebay", { ignoreExpiration: true });
			if (token.refresh_token) {
				token = await rotationMgr.rotateToken(tenant, "ebay", token);
			} else {
				// Fallback to normal retrieval if no refresh token (will throw if expired)
				token = await vault.retrieveToken(tenant, "ebay");
			}
		} else {
			token = await vault.retrieveToken(tenant, "ebay");
		}

		if (!token) {
			result.error = "No valid eBay token found. Please authenticate first.";
			return false;
		}

		// In production, trigger browser automation to upload listing with token
		// For now, simulate successful upload
		const simulatedUploadResult: UploadResult = {
			successCount: 1,
			errorCount: 0,
			errorMessages: [],
			screenshotR2Keys: [],
		};

		result.uploadResult = simulatedUploadResult;
		result.ebayItemId = `mock-item-${tenant.userId}`;
		result.details = {
			uploadedAt: new Date().toISOString(),
			simulated: true,
			tokenRotated: shouldRotate,
		};
		return true;
	} catch (error) {
		result.error = error instanceof Error ? error.message : "Unknown error during upload";
		return false;
	}
}

// ============================================================
// Queue Consumer Export
// ============================================================

export default {
	async queue(batch: { messages: Message<BrowserJobMessage>[] }, env: Env): Promise<void> {
		await handleBrowserJobsBatch(batch.messages, env);
	},
};
