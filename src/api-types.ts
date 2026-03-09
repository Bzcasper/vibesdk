/**
 * Listing Factory API Types
 * Unified Source of Truth for Frontend/Backend
 * Pre-owned Jewelry Store Listing System
 */

import { Listing, ListingInput } from "../shared/types/listing";

// ============================================================================
// Core API Response Types
// ============================================================================

export interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export type ApiResponse<T = unknown> = APIResponse<T>;

export type ListingsResponse = APIResponse<Listing[]>;
export type ListingCreateRequest = ListingInput;
export type ListingCreateResponse = APIResponse<Listing>;

// ============================================================================
// Auth & Session Types
// ============================================================================

export interface AuthUser {
	id: string;
	email: string;
	store_name: string;
	created_at: string;
}

export interface AuthSession {
	id: string;
	user_id: string;
	token: string;
	created_at: string;
	updated_at: string;
}

export type OAuthProvider = "google" | "github" | "shopify";

// ============================================================================
// Platform Types
// ============================================================================

export type PlatformName = "ebay" | "shopify" | "etsy" | "facebook" | "tiktok" | "pinterest" | "instagram" | "poshmark" | "whatnot" | "mercari";

export interface PlatformAccount {
	platform: PlatformName;
	account_id: string;
	access_token?: string;
	refresh_token?: string;
	store_id?: string;
	expires_at?: string;
	connected: boolean;
	created_at: string;
}

// ============================================================================
// Listing Types
// ============================================================================

export interface ListingStatus {
	draft: string;
	enriching: string;
	ready: string;
	exporting: string;
	published: string;
	live: string;
	error: string;
	sold: string;
}

export interface SKUGenerationResult {
	sku: string;
	category: string;
	sequence: number;
}

// ============================================================================
// Content Generation Types
// ============================================================================

export interface GeneratedTitle {
	platform: PlatformName;
	title: string;
	seo_keywords?: string[];
}

export interface GeneratedDescription {
	platform: PlatformName;
	description: string;
	format: "plain" | "html" | "markdown";
}

export interface PricingSuggestion {
	suggested_price: number;
	price_range: {
		min: number;
		max: number;
	};
	strategy: string;
	rationale: string;
}

// ============================================================================
// Media & Image Types
// ============================================================================

export interface MediaAsset {
	id: string;
	listing_id: string;
	r2_key: string;
	alt_text?: string;
	primary: boolean;
	created_at: string;
}

export interface ImageProcessingResult {
	url: string;
	width: number;
	height: number;
	size_bytes: number;
}

// ============================================================================
// CSV & Export Types
// ============================================================================

export interface EbayCSVRow {
	action: string;
	item_id?: string;
	sku: string;
	title: string;
	description: string;
	condition: string;
	price: string;
	category: string;
	// ... other eBay fields
}

export interface CSVBatch {
	id: string;
	status: "pending" | "uploading" | "uploaded" | "failed";
	rows_count: number;
	created_at: string;
	uploaded_at?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export type SecurityErrorType = "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_SIGNATURE";

export interface SecurityError extends Error {
	type: SecurityErrorType;
	details?: unknown;
}

export interface RateLimitExceededError extends Error {
	limitType: string;
	limit?: number;
	period?: number;
	suggestions?: string[];
}
