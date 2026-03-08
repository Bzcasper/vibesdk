/**
 * Cloudflare Worker Environment Bindings
 * 
 * This file defines all bindings and environment variables available to the Worker.
 * It serves as the single source of truth for the Env interface used throughout the codebase.
 */

export interface Env {
  // ============================================================
  // RUNTIME BINDINGS (from wrangler.toml)
  // ============================================================

  /** D1 SQLite Database */
  DB: D1Database;

  /** R2 Bucket for media storage */
  MEDIA_BUCKET: R2Bucket;

  /** Workers AI binding */
  AI: Ai;

  /** Browser Rendering binding */
  BROWSER: Fetcher;

  /** Static assets binding */
  ASSETS: Fetcher;

  // KV Namespaces
  /** OAuth tokens and secrets (encrypted) */
  TOKENS: KVNamespace;

  /** Rate limiting counters */
  RATELIMIT: KVNamespace;

  /** App configuration cache */
  CONFIG: KVNamespace;

  /** Browser session cache */
  BROWSER_CACHE: KVNamespace;

  // Durable Objects
  /** Per-listing session state + WebSocket hub */
  LISTING_SESSION: DurableObjectNamespace<ListingSession>;

  /** Global inventory lock singleton */
  INVENTORY_LOCK: DurableObjectNamespace<InventoryLock>;

  // Queue Producers
  /** Platform dispatch queue */
  DISPATCH_QUEUE: Queue<DispatchQueueMessage>;

  /** Media processing queue */
  MEDIA_QUEUE: Queue<MediaQueueMessage>;

  /** Sync check queue */
  SYNC_QUEUE: Queue<SyncQueueMessage>;

  // ============================================================
  // ENVIRONMENT VARIABLES (from .dev.vars / Dashboard)
  // ============================================================

  /** Application secret key for signing tokens */
  APP_SECRET_KEY: string;

  /** Store display name */
  STORE_NAME: string;

  /** R2 key for store logo watermark */
  STORE_LOGO_R2_KEY: string;

  /** Current environment: development | staging | production */
  ENVIRONMENT: 'development' | 'staging' | 'production';

  // Platform Credentials (Optional based on usage)
  
  /** eBay store name for CSV generation */
  EBAY_STORE_NAME?: string;

  /** Shopify shop domain (e.g., yourstore.myshopify.com) */
  SHOPIFY_SHOP_DOMAIN?: string;

  /** Shopify Admin API access token */
  SHOPIFY_ACCESS_TOKEN?: string;

  /** Etsy API keystring */
  ETSY_KEYSTRING?: string;

  /** Etsy shared secret */
  ETSY_SHARED_SECRET?: string;

  /** Facebook/Instagram App ID */
  FACEBOOK_APP_ID?: string;

  /** Facebook/Instagram App Secret */
  FACEBOOK_APP_SECRET?: string;

  /** Pinterest App ID */
  PINTEREST_APP_ID?: string;

  /** Pinterest App Secret */
  PINTEREST_APP_SECRET?: string;

  /** Default marketplace for listings */
  DEFAULT_MARKETPLACE: string;

  /** Default currency code */
  DEFAULT_CURRENCY: string;
}

// ============================================================
// QUEUE MESSAGE TYPES
// ============================================================

export interface DispatchQueueMessage {
  type: 'platform_publish' | 'platform_end' | 'platform_update' | 'csv_generate';
  listingId: string;
  platform: Platform;
  batchId?: string;
  attemptNumber?: number;
}

export interface MediaQueueMessage {
  type: 'image_process' | 'variant_generate' | 'watermark_apply';
  listingId: string;
  assetId: string;
  steps?: ImagePipelineStep[];
  attemptNumber?: number;
}

export interface SyncQueueMessage {
  type: 'sync_check' | 'inventory_sync' | 'verify_listing';
  listingId?: string;
  platform?: Platform;
  attemptNumber?: number;
}

// ============================================================
// DOMAIN TYPES
// ============================================================

export type Platform =
  | 'ebay'
  | 'shopify'
  | 'etsy'
  | 'facebook'
  | 'pinterest'
  | 'whatnot'
  | 'instagram'
  | 'depop'
  | 'mercari'
  | 'poshmark';

export type ListingStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'listed'
  | 'sold'
  | 'ended';

export type PlatformListingStatus =
  | 'pending'
  | 'processing'
  | 'listed'
  | 'sold'
  | 'ended'
  | 'error';

export type ImagePipelineStep =
  | 'upload_to_r2'
  | 'background_removal'
  | 'upscale'
  | 'studio_background'
  | 'watermark'
  | 'resize_platform'
  | 'generate_variants';

export type SkuCategory = 
  | 'RNG'  // Ring
  | 'NKL'  // Necklace
  | 'BRD'  // Bracelet
  | 'ERG'  // Earring
  | 'WTC'  // Watch
  | 'PND'  // Pendant
  | 'SET'  // Set
  | 'OTH'; // Other

export const SKU_CATEGORIES: Record<SkuCategory, string> = {
  RNG: 'Ring',
  NKL: 'Necklace',
  BRD: 'Bracelet',
  ERG: 'Earring',
  WTC: 'Watch',
  PND: 'Pendant',
  SET: 'Set',
  OTH: 'Other',
} as const;

// ============================================================
// DURABLE OBJECT TYPE DECLARATIONS
// ============================================================

/**
 * Per-listing session state managed by Durable Object
 */
export interface ListingSessionState {
  listingId: string;
  status: ListingStatus;
  currentPhase: 1 | 2 | 3 | 4 | 5 | null;
  phaseProgress: Record<number, PhaseProgress>;
  fields: Record<string, unknown>;
  platforms: Record<string, PlatformState>;
  mediaAssets: MediaAssetState[];
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhaseProgress {
  status: 'pending' | 'running' | 'complete' | 'error';
  startedAt?: string;
  completedAt?: string;
  message?: string;
  error?: string;
}

export interface PlatformState {
  enabled: boolean;
  status: PlatformListingStatus;
  externalId?: string;
  externalUrl?: string;
  priceCents?: number;
  lastSync?: string;
  error?: string;
}

export interface MediaAssetState {
  id: string;
  r2Key: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  variants?: Record<string, string>;
}

/**
 * Durable Object class declarations for TypeScript
 */
export abstract class ListingSession {
  abstract fetch(request: Request): Promise<Response>;
  abstract webSocket: WebSocket | null;
}

export abstract class InventoryLock {
  abstract fetch(request: Request): Promise<Response>;
}

// ============================================================
// PLATFORM CONFIGURATION
// ============================================================

export interface PlatformConfig {
  name: string;
  displayName: string;
  hasApi: boolean;
  integrationType: 'api' | 'browser' | 'csv' | 'manual';
  maxImages: number;
  minImagePx: number;
  maxImageMb: number;
  titleMaxLength: number;
  descriptionMaxLength: number;
  requiresAuth: boolean;
  color: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  ebay: {
    name: 'ebay',
    displayName: 'eBay',
    hasApi: true,
    integrationType: 'csv',
    maxImages: 24,
    minImagePx: 500,
    maxImageMb: 12,
    titleMaxLength: 80,
    descriptionMaxLength: 500000,
    requiresAuth: false, // CSV upload doesn't require OAuth
    color: '#E53238',
  },
  shopify: {
    name: 'shopify',
    displayName: 'Shopify',
    hasApi: true,
    integrationType: 'api',
    maxImages: 250,
    minImagePx: 800,
    maxImageMb: 20,
    titleMaxLength: 255,
    descriptionMaxLength: 50000,
    requiresAuth: true,
    color: '#96BF48',
  },
  etsy: {
    name: 'etsy',
    displayName: 'Etsy',
    hasApi: true,
    integrationType: 'api',
    maxImages: 10,
    minImagePx: 570,
    maxImageMb: 20,
    titleMaxLength: 140,
    descriptionMaxLength: 25000,
    requiresAuth: true,
    color: '#F1641E',
  },
  facebook: {
    name: 'facebook',
    displayName: 'Facebook Marketplace',
    hasApi: true,
    integrationType: 'api',
    maxImages: 10,
    minImagePx: 720,
    maxImageMb: 8,
    titleMaxLength: 100,
    descriptionMaxLength: 5000,
    requiresAuth: true,
    color: '#1877F2',
  },
  pinterest: {
    name: 'pinterest',
    displayName: 'Pinterest',
    hasApi: true,
    integrationType: 'api',
    maxImages: 10,
    minImagePx: 500,
    maxImageMb: 32,
    titleMaxLength: 100,
    descriptionMaxLength: 800,
    requiresAuth: true,
    color: '#E60023',
  },
  whatnot: {
    name: 'whatnot',
    displayName: 'Whatnot',
    hasApi: false,
    integrationType: 'browser',
    maxImages: 12,
    minImagePx: 500,
    maxImageMb: 10,
    titleMaxLength: 100,
    descriptionMaxLength: 5000,
    requiresAuth: true,
    color: '#FF6B35',
  },
  instagram: {
    name: 'instagram',
    displayName: 'Instagram Shop',
    hasApi: false,
    integrationType: 'browser',
    maxImages: 10,
    minImagePx: 500,
    maxImageMb: 8,
    titleMaxLength: 150,
    descriptionMaxLength: 2200,
    requiresAuth: true,
    color: '#E4405F',
  },
  depop: {
    name: 'depop',
    displayName: 'Depop',
    hasApi: false,
    integrationType: 'browser',
    maxImages: 10,
    minImagePx: 500,
    maxImageMb: 10,
    titleMaxLength: 50,
    descriptionMaxLength: 1000,
    requiresAuth: true,
    color: '#FF2300',
  },
  mercari: {
    name: 'mercari',
    displayName: 'Mercari',
    hasApi: false,
    integrationType: 'browser',
    maxImages: 12,
    minImagePx: 500,
    maxImageMb: 10,
    titleMaxLength: 40,
    descriptionMaxLength: 1000,
    requiresAuth: true,
    color: '#00A0E9',
  },
  poshmark: {
    name: 'poshmark',
    displayName: 'Poshmark',
    hasApi: false,
    integrationType: 'browser',
    maxImages: 16,
    minImagePx: 500,
    maxImageMb: 10,
    titleMaxLength: 50,
    descriptionMaxLength: 1000,
    requiresAuth: true,
    color: '#7B2FBE',
  },
};
