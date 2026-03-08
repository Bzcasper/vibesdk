import {
	DurableObjectNamespace,
	D1Database,
	R2Bucket,
	KVNamespace,
	Queue,
	Ai,
} from "@cloudflare/workers-types";

export interface Env {
	LISTING_SESSION: DurableObjectNamespace;
	BROWSER_SESSION: DurableObjectNamespace;
	DB: D1Database;
	R2_PROD: R2Bucket;
	R2_DEV: R2Bucket;
	KV_CONFIG: KVNamespace;
	KV_SESSIONS: KVNamespace;
	QUEUE_BROWSER: Queue;
	QUEUE_SOCIAL: Queue;
	AI: Ai;
	BROWSER: any;
	AI_GATEWAY_URL: string;
	USER_SECRETS_STORE: DurableObjectNamespace;
	ENVIRONMENT: string;
}

export enum ListingStatus {
	DRAFT = "DRAFT",
	ENRICHING = "ENRICHING",
	READY = "READY",
	EXPORTING = "EXPORTING",
	LIVE = "LIVE",
	ERROR = "ERROR",
}

export enum UploadJobStatus {
	PENDING = "PENDING",
	LAUNCHING = "LAUNCHING",
	UPLOADING = "UPLOADING",
	DONE = "DONE",
	ERROR = "ERROR",
}

export type SocialPlatform = "tiktok" | "pinterest" | "instagram";
