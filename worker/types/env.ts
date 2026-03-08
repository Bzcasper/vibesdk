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
	USER_SECRETS_STORE: DurableObjectNamespace;

	// Storage
	DB: D1Database;
	R2_PROD: R2Bucket;
	R2_DEV: R2Bucket;
	KV_CONFIG: KVNamespace;
	KV_SESSIONS: KVNamespace;

	// Queues
	QUEUE_BROWSER: Queue;
	QUEUE_SOCIAL: Queue;

	// AI
	AI: Ai;
	AI_GATEWAY_URL: string;

	// Environment
	ENVIRONMENT: 'development' | 'staging' | 'production';
	STORE_NAME: string;
	DEFAULT_MARKETPLACE: string;
	DEFAULT_CURRENCY: string;

	// Platform Credentials (optional)
	EBAY_STORE_NAME?: string;
	SHOPIFY_SHOP_DOMAIN?: string;
	SHOPIFY_ACCESS_TOKEN?: string;
	ETSY_KEYSTRING?: string;
	ETSY_SHARED_SECRET?: string;
	PINTEREST_APP_ID?: string;
	PINTEREST_APP_SECRET?: string;
	FACEBOOK_APP_ID?: string;
	FACEBOOK_APP_SECRET?: string;
}

export enum ListingStatus {
	DRAFT = "draft",
	ENRICHING = "enriching",
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
