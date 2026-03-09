-- Migration: Create social_content table
-- Purpose: Store generated content for social platforms (TikTok, Pinterest, etc.)

CREATE TABLE IF NOT EXISTS social_content (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,           -- JSON string of platform-specific content
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_content_listing_platform 
ON social_content(listing_id, platform);
