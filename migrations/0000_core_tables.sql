-- Core tables for Listing Factory
-- Source: VIBE_SDK_EBAY_BROWSER_SYSTEM_PROMPT.md

-- Master listing record
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,              -- UUID
  sku TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT,
  description TEXT,
  category_id TEXT,
  condition_grade TEXT,
  brand TEXT,
  model TEXT,
  price_suggested REAL,
  price_final REAL,
  quantity INTEGER DEFAULT 1,
  platforms TEXT,                   -- JSON string array
  html_description TEXT,
  raw_input TEXT,                   -- original text input
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  sold_at TEXT
);

-- All listing fields (flexible key-value)
CREATE TABLE IF NOT EXISTS listing_fields (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  ai_suggested INTEGER DEFAULT 0,   -- Boolean 0/1
  confidence REAL,
  created_at TEXT NOT NULL,
  UNIQUE(listing_id, key)
);

-- Media assets (R2 references)
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL,             -- pending | processed | error
  public_url TEXT,
  created_at TEXT NOT NULL
);

-- CSV Exports tracking
CREATE TABLE IF NOT EXISTS csv_exports (
  id TEXT PRIMARY KEY,
  listing_count INTEGER NOT NULL,
  r2_key TEXT,
  status TEXT NOT NULL,             -- pending | completed | error
  error_message TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

-- Upload Jobs (Browser Automation tracking)
CREATE TABLE IF NOT EXISTS upload_jobs (
  id TEXT PRIMARY KEY,
  export_id TEXT NOT NULL REFERENCES csv_exports(id) ON DELETE CASCADE,
  status TEXT NOT NULL,             -- pending | launching | uploading | done | error
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_messages TEXT,              -- JSON string array
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

-- Dispatch Log (audit trail for all publishing actions)
CREATE TABLE IF NOT EXISTS dispatch_log (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  action TEXT NOT NULL,             -- publish | end | sync | tiktok_generation | etc
  platform TEXT,                    -- ebay | shopify | tiktok | etc
  status TEXT NOT NULL,             -- success | error | queued
  details TEXT,                     -- JSON details
  created_at TEXT NOT NULL
);
