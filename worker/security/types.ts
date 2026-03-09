/**
 * Security Types for Token Management & Multi-tenancy
 */

export interface TenantContext {
	storeId: string; // Root multi-tenant identifier
	userId: string; // User within store
	workspaceId?: string; // Team/workspace within store (future)
	permissions: string[]; // ["tokens:read", "tokens:write", "listings:manage"]
}

export interface EncryptedToken {
	id: string; // UUID
	userId: string; // tenant user ID
	platform: "ebay" | "shopify" | "etsy" | "facebook" | "tiktok" | "pinterest" | "instagram"; // Platform
	encryptedPayload: string; // Base64(AES-256-GCM(token))
	nonce: string; // Base64(IV for encryption)
	expiresAt: string; // ISO timestamp when token expires
	createdAt: string; // ISO timestamp when stored
	lastUsedAt: string; // ISO timestamp of last retrieval
	rotationCount: number; // API calls made since last refresh
	maxRotation: number; // Threshold (e.g., 1000) before auto-refresh
	refreshToken?: string; // OAuth2 refresh token (encrypted)
}

export interface TokenVaultConfig {
	encryptionKey: string; // 32-byte hex string (loaded from Worker Secret)
	rotationThreshold: number; // Default 1000 API calls
	ttlSeconds: number; // Default 86400 (24 hours)
}

export interface TokenAuditEntry {
	id: string;
	storeId: string;
	userId: string;
	workspaceId: string | null;
	platform: string;
	action: string; // "token_stored", "token_retrieved", "token_rotated", "token_failed"
	details?: string; // JSON details
	ipAddress?: string;
	userAgent?: string;
	createdAt: string;
}

export interface TokenRotationEvent {
	id: string;
	storeId: string;
	userId: string;
	platform: string;
	oldTokenHash: string; // SHA-256(old token) for verification
	newTokenHash: string; // SHA-256(new token) for verification
	rotationReason: "auto_expiry" | "usage_threshold" | "manual_request";
	rotatedAt: string;
	nextRotationDue: string;
}

export interface DecryptedToken {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	token_type?: string;
	scope?: string;
	[key: string]: any;
}
