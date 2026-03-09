/**
 * TokenVault - Encrypted Token Storage with Audit Logging
 *
 * Features:
 * - AES-256-GCM encryption for all stored tokens
 * - Automatic audit logging to D1
 * - Per-tenant token isolation
 * - TTL-based expiration
 */

import { D1Database, KVNamespace } from "@cloudflare/workers-types";
import {
	EncryptedToken,
	TokenVaultConfig,
	DecryptedToken,
	TenantContext,
	TokenAuditEntry,
} from "./types";

export class TokenVault {
	private cryptoKey: CryptoKey;
	private config: TokenVaultConfig;
	private db: D1Database;
	private kv: KVNamespace;

	constructor(cryptoKey: CryptoKey, config: TokenVaultConfig, db: D1Database, kv: KVNamespace) {
		this.cryptoKey = cryptoKey;
		this.config = config;
		this.db = db;
		this.kv = kv;
	}

	/**
	 * Create TokenVault from Worker environment
	 */
	static async create(env: any): Promise<TokenVault> {
		// Import encryption key from Worker Secrets
		const keyHex = env.ENCRYPTION_KEY; // Must be 64 hex chars (32 bytes)
		if (!keyHex || keyHex.length !== 64) {
			throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
		}

		// Convert hex string to CryptoKey
		const keyBytes = new Uint8Array(32);
		for (let i = 0; i < 32; i++) {
			keyBytes[i] = parseInt(keyHex.substring(i * 2, i * 2 + 2), 16);
		}

		const cryptoKey = await crypto.subtle.importKey(
			"raw",
			keyBytes,
			{ name: "AES-GCM" },
			false,
			["encrypt", "decrypt"]
		);

		return new TokenVault(
			cryptoKey,
			{
				encryptionKey: keyHex,
				rotationThreshold: parseInt(env.TOKEN_ROTATION_THRESHOLD || "1000"),
				ttlSeconds: parseInt(env.TOKEN_TTL_SECONDS || "86400"),
			},
			env.DB,
			env.TOKENS
		);
	}

	/**
	 * Encrypt token payload
	 */
	async encryptToken(payload: DecryptedToken): Promise<{ encrypted: string; nonce: string }> {
		// Generate random nonce (IV) - 12 bytes for GCM
		const nonce = crypto.getRandomValues(new Uint8Array(12));

		// Encode payload
		const encoder = new TextEncoder();
		const data = encoder.encode(JSON.stringify(payload));

		// Encrypt
		const encrypted = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv: nonce },
			this.cryptoKey,
			data
		);

		// Return as base64 strings
		return {
			encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
			nonce: btoa(String.fromCharCode(...nonce)),
		};
	}

	/**
	 * Decrypt token payload
	 */
	async decryptToken(token: EncryptedToken): Promise<DecryptedToken> {
		// Decode from base64
		const encryptedBytes = Uint8Array.from(atob(token.encryptedPayload), (c) =>
			c.charCodeAt(0)
		);
		const nonceBytes = Uint8Array.from(atob(token.nonce), (c) => c.charCodeAt(0));

		// Decrypt
		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: nonceBytes },
			this.cryptoKey,
			encryptedBytes
		);

		// Decode and parse
		const decoder = new TextDecoder();
		return JSON.parse(decoder.decode(decrypted));
	}

	/**
	 * Store encrypted token in KV with multi-tenant scoping
	 */
	async storeToken(tenant: TenantContext, platform: string, payload: DecryptedToken): Promise<string> {
		const tokenId = crypto.randomUUID();
		const now = new Date().toISOString();

		// Encrypt payload
		const { encrypted, nonce } = await this.encryptToken(payload);

		// Create token record
		const record: EncryptedToken = {
			id: tokenId,
			userId: tenant.userId,
			platform: platform as any,
			encryptedPayload: encrypted,
			nonce,
			expiresAt: new Date(Date.now() + this.config.ttlSeconds * 1000).toISOString(),
			createdAt: now,
			lastUsedAt: now,
			rotationCount: 0,
			maxRotation: this.config.rotationThreshold,
		};

		// Store in KV with tenant isolation key
		const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
		await this.kv.put(kvKey, JSON.stringify(record), {
			expirationTtl: this.config.ttlSeconds,
		});

		// Audit log
		await this.auditLog(tenant, platform, "token_stored", {
			tokenId,
			expiresIn: this.config.ttlSeconds,
		});

		return tokenId;
	}

	/**
	 * Retrieve and decrypt token from KV
	 */
	async retrieveToken(
		tenant: TenantContext,
		platform: string,
		options: { ignoreExpiration?: boolean } = {}
	): Promise<DecryptedToken> {
		const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
		const stored = await this.kv.get(kvKey);

		if (!stored) {
			await this.auditLog(tenant, platform, "token_not_found", {
				kvKey,
			});
			throw new Error(`No ${platform} token found for user ${tenant.userId}`);
		}

		const token = JSON.parse(stored) as EncryptedToken;

		// Check expiration unless ignored
		if (!options.ignoreExpiration && new Date(token.expiresAt) < new Date()) {
			await this.auditLog(tenant, platform, "token_expired", {
				expiresAt: token.expiresAt,
			});
			throw new Error(`Token expired at ${token.expiresAt}`);
		}

		// Decrypt
		const decrypted = await this.decryptToken(token);

		// Update last used time
		token.lastUsedAt = new Date().toISOString();
		token.rotationCount++;
		await this.kv.put(kvKey, JSON.stringify(token), {
			expirationTtl: this.config.ttlSeconds,
		});

		// Audit log
		await this.auditLog(tenant, platform, "token_retrieved", {
			tokenId: token.id,
			rotationCount: token.rotationCount,
			expired: new Date(token.expiresAt) < new Date(),
		});

		return decrypted;
	}

	/**
	 * Delete token (logout)
	 */
	async deleteToken(tenant: TenantContext, platform: string): Promise<void> {
		const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
		await this.kv.delete(kvKey);

		await this.auditLog(tenant, platform, "token_deleted", {
			kvKey,
		});
	}

	/**
	 * Check if token needs rotation
	 */
	async shouldRotateToken(tenant: TenantContext, platform: string): Promise<boolean> {
		const kvKey = `vault:${tenant.storeId}:${tenant.userId}:${platform}`;
		const stored = await this.kv.get(kvKey);

		if (!stored) return false;

		const token = JSON.parse(stored) as EncryptedToken;
		const isExpiringSoon =
			new Date(token.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000; // < 24h
		const exceedsRotationThreshold = token.rotationCount > token.maxRotation;

		return isExpiringSoon || exceedsRotationThreshold;
	}

	/**
	 * Audit log with tenant context
	 */
	private async auditLog(
		tenant: TenantContext,
		platform: string,
		action: string,
		details?: Record<string, any>
	): Promise<void> {
		try {
			await this.db
				.prepare(
					`
				INSERT INTO token_audit_log 
				(id, store_id, user_id, workspace_id, platform, action, details, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`
				)
				.bind(
					crypto.randomUUID(),
					tenant.storeId,
					tenant.userId,
					tenant.workspaceId || null,
					platform,
					action,
					details ? JSON.stringify(details) : null,
					new Date().toISOString()
				)
				.run();
		} catch (error) {
			// Fail silently to not break token operations
			console.error(`Audit log failed for ${action}:`, error);
		}
	}

	/**
	 * Generate compliance report
	 */
	async getAuditLog(tenant: TenantContext, days: number = 90): Promise<TokenAuditEntry[]> {
		const results = await this.db
			.prepare(
				`
			SELECT * FROM token_audit_log
			WHERE store_id = ? AND created_at > datetime('now', '-${days} days')
			ORDER BY created_at DESC
		`
			)
			.bind(tenant.storeId)
			.all<TokenAuditEntry>();

		return results.results || [];
	}
}
