import {
	DurableObjectNamespace,
	D1Database,
	R2Bucket,
	KVNamespace,
	Queue,
	Ai,
} from "@cloudflare/workers-types";

export interface Env {
	// Durable Objects
	LISTING_SESSION: DurableObjectNamespace;
	BROWSER_SESSION: DurableObjectNamespace;

	// Storage
	DB: D1Database;
	R2_PROD: R2Bucket;
	R2_DEV: R2Bucket;
	MEDIA: R2Bucket;
	CONFIG: KVNamespace;
	TOKENS: KVNamespace;
	BROWSER_CACHE: KVNamespace;
	RATELIMIT: KVNamespace;
	ASSETS: { fetch: typeof fetch };

	// Queues
	JOBS_QUEUE: Queue;
	DISPATCH_QUEUE?: Queue;
	MEDIA_QUEUE?: Queue;
	SOCIAL_QUEUE?: Queue;
	SYNC_QUEUE?: Queue;

	// AI
	AI: Ai;
	AI_GATEWAY_URL: string;
	GOOGLE_AI_API_KEY?: string; // Google AI Studio API key (optional)
	GROK_API_KEY?: string; // Grok Vision API key (optional)

	// Security
	ENCRYPTION_KEY: string; // 64 hex chars (32 bytes) for token vault

	// Environment
	ENVIRONMENT: "development" | "staging" | "production";
	STORE_NAME: string;
	DEFAULT_MARKETPLACE: string;
	DEFAULT_CURRENCY: string;

	// Platform Credentials (optional)
	EBAY_STORE_NAME?: string;
	EBAY_OAUTH_CLIENT_ID?: string;
	EBAY_OAUTH_CLIENT_SECRET?: string;
	SHOPIFY_SHOP_DOMAIN?: string;
	SHOPIFY_ACCESS_TOKEN?: string;
	ETSY_KEYSTRING?: string;
	ETSY_SHARED_SECRET?: string;
	ETSY_OAUTH_CLIENT_ID?: string;
	ETSY_OAUTH_CLIENT_SECRET?: string;
	TIKTOK_CLIENT_ID?: string;
	TIKTOK_CLIENT_SECRET?: string;
	PINTEREST_APP_ID?: string;
	PINTEREST_APP_SECRET?: string;
	FACEBOOK_APP_ID?: string;
	FACEBOOK_APP_SECRET?: string;
}

export enum ListingStatus {
	DRAFT = "draft",
	ENRICHING = "enriching",
	PROCESSING = "processing",
	READY = "ready",
	EXPORTING = "exporting",
	PUBLISHED = "published",
	LIVE = "live",
	ERROR = "error",
	SOLD = "sold",
}

export enum UploadJobStatus {
	PENDING = "PENDING",
	LAUNCHING = "LAUNCHING",
	UPLOADING = "UPLOADING",
	DONE = "DONE",
	ERROR = "ERROR",
}

export type SocialPlatform = "tiktok" | "pinterest" | "instagram";
