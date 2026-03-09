/**
 * KV Manager — Production Token Vault
 * Handles encrypted token storage and retrieval
 */

import { KVNamespace } from "@cloudflare/workers-types";

export class TokenVault {
	constructor(private kv: KVNamespace) {}

	/**
	 * Store encrypted token in KV
	 * Keys: platform:store_id:token_type (e.g., ebay:store123:access_token)
	 */
	async storeToken(
		platform: string,
		storeId: string,
		tokenType: "access_token" | "refresh_token",
		encryptedValue: string,
		expiresIn?: number
	): Promise<boolean> {
		try {
			const key = `token:${platform}:${storeId}:${tokenType}`;
			const options: any = {
				metadata: {
					platform,
					storeId,
					tokenType,
					storedAt: new Date().toISOString(),
				},
			};

			if (expiresIn) {
				options.expirationTtl = expiresIn;
			}

			await this.kv.put(key, encryptedValue, options);
			return true;
		} catch (error) {
			console.error("[TokenVault] Failed to store token:", error);
			return false;
		}
	}

	/**
	 * Retrieve encrypted token from KV
	 */
	async getToken(
		platform: string,
		storeId: string,
		tokenType: "access_token" | "refresh_token"
	): Promise<string | null> {
		try {
			const key = `token:${platform}:${storeId}:${tokenType}`;
			const value = await this.kv.get(key);
			return value;
		} catch (error) {
			console.error("[TokenVault] Failed to get token:", error);
			return null;
		}
	}

	/**
	 * Delete token from KV
	 */
	async deleteToken(
		platform: string,
		storeId: string,
		tokenType?: "access_token" | "refresh_token"
	): Promise<boolean> {
		try {
			const key = tokenType
				? `token:${platform}:${storeId}:${tokenType}`
				: `token:${platform}:${storeId}`;

			await this.kv.delete(key);
			return true;
		} catch (error) {
			console.error("[TokenVault] Failed to delete token:", error);
			return false;
		}
	}

	/**
	 * List all tokens for a store (for cleanup/audit)
	 */
	async listTokens(storeId: string): Promise<{ key: string; metadata: any }[]> {
		try {
			const result = await this.kv.list({ prefix: `token:${storeId}` });
			return result.keys;
		} catch (error) {
			console.error("[TokenVault] Failed to list tokens:", error);
			return [];
		}
	}
}

/**
 * Config Cache — Store configuration in KV
 */
export class ConfigCache {
	constructor(private kv: KVNamespace) {}

	async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
		const options: any = {};
		if (ttlSeconds) options.expirationTtl = ttlSeconds;

		await this.kv.put(key, JSON.stringify(value), options);
	}

	async get<T>(key: string): Promise<T | null> {
		const value = await this.kv.get(key);
		return value ? JSON.parse(value) : null;
	}

	async delete(key: string): Promise<void> {
		await this.kv.delete(key);
	}
}
