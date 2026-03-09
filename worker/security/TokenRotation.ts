/**
 * TokenRotation - Automatic Token Refresh & Lifecycle Management
 *
 * Handles:
 * - OAuth2 refresh token exchange
 * - Rotation threshold checking
 * - Audit logging for rotations
 * - Expiration tracking
 */

import { D1Database } from "@cloudflare/workers-types";
import { TokenVault } from "./TokenVault";
import { TenantContext, TokenRotationEvent, DecryptedToken } from "./types";

export class TokenRotationManager {
	private vault: TokenVault;
	private db: D1Database;
	private env: any;

	constructor(vault: TokenVault, db: D1Database, env: any) {
		this.vault = vault;
		this.db = db;
		this.env = env;
	}

	/**
	 * Check if token needs rotation
	 */
	async shouldRotate(tenant: TenantContext, platform: string): Promise<boolean> {
		return await this.vault.shouldRotateToken(tenant, platform);
	}

	/**
	 * Rotate token using refresh token
	 */
	async rotateToken(
		tenant: TenantContext,
		platform: "ebay" | "shopify" | "etsy" | "facebook" | "tiktok" | "pinterest" | "instagram",
		currentToken: DecryptedToken
	): Promise<DecryptedToken> {
		const refreshToken = currentToken.refresh_token;
		if (!refreshToken) {
			throw new Error(`No refresh token available for ${platform}`);
		}

		// Exchange refresh token for new token
		const newToken = await this.exchangeRefreshToken(platform, refreshToken);

		// Store rotated token
		await this.vault.storeToken(tenant, platform, newToken);

		// Log rotation
		await this.logRotation(tenant, platform, currentToken, newToken, "auto_expiry");

		return newToken;
	}

	/**
	 * Platform-specific OAuth2 refresh logic
	 */
	private async exchangeRefreshToken(
		platform: string,
		refreshToken: string
	): Promise<DecryptedToken> {
		if (platform === "ebay") {
			return await this.refreshEbayToken(refreshToken);
		} else if (platform === "shopify") {
			return await this.refreshShopifyToken(refreshToken);
		} else if (platform === "etsy") {
			return await this.refreshEtsyToken(refreshToken);
		} else if (platform === "facebook") {
			return await this.refreshFacebookToken(refreshToken);
		} else if (platform === "tiktok") {
			return await this.refreshTikTokToken(refreshToken);
		} else if (platform === "pinterest") {
			return await this.refreshPinterestToken(refreshToken);
		} else if (platform === "instagram") {
			return await this.refreshFacebookToken(refreshToken); // Instagram uses FB tokens
		}

		throw new Error(`Unknown platform: ${platform}`);
	}

	/**
	 * Refresh eBay OAuth2 token
	 */
	private async refreshEbayToken(refreshToken: string): Promise<DecryptedToken> {
		const credentials = btoa(`${this.env.EBAY_OAUTH_CLIENT_ID}:${this.env.EBAY_OAUTH_CLIENT_SECRET}`);

		const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}).toString(),
		});

		if (!response.ok) {
			throw new Error(`eBay refresh failed: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	/**
	 * Refresh Shopify OAuth2 token
	 */
	private async refreshShopifyToken(_refreshToken: string): Promise<DecryptedToken> {
		// Shopify uses a different refresh mechanism
		// For now, throw as Shopify typically doesn't expire access tokens
		throw new Error("Shopify tokens don't expire - use stored token");
	}

	/**
	 * Refresh Etsy OAuth2 token
	 */
	private async refreshEtsyToken(refreshToken: string): Promise<DecryptedToken> {
		const response = await fetch("https://api.etsy.com/v3/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				client_id: this.env.ETSY_OAUTH_CLIENT_ID,
				client_secret: this.env.ETSY_OAUTH_CLIENT_SECRET,
				refresh_token: refreshToken,
			}).toString(),
		});

		if (!response.ok) {
			throw new Error(`Etsy refresh failed: ${response.status}`);
		}

		return await response.json();
	}

	/**
	 * Refresh Facebook token
	 */
	private async refreshFacebookToken(refreshToken: string): Promise<DecryptedToken> {
		const params = new URLSearchParams({
			grant_type: "ig_refresh_token",
			access_token: refreshToken,
		});

		const response = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`, {
			method: "GET",
		});

		if (!response.ok) {
			throw new Error(`Facebook refresh failed: ${response.status}`);
		}

		return await response.json();
	}

	/**
	 * Refresh TikTok OAuth2 token (v2)
	 */
	private async refreshTikTokToken(refreshToken: string): Promise<DecryptedToken> {
		const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				client_key: this.env.TIKTOK_CLIENT_ID || "",
				client_secret: this.env.TIKTOK_CLIENT_SECRET || "",
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}).toString(),
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`TikTok refresh failed: ${response.status} ${errorData}`);
		}

		const data = (await response.json()) as any;
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token || refreshToken,
			expires_in: data.expires_in,
			token_type: data.token_type,
			scope: data.scope,
		};
	}

	/**
	 * Refresh Pinterest OAuth2 token (v5)
	 */
	private async refreshPinterestToken(refreshToken: string): Promise<DecryptedToken> {
		const credentials = btoa(
			`${this.env.PINTEREST_APP_ID || ""}:${this.env.PINTEREST_APP_SECRET || ""}`
		);

		const response = await fetch("https://api.pinterest.com/v5/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
			}).toString(),
		});

		if (!response.ok) {
			const errorData = await response.text();
			throw new Error(`Pinterest refresh failed: ${response.status} ${errorData}`);
		}

		const data = (await response.json()) as any;
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token || refreshToken,
			expires_in: data.expires_in,
			token_type: data.token_type,
			scope: data.scope,
		};
	}

	/**
	 * Log rotation event
	 */
	private async logRotation(
		tenant: TenantContext,
		platform: string,
		oldToken: DecryptedToken,
		newToken: DecryptedToken,
		reason: "auto_expiry" | "usage_threshold" | "manual_request"
	): Promise<void> {
		try {
			const oldHash = await this.sha256(oldToken.access_token);
			const newHash = await this.sha256(newToken.access_token);

			const event: TokenRotationEvent = {
				id: crypto.randomUUID(),
				storeId: tenant.storeId,
				userId: tenant.userId,
				platform,
				oldTokenHash: oldHash,
				newTokenHash: newHash,
				rotationReason: reason,
				rotatedAt: new Date().toISOString(),
				nextRotationDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			};

			await this.db
				.prepare(
					`
				INSERT INTO token_rotation_history
				(id, store_id, user_id, platform, old_token_hash, new_token_hash, rotation_reason, rotated_at, next_rotation_due)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
				)
				.bind(
					event.id,
					event.storeId,
					event.userId,
					event.platform,
					event.oldTokenHash,
					event.newTokenHash,
					event.rotationReason,
					event.rotatedAt,
					event.nextRotationDue
				)
				.run();
		} catch (error) {
			console.error(`Token rotation logging failed:`, error);
		}
	}

	/**
	 * SHA-256 hash for token verification (not for encryption)
	 */
	private async sha256(input: string): Promise<string> {
		const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
		const hashArray = Array.from(new Uint8Array(buffer));
		return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	/**
	 * Get rotation history
	 */
	async getRotationHistory(
		tenant: TenantContext,
		platform: string,
		days: number = 90
	): Promise<TokenRotationEvent[]> {
		const results = await this.db
			.prepare(
				`
			SELECT * FROM token_rotation_history
			WHERE store_id = ? AND platform = ? AND rotated_at > datetime('now', '-${days} days')
			ORDER BY rotated_at DESC
		`
			)
			.bind(tenant.storeId, platform)
			.all<TokenRotationEvent>();

		return results.results || [];
	}
}
