-- ============================================================
-- CASPERS JEWELRY — Multi-Platform Listing Database
-- D1 SQLite Schema (Complete, No Migrations at Launch)
-- ============================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================================
-- MASTER LISTING TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,                    -- UUID v4
  sku TEXT UNIQUE NOT NULL,               -- CJP-RNG-2603-0001
  status TEXT NOT NULL DEFAULT 'draft',   -- draft|processing|ready|listed|sold|ended
  title TEXT,                             -- Master title
  category TEXT,                          -- Detected category code (RNG, NKL, BRD, ERG, WTC, PND, SET, OTH)
  category_name TEXT,                     -- Human-readable category (Ring, Necklace, etc.)
  condition_id INTEGER,                   -- eBay condition ID (1000=new, 3000=used, etc.)
  condition_name TEXT,                    -- Human-readable condition
  price_cents INTEGER,                    -- Suggested base price in cents
  brand TEXT,                             -- Detected or entered brand
  model TEXT,                             -- Model number or name
  material TEXT,                          -- Primary material (gold, silver, etc.)
  color TEXT,                             -- Primary color
  size TEXT,                              -- Size string (7, 18mm, etc.)
  weight_grams REAL,                      -- Weight in grams
  notes TEXT,                             -- Internal notes
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  listed_at TEXT,
  sold_at TEXT,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_sku ON listings(sku);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_brand ON listings(brand);

-- ============================================================
-- PLATFORM-SPECIFIC LISTING DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_platforms (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                 -- ebay|shopify|etsy|facebook|pinterest|whatnot|instagram|depop|mercari|poshmark
  external_id TEXT,                       -- Platform's listing ID
  external_url TEXT,                      -- Live listing URL
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|listed|sold|ended|error
  price_cents INTEGER,                    -- Platform-specific price
  quantity INTEGER DEFAULT 1,
  listed_at TEXT,
  ended_at TEXT,
  last_sync_at TEXT,
  sync_error TEXT,
  sync_attempts INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_lp_listing ON listing_platforms(listing_id);
CREATE INDEX IF NOT EXISTS idx_lp_platform_status ON listing_platforms(platform, status);
CREATE INDEX IF NOT EXISTS idx_lp_external ON listing_platforms(platform, external_id);

-- ============================================================
-- LISTING FIELDS (EAV Pattern for Flexibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_fields (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                 -- Platform code or 'master' for shared fields
  field_name TEXT NOT NULL,               -- Field identifier (title, description, brand, etc.)
  field_value TEXT NOT NULL,              -- JSON-encoded value
  field_type TEXT DEFAULT 'string',       -- string|number|boolean|array|object
  ai_generated INTEGER DEFAULT 0,         -- 1 if AI suggested
  confidence REAL,                        -- 0.0-1.0 if AI generated
  source TEXT DEFAULT 'user',             -- user|ai|import|platform
  validated INTEGER DEFAULT 0,            -- 1 if passed validation
  validation_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, platform, field_name)
);

CREATE INDEX IF NOT EXISTS idx_lf_listing ON listing_fields(listing_id);
CREATE INDEX IF NOT EXISTS idx_lf_platform ON listing_fields(platform);
CREATE INDEX IF NOT EXISTS idx_lf_ai ON listing_fields(ai_generated);

-- ============================================================
-- MEDIA ASSETS (Images/Videos)
-- ============================================================

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,                   -- R2 object key (original)
  original_filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  is_primary INTEGER DEFAULT 0,           -- 1 if primary/featured image
  display_order INTEGER DEFAULT 0,        -- Sort order
  processing_status TEXT DEFAULT 'pending', -- pending|processing|ready|error
  processing_steps TEXT,                  -- JSON array of completed steps
  processing_error TEXT,
  variants TEXT,                          -- JSON: { "ebay_1600": "key", "thumbnail": "key", ... }
  platform_assignments TEXT,              -- JSON: { "ebay": [0,1,2], "shopify": [0,1] }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ma_listing ON media_assets(listing_id);
CREATE INDEX IF NOT EXISTS idx_ma_status ON media_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_ma_primary ON media_assets(listing_id, is_primary);

-- ============================================================
-- SKU REGISTRY (Global Dedup + Collision Detection)
-- ============================================================

CREATE TABLE IF NOT EXISTS sku_registry (
  sku TEXT PRIMARY KEY,
  sku_prefix TEXT NOT NULL,               -- CJP-RNG-2603
  category TEXT NOT NULL,                 -- RNG|NKL|BRD|ERG|WTC|PND|SET|OTH
  date_code TEXT NOT NULL,                -- YYMM (2603 = March 2026)
  sequence INTEGER NOT NULL,              -- Daily sequence (0001-9999)
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sku_prefix ON sku_registry(sku_prefix);
CREATE INDEX IF NOT EXISTS idx_sku_date ON sku_registry(date_code);
CREATE INDEX IF NOT EXISTS idx_sku_category_date ON sku_registry(category, date_code);

-- ============================================================
-- DISPATCH LOG (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatch_log (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,                   -- publish|update|end|relist|sync|csv_generate
  request_payload TEXT,                   -- JSON request body
  response_payload TEXT,                  -- JSON response
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|success|error|dead_letter
  error_message TEXT,
  error_code TEXT,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dl_listing ON dispatch_log(listing_id);
CREATE INDEX IF NOT EXISTS idx_dl_status ON dispatch_log(status);
CREATE INDEX IF NOT EXISTS idx_dl_platform ON dispatch_log(platform, status);
CREATE INDEX IF NOT EXISTS idx_dl_retry ON dispatch_log(status, next_retry_at) WHERE status IN ('pending', 'error');
CREATE INDEX IF NOT EXISTS idx_dl_created ON dispatch_log(created_at DESC);

-- ============================================================
-- PLATFORM CREDENTIALS (Metadata Only — Tokens in KV)
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_credentials (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  connected INTEGER DEFAULT 0,            -- 1 if currently connected
  account_name TEXT,                      -- Display name for the connected account
  account_id TEXT,                        -- Platform's user/shop ID
  connected_at TEXT,
  expires_at TEXT,                        -- Token expiration (if applicable)
  token_status TEXT DEFAULT 'valid',      -- valid|expired|revoked|error
  metadata TEXT,                          -- JSON: additional platform-specific data
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pc_platform ON platform_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_pc_connected ON platform_credentials(connected);

-- ============================================================
-- CSV BATCHES (eBay Bulk Upload)
-- ============================================================

CREATE TABLE IF NOT EXISTS csv_batches (
  id TEXT PRIMARY KEY,
  name TEXT,                              -- Optional batch name
  status TEXT NOT NULL DEFAULT 'pending', -- pending|generating|ready|uploaded|processing|completed|partial|error
  listing_count INTEGER NOT NULL DEFAULT 0,
  listings TEXT,                          -- JSON array of listing IDs in batch
  r2_key TEXT,                            -- Path to CSV in R2
  download_url TEXT,                      -- Signed URL for download (expires)
  download_expires_at TEXT,
  ebay_batch_id TEXT,                     -- File Exchange batch ID
  ebay_response TEXT,                     -- JSON response from upload
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_details TEXT,                     -- JSON: row-level errors
  created_by TEXT,                        -- User or 'system'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_csv_status ON csv_batches(status);
CREATE INDEX IF NOT EXISTS idx_csv_created ON csv_batches(created_at DESC);

-- ============================================================
-- BROWSER SESSIONS (Rendering Cache)
-- ============================================================

CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,                   -- preview|test|scrape|publish
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|error|timeout
  session_id TEXT,                        -- Browser session ID
  url TEXT,                               -- URL being rendered
  screenshot_r2_key TEXT,                 -- Screenshot stored in R2
  html_r2_key TEXT,                       -- HTML snapshot stored in R2
  extracted_data TEXT,                    -- JSON: data extracted from page
  warnings TEXT,                          -- JSON: array of warnings found
  errors TEXT,                            -- JSON: array of errors found
  error_message TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bs_listing ON browser_sessions(listing_id);
CREATE INDEX IF NOT EXISTS idx_bs_platform ON browser_sessions(platform, status);
CREATE INDEX IF NOT EXISTS idx_bs_status ON browser_sessions(status);

-- ============================================================
-- SYNC QUEUE (Cross-Platform Sync)
-- ============================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,                   -- sync_status|check_sold|update_inventory|verify_listing
  priority INTEGER DEFAULT 0,             -- Higher = more urgent
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|completed|error
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_listing ON sync_queue(listing_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status, priority DESC);

-- ============================================================
-- WEBHOOK LOG (Incoming Platform Events)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_log (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- order.created|listing.sold|listing.ended|etc
  external_id TEXT,                       -- Platform's event/order/listing ID
  payload TEXT,                           -- Full webhook payload (JSON)
  signature TEXT,                         -- Webhook signature for verification
  verified INTEGER DEFAULT 0,             -- 1 if signature verified
  processed INTEGER DEFAULT 0,            -- 1 if handler completed
  processing_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_platform ON webhook_log(platform, event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_external ON webhook_log(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_webhook_unprocessed ON webhook_log(processed) WHERE processed = 0;

-- ============================================================
-- SETTINGS (App Configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                    -- JSON-encoded value
  category TEXT,                          -- shipping|payment|return|defaults
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- ============================================================
-- DEFAULT SETTINGS DATA
-- ============================================================

INSERT INTO settings (key, value, category, description) VALUES
  ('store_name', '"Caspers Jewelry"', 'general', 'Store display name'),
  ('default_currency', '"USD"', 'general', 'Default currency code'),
  ('default_marketplace', '"EBAY_US"', 'ebay', 'Default eBay marketplace'),
  ('default_dispatch_days', '2', 'shipping', 'Default dispatch time in days'),
  ('default_return_days', '30', 'return', 'Default return window in days'),
  ('auto_end_on_sold', 'true', 'sync', 'Automatically end listings on other platforms when sold'),
  ('ai_confidence_threshold', '0.7', 'ai', 'Minimum confidence to auto-accept AI suggestions');

-- ============================================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================================

CREATE TRIGGER IF NOT EXISTS update_listings_timestamp 
AFTER UPDATE ON listings
BEGIN
  UPDATE listings SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_listing_platforms_timestamp 
AFTER UPDATE ON listing_platforms
BEGIN
  UPDATE listing_platforms SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_listing_fields_timestamp 
AFTER UPDATE ON listing_fields
BEGIN
  UPDATE listing_fields SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_media_assets_timestamp 
AFTER UPDATE ON media_assets
BEGIN
  UPDATE media_assets SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_platform_credentials_timestamp 
AFTER UPDATE ON platform_credentials
BEGIN
  UPDATE platform_credentials SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_csv_batches_timestamp 
AFTER UPDATE ON csv_batches
BEGIN
  UPDATE csv_batches SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_settings_timestamp 
AFTER UPDATE ON settings
BEGIN
  UPDATE settings SET updated_at = datetime('now') WHERE key = NEW.key;
END;

-- ============================================================
-- VIEWS (Common Queries)
-- ============================================================

-- Active listings with platform status
CREATE VIEW IF NOT EXISTS v_active_listings AS
SELECT 
  l.id,
  l.sku,
  l.title,
  l.category,
  l.category_name,
  l.brand,
  l.price_cents,
  l.status,
  l.created_at,
  GROUP_CONCAT(DISTINCT lp.platform) as platforms,
  COUNT(DISTINCT lp.id) as platform_count,
  SUM(CASE WHEN lp.status = 'listed' THEN 1 ELSE 0 END) as listed_count
FROM listings l
LEFT JOIN listing_platforms lp ON l.id = lp.listing_id
WHERE l.status IN ('ready', 'listed')
GROUP BY l.id
ORDER BY l.created_at DESC;

-- Platform sync status overview
CREATE VIEW IF NOT EXISTS v_platform_sync_status AS
SELECT 
  platform,
  COUNT(*) as total_listings,
  SUM(CASE WHEN status = 'listed' THEN 1 ELSE 0 END) as active_listings,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_listings,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_listings,
  MAX(updated_at) as last_sync
FROM listing_platforms
GROUP BY platform;

-- Recent dispatch activity
CREATE VIEW IF NOT EXISTS v_recent_dispatches AS
SELECT 
  dl.id,
  dl.listing_id,
  l.sku,
  dl.platform,
  dl.action,
  dl.status,
  dl.error_message,
  dl.created_at,
  dl.completed_at
FROM dispatch_log dl
LEFT JOIN listings l ON dl.listing_id = l.id
ORDER BY dl.created_at DESC
LIMIT 100;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
