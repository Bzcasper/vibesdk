# CASPERS JEWELRY — Multi-Platform Listing Conversion System
## Phase 1 Blueprint

**Generated:** 2026-03-07
**Target Stack:** Cloudflare Workers + Durable Objects + D1 + R2 + Browser Rendering

---

## 1. ARCHITECTURE DECISION RECORD (ADR)

### 1.1 Runtime: Cloudflare Workers (Edge-Native)

**Decision:** All backend logic runs on Cloudflare Workers with zero Node.js dependencies.

**Rationale:**
- Sub-50ms cold starts for listing generation
- Global edge distribution for seller in any timezone
- Native integration with Browser Rendering, AI, Queues, D1, R2, KV
- No server management, auto-scaling to handle bulk import bursts

**Constraints:**
- No filesystem access (use R2 for all file storage)
- No long-running processes (use Durable Objects + Queues for pipelines)
- CPU limit 10ms per request (use async patterns for AI calls)

---

### 1.2 State Management: Durable Objects

**Decision:** Two Durable Objects manage all stateful operations.

| DO | Purpose | Why DO (not KV) |
|----|---------|-----------------|
| `ListingSession` | Per-listing pipeline state, WebSocket hub, build lock | Atomic state updates, real-time push, single-writer guarantee |
| `InventoryLock` | Global sold/available registry, cross-platform sync | Singleton pattern, atomic sell-lock, idempotent webhooks |

**Alternative Rejected:** KV for session state
- KV is eventually consistent — race conditions on simultaneous platform dispatches
- No WebSocket support — would need external service for live UI updates
- No atomic compare-and-swap for inventory locking

---

### 1.3 Database: D1 SQLite

**Decision:** D1 for all structured data (listings, sync log, SKU registry, credentials metadata).

**Schema Design Principles:**
- **No migrations at launch** — complete schema in `schema.sql`
- **EAV pattern for platform fields** — `listing_fields` table stores arbitrary key-value pairs per platform
- **Full audit trail** — every API call logged to `dispatch_log`

**Tables:**
```
listings              — Master record (UUID, SKU, status, timestamps)
listing_platforms     — Per-platform listing data (external_id, url, status)
listing_fields        — EAV store for all platform-specific fields
media_assets          — R2-linked image/video records
sku_registry          — Global SKU dedup with collision detection
dispatch_log          — Full audit trail of all platform operations
platform_credentials  — OAuth metadata (tokens stored in KV)
csv_batches           — eBay CSV batch upload tracking
browser_sessions      — Browser Rendering session cache
```

---

### 1.4 Storage: R2 Buckets

**Decision:** Two R2 buckets for all file storage.

| Bucket | Contents | Retention |
|--------|----------|-----------|
| `media-prod` | Original + processed images, generated CSVs | Permanent |
| `media-dev` | Same structure for development | 7 days auto-expire |

**Object Key Pattern:**
```
listings/{listing_id}/original/{filename}
listings/{listing_id}/processed/{step}_{filename}
listings/{listing_id}/variants/{platform}_{size}_{filename}
csv-batches/{batch_id}/ebay_upload.csv
watermark/store_logo.png
```

---

### 1.5 AI: Workers AI (On-Edge)

**Decision:** All AI operations use Workers AI models running on Cloudflare's edge.

**Model Allocation:**

| Task | Model | Why |
|------|-------|-----|
| Classification, Extraction, Completion | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Fast, accurate, structured output |
| Background Removal | `@cf/bria-ai/rmbg-1.4` | Purpose-built, no hallucination |
| Image Upscaling | `@cf/aiml-api/upscaler` | 4x upscaling for low-res inputs |
| Studio Background | `@cf/bytedance/stable-diffusion-xl-lightning` | Fast diffusion for product shots |
| Image Description | `@cf/llava-h/llava-1.5-7b-hf` | Vision model for photo-to-listing |

**Fallback Strategy:**
- If Workers AI rate-limited, queue retry with 30s delay
- Never block listing creation — AI enrichment can be re-triggered

---

### 1.6 Browser Rendering: eBay Listing Preview & Testing

**Decision:** Use Cloudflare Browser Rendering API to:
1. Navigate to eBay listing preview page
2. Capture screenshots for listing verification
3. Check for eBay policy warnings/errors
4. Verify mobile/desktop rendering

**Why Browser Rendering (not API):**
- eBay Trading/Inventory API requires business verification
- CSV upload is more reliable for bulk operations
- Visual verification catches listing errors API wouldn't reveal
- Free listing previews via browser (no API fees)

**Implementation:**
```typescript
// worker/browser/ebay-preview.ts
async function previewEbayListing(listingId: string, env: Env): Promise<PreviewResult> {
  const browser = await env.BROWSER.connect()
  const page = await browser.newPage()
  
  // Navigate to eBay sell form with pre-filled data
  await page.goto(`https://bulksell.ebay.com/ws/eBayISAPI.dll?SingleList&...`)
  
  // Fill form via DOM manipulation
  // Capture screenshot
  // Check for error messages
  // Return preview + issues
}
```

---

### 1.7 CSV Generation for eBay Bulk Upload

**Decision:** Generate eBay File Exchange CSV for bulk listing uploads.

**CSV Fields (required by eBay File Exchange):**
```
*Action(SiteID=US|Country=US|Currency=USD|Version=1193)
*Title
*Format
*Duration
*StartPrice
*BuyItNowPrice
*Quantity
*ConditionID
*Category
*PictureURL
*Description
*PayPalEmailAddress
*Location
*DispatchTimeMax
*ReturnPolicy
*ShippingType
*ShippingServiceCost
...
```

**Workflow:**
1. Generate CSV from enriched listing data
2. Store in R2: `csv-batches/{batch_id}/ebay_upload.csv`
3. Provide download link + step-by-step upload instructions
4. Browser Rendering can auto-navigate to File Exchange upload page

---

### 1.8 Platform Strategy: API vs Browser vs Manual

| Platform | Method | Rationale |
|----------|--------|-----------|
| **eBay** | CSV + Browser Rendering | No API verification needed, bulk-friendly, visual verification |
| **Shopify** | Admin REST API | Official API, straightforward |
| **Etsy** | Open API v3 | Official API, requires listing review for new sellers |
| **Facebook Marketplace** | Graph API | Requires Page connection |
| **Pinterest** | API v5 | Official API, requires Pinterest Business account |
| **Whatnot** | Browser Automation | No official API, unofficial scraping |
| **Instagram** | Browser Automation | No official listing API, requires Meta Business Suite |
| **Depop** | Browser Automation | No official API |
| **Mercari** | Browser Automation | No official API |
| **Poshmark** | Browser Automation | No official API |

**Browser Automation Platforms:**
- Use Browser Rendering for Whatnot, Instagram, Depop, Mercari, Poshmark
- Navigate to listing form, pre-fill fields, capture screenshot for manual verification
- Mark as "semi-automated" in UI — seller reviews before final submit

---

### 1.9 Queue System: Cloudflare Queues

**Decision:** All async operations go through Queues for retry isolation.

**Queue Types:**

| Queue | Message Types | Retry Policy |
|-------|---------------|--------------|
| `dispatch-queue` | platform_publish, platform_end, csv_generate | Exponential: 2s → 32s, max 5 attempts |
| `media-queue` | image_process, variant_generate | Linear: 5s, max 3 attempts |
| `sync-queue` | sync_check, inventory_sync | Linear: 30s, max 3 attempts |

**Dead Letter Handling:**
- All failed messages after max retries → D1 `dispatch_log` with status `dead_letter`
- Alert badge in dashboard
- Manual retry button per failed operation

---

### 1.10 Real-Time Updates: WebSockets via Durable Objects

**Decision:** `ListingSession` Durable Object hosts WebSocket connections for live pipeline progress.

**Architecture:**
```
Frontend (multiple tabs) ←→ WebSocket ←→ ListingSession DO ←→ AI Pipeline
```

**Message Types:**
```typescript
type WSMessage =
  | { type: 'phase_start'; phase: number; name: string }
  | { type: 'phase_progress'; phase: number; progress: number; message: string }
  | { type: 'field_generated'; field: string; value: unknown; confidence?: number }
  | { type: 'phase_complete'; phase: number; result: object }
  | { type: 'error'; phase: number; error: string; recoverable: boolean }
  | { type: 'listing_ready'; listingId: string }
```

---

### 1.11 SKU System Design

**Decision:** Hierarchical SKU format encoding category, date, and sequence.

**Format:** `CJP-{CATEGORY}-{DATE}-{SEQ}`

| Component | Pattern | Example |
|-----------|---------|---------|
| Prefix | `CJP` (Caspers Jewelry Product) | `CJP` |
| Category | 3-letter code | `RNG` (Ring), `NKL` (Necklace), `BRD` (Bracelet) |
| Date | YYMM | `2603` (March 2026) |
| Sequence | 4-digit daily sequence | `0001`, `0002` |

**Full SKU Examples:**
```
CJP-RNG-2603-0001  — Ring listed March 2026, 1st of day
CJP-NKL-2603-0042  — Necklace listed March 2026, 42nd of day
CJP-BRD-2603-0128  — Bracelet listed March 2026, 128th of day
CJP-ERG-2603-0007  — Earring listed March 2026, 7th of day
CJP-WTC-2603-0003  — Watch listed March 2026, 3rd of day
CJP-PND-2603-0021  — Pendant listed March 2026, 21st of day
CJP-SET-2603-0002  — Set/Jewelry Bundle, March 2026, 2nd of day
CJP-OTH-2603-0015  — Other/Accessories, March 2026, 15th of day
```

**Category Codes:**
```typescript
const SKU_CATEGORIES = {
  RNG: 'Ring',
  NKL: 'Necklace',
  BRD: 'Bracelet',
  ERG: 'Earring',
  WTC: 'Watch',
  PND: 'Pendant',
  SET: 'Set',
  OTH: 'Other'
} as const
```

**Generation Logic:**
```typescript
async function generateSku(
  category: keyof typeof SKU_CATEGORIES,
  env: Env
): Promise<string> {
  const now = new Date()
  const dateCode = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `CJP-${category}-${dateCode}`
  
  // Query D1 for max sequence today for this category
  const result = await env.DB.prepare(`
    SELECT MAX(sequence) as max_seq 
    FROM sku_registry 
    WHERE sku_prefix = ?
  `).bind(prefix).first()
  
  const nextSeq = (result?.max_seq ?? 0) + 1
  const sku = `${prefix}-${String(nextSeq).padStart(4, '0')}`
  
  // Insert into registry
  await env.DB.prepare(`
    INSERT INTO sku_registry (sku, category, date_code, sequence, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(sku, category, dateCode, nextSeq, now.toISOString()).run()
  
  return sku
}
```

**Collision Prevention:**
- D1 unique constraint on `sku` column
- Atomic insert (no race condition)
- Daily sequence reset per category

---

### 1.12 Frontend Architecture: React SPA Served from Worker

**Decision:** Single deployment unit — Worker serves both API and SPA.

**Why (not Cloudflare Pages):**
- Shared authentication context between API and UI
- Single deployment (`wrangler deploy` handles both)
- Server-side rendering option for SEO (future)

**Tech Stack:**
- React 18 with Suspense
- React Router v6 (file-based routing via Vite plugin)
- Tailwind CSS v4 (utility classes only)
- shadcn/ui components
- lucide-react icons
- WebSocket for real-time updates

---

## 2. COMPLETE FILE TREE

```
/
├── Blueprint.md                           # This file
├── wrangler.toml                          # Cloudflare config
├── package.json                           # Dependencies
├── tsconfig.json                          # TypeScript config
├── vite.config.ts                         # Frontend build
├── .dev.vars.example                      # Environment template
├── .dev.vars                              # Local secrets (gitignored)
│
├── worker/
│   ├── index.ts                           # Hono app entry, DO exports, route registration
│   ├── env.ts                             # Env interface + type declarations
│   │
│   ├── agents/
│   │   ├── inferutils/
│   │   │   ├── config.ts                  # System prompts, AI configuration
│   │   │   ├── phases.ts                  # Phase orchestrator
│   │   │   └── models.ts                  # Workers AI model registry
│   │   │
│   │   ├── listing/
│   │   │   ├── ingest.ts                  # Raw input normalization (text, CSV, URL, photo)
│   │   │   ├── classifier.ts              # Category detection + platform targeting
│   │   │   ├── enricher.ts                # AI field extraction + completion
│   │   │   ├── copywriter.ts              # Platform-specific title/description generation
│   │   │   ├── sku.ts                     # SKU generation logic
│   │   │   └── validator.ts               # Platform schema validation
│   │   │
│   │   └── media/
│   │       ├── processor.ts               # Image pipeline orchestrator
│   │       ├── rmbg.ts                    # Background removal
│   │       ├── upscale.ts                 # Image upscaling
│   │       ├── background.ts              # Studio background generation
│   │       ├── watermark.ts               # Logo overlay
│   │       └── r2.ts                      # R2 upload/retrieve helpers
│   │
│   ├── durable-objects/
│   │   ├── ListingSession.ts              # Per-listing state + WebSocket hub
│   │   └── InventoryLock.ts               # Cross-platform OOAK enforcement
│   │
│   ├── db/
│   │   ├── schema.sql                     # Complete D1 schema
│   │   ├── listings.ts                    # Listing CRUD queries
│   │   ├── platforms.ts                   # Platform listing queries
│   │   ├── sync.ts                        # Sync log queries
│   │   ├── sku.ts                         # SKU registry queries
│   │   └── migrations/                    # Future migrations (empty at launch)
│   │
│   ├── platforms/
│   │   ├── ebay/
│   │   │   ├── csv-generator.ts           # File Exchange CSV generation
│   │   │   ├── categories.ts              # Category ID lookup + suggestion
│   │   │   ├── conditions.ts              # Condition ID mapping
│   │   │   ├── preview.ts                 # Browser Rendering preview
│   │   │   ├── types.ts                   # eBay-specific types
│   │   │   └── policies.ts                # Default policy templates
│   │   │
│   │   ├── shopify/
│   │   │   ├── auth.ts                    # OAuth + token management
│   │   │   ├── products.ts                # Product CRUD
│   │   │   ├── inventory.ts               # Inventory sync
│   │   │   └── types.ts
│   │   │
│   │   ├── etsy/
│   │   │   ├── auth.ts
│   │   │   ├── listings.ts
│   │   │   ├── categories.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── facebook/
│   │   │   ├── auth.ts
│   │   │   ├── marketplace.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── pinterest/
│   │   │   ├── auth.ts
│   │   │   ├── pins.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── whatnot/
│   │   │   ├── browser.ts                 # Browser Rendering automation
│   │   │   └── types.ts
│   │   │
│   │   ├── instagram/
│   │   │   ├── browser.ts                 # Meta Business Suite via Browser Rendering
│   │   │   └── types.ts
│   │   │
│   │   ├── depop/
│   │   │   ├── browser.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── mercari/
│   │   │   ├── browser.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── poshmark/
│   │   │   ├── browser.ts
│   │   │   └── types.ts
│   │   │
│   │   └── shared/
│   │       ├── browser-base.ts            # Shared browser rendering utilities
│   │       ├── types.ts                   # Shared platform types
│   │       └── errors.ts                  # Platform error classes
│   │
│   ├── browser/
│   │   ├── client.ts                      # Browser Rendering API client
│   │   ├── screenshot.ts                  # Screenshot capture utilities
│   │   ├── navigation.ts                  # Page navigation helpers
│   │   └── session-manager.ts             # Session pooling + caching
│   │
│   ├── queues/
│   │   ├── dispatch.ts                    # Platform dispatch consumer
│   │   ├── media.ts                       # Image processing consumer
│   │   ├── sync.ts                        # Sync check consumer
│   │   └── retry.ts                       # Retry + dead letter logic
│   │
│   ├── middleware/
│   │   ├── auth.ts                        # API key + session auth
│   │   ├── ratelimit.ts                   # Per-platform rate limiting (KV)
│   │   └── errorHandler.ts                # Global error handler
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── listings.ts                # /api/listings/*
│   │   │   ├── media.ts                   # /api/media/*
│   │   │   ├── platforms.ts               # /api/platforms/*
│   │   │   ├── dispatch.ts                # /api/dispatch/*
│   │   │   ├── csv.ts                     # /api/csv/*
│   │   │   ├── session.ts                 # /api/session/*
│   │   │   └── health.ts                  # /api/health
│   │   │
│   │   └── controllers/
│   │       ├── ListingController.ts
│   │       ├── MediaController.ts
│   │       ├── PlatformController.ts
│   │       ├── DispatchController.ts
│   │       └── CsvController.ts
│   │
│   └── utils/
│       ├── crypto.ts                      # Encryption helpers
│       ├── validation.ts                  # Shared Zod schemas
│       ├── formatting.ts                  # Price, date, string formatters
│       └── logger.ts                      # Structured logging
│
├── frontend/
│   ├── index.html                         # Entry HTML
│   ├── main.tsx                           # React entry
│   │
│   ├── app/
│   │   ├── root.tsx                       # Root layout + providers
│   │   ├── routes/
│   │   │   ├── index.tsx                  # Dashboard redirect
│   │   │   ├── dashboard.tsx              # Main dashboard
│   │   │   ├── new-listing.tsx            # Primary intake form
│   │   │   ├── listing.$id.tsx            # Listing detail + editor
│   │   │   ├── inventory.tsx              # Full inventory table
│   │   │   ├── csv-batches.tsx            # eBay CSV batch manager
│   │   │   ├── platforms.tsx              # Platform connection manager
│   │   │   └── settings.tsx               # API keys, defaults
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx          # Main layout wrapper
│   │   │   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   │   │   ├── Header.tsx             # Top bar with stats
│   │   │   │   └── Footer.tsx
│   │   │   │
│   │   │   ├── listing/
│   │   │   │   ├── IntakeForm.tsx         # Raw input form
│   │   │   │   ├── StructuredForm.tsx     # Toggle to structured mode
│   │   │   │   ├── ImageDropzone.tsx      # Multi-image upload
│   │   │   │   ├── PlatformSelector.tsx   # Platform checkboxes
│   │   │   │   ├── PipelineProgress.tsx   # WebSocket-driven progress
│   │   │   │   ├── ListingPreview.tsx     # Tabbed preview per platform
│   │   │   │   ├── FieldEditor.tsx        # Inline field editing
│   │   │   │   ├── MediaStudio.tsx        # Image grid + processing UI
│   │   │   │   ├── DispatchPanel.tsx      # Platform publish controls
│   │   │   │   ├── PlatformDiff.tsx       # Cross-platform diff view
│   │   │   │   └── AIConfidenceBadge.tsx  # Confidence indicator
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── InventoryTable.tsx     # Full inventory grid
│   │   │   │   ├── InventoryRow.tsx
│   │   │   │   ├── SyncStatusBadge.tsx
│   │   │   │   ├── BulkActionBar.tsx
│   │   │   │   └── Filters.tsx
│   │   │   │
│   │   │   ├── csv/
│   │   │   │   ├── BatchList.tsx          # CSV batch history
│   │   │   │   ├── BatchDetail.tsx        # Single batch view
│   │   │   │   ├── CsvPreview.tsx         # CSV table preview
│   │   │   │   └── UploadInstructions.tsx  # Step-by-step guide
│   │   │   │
│   │   │   ├── platforms/
│   │   │   │   ├── ConnectionCard.tsx     # Per-platform status card
│   │   │   │   ├── OAuthButton.tsx
│   │   │   │   └── ConnectionStatus.tsx
│   │   │   │
│   │   │   └── shared/
│   │   │       ├── PlatformLogo.tsx       # SVG logos for all 10 platforms
│   │   │       ├── ConditionBadge.tsx
│   │   │       ├── PriceInput.tsx
│   │   │       ├── CharacterCount.tsx
│   │   │       ├── ErrorBoundary.tsx
│   │   │       ├── LoadingState.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       └── ConfirmDialog.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useListingSession.ts       # WebSocket to ListingSession DO
│   │   │   ├── usePlatformSync.ts
│   │   │   ├── useInventoryLock.ts
│   │   │   ├── useCsvBatch.ts
│   │   │   └── useMediaUpload.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                     # Typed fetch client
│   │   │   ├── ws.ts                      # WebSocket client
│   │   │   ├── schemas.ts                 # Shared Zod schemas
│   │   │   ├── constants.ts               # Platform configs, limits
│   │   │   └── formatters.ts              # Price, date formatters
│   │   │
│   │   └── styles/
│   │       └── globals.css                # Tailwind imports + CSS vars
│   │
│   └── public/
│       ├── favicon.ico
│       └── platforms/                     # Platform logo SVGs
│           ├── ebay.svg
│           ├── shopify.svg
│           ├── etsy.svg
│           ├── facebook.svg
│           ├── pinterest.svg
│           ├── whatnot.svg
│           ├── instagram.svg
│           ├── depop.svg
│           ├── mercari.svg
│           └── poshmark.svg
│
└── tests/
    ├── unit/
    │   ├── sku.test.ts
    │   ├── classifier.test.ts
    │   ├── csv-generator.test.ts
    │   └── enrichment.test.ts
    │
    └── integration/
        ├── listing-session.test.ts
        └── dispatch-queue.test.ts
```

---

## 3. D1 DATABASE SCHEMA

See `worker/db/schema.sql` — complete schema with all tables, indexes, and constraints.

**Key Tables:**

### `listings`
Master record for each item. One row per item, regardless of platform count.

```sql
CREATE TABLE listings (
  id TEXT PRIMARY KEY,                    -- UUID v4
  sku TEXT UNIQUE NOT NULL,               -- CJP-RNG-2603-0001
  status TEXT NOT NULL DEFAULT 'draft',   -- draft|processing|ready|listed|sold|ended
  title TEXT,                             -- Master title (platform-specific in listing_fields)
  category TEXT,                          -- Detected category (RNG, NKL, etc.)
  condition_id INTEGER,                   -- eBay condition ID
  condition_name TEXT,
  price_cents INTEGER,                    -- Suggested price in cents
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  listed_at TEXT,
  sold_at TEXT,
  ended_at TEXT
);

CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_sku ON listings(sku);
CREATE INDEX idx_listings_created ON listings(created_at);
```

### `listing_platforms`
Per-platform listing data. One row per listing-platform combination.

```sql
CREATE TABLE listing_platforms (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                 -- ebay|shopify|etsy|facebook|pinterest|whatnot|instagram|depop|mercari|poshmark
  external_id TEXT,                       -- Platform's listing ID
  external_url TEXT,                      -- Live listing URL
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|listed|sold|ended|error
  price_cents INTEGER,                    -- Platform-specific price
  last_sync_at TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, platform)
);

CREATE INDEX idx_listing_platforms_listing ON listing_platforms(listing_id);
CREATE INDEX idx_listing_platforms_platform ON listing_platforms(platform, status);
```

### `listing_fields`
EAV pattern for all platform-specific fields. Avoids schema migrations.

```sql
CREATE TABLE listing_fields (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                 -- Which platform this field is for (or 'master' for shared)
  field_name TEXT NOT NULL,               -- title|description|brand|model|size|color|...
  field_value TEXT NOT NULL,              -- JSON-encoded value
  ai_generated INTEGER DEFAULT 0,         -- 1 if AI suggested
  confidence REAL,                        -- 0.0-1.0 if AI generated
  source TEXT,                            -- 'user'|'ai'|'import'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(listing_id, platform, field_name)
);

CREATE INDEX idx_listing_fields_listing ON listing_fields(listing_id);
CREATE INDEX idx_listing_fields_platform ON listing_fields(platform);
```

### `media_assets`
Image and video records linked to listings.

```sql
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,                   -- R2 object key
  type TEXT NOT NULL,                     -- image|video
  original_filename TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  processing_status TEXT DEFAULT 'pending', -- pending|processing|ready|error
  processing_error TEXT,
  variants TEXT,                           -- JSON: { "ebay_500": "r2_key", ... }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_media_assets_listing ON media_assets(listing_id);
CREATE INDEX idx_media_assets_status ON media_assets(processing_status);
```

### `sku_registry`
Global SKU registry with collision detection.

```sql
CREATE TABLE sku_registry (
  sku TEXT PRIMARY KEY,
  sku_prefix TEXT NOT NULL,               -- CJP-RNG-2603
  category TEXT NOT NULL,                 -- RNG|NKL|BRD|...
  date_code TEXT NOT NULL,                -- 2603
  sequence INTEGER NOT NULL,              -- 0001
  listing_id TEXT REFERENCES listings(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sku_prefix ON sku_registry(sku_prefix);
CREATE INDEX idx_sku_date ON sku_registry(date_code);
```

### `dispatch_log`
Full audit trail of all platform operations.

```sql
CREATE TABLE dispatch_log (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id),
  platform TEXT NOT NULL,
  action TEXT NOT NULL,                   -- publish|update|end|relist|sync
  request_payload TEXT,                   -- JSON
  response_payload TEXT,                  -- JSON
  status TEXT NOT NULL,                   -- pending|success|error|dead_letter
  error_message TEXT,
  error_code TEXT,
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_dispatch_listing ON dispatch_log(listing_id);
CREATE INDEX idx_dispatch_status ON dispatch_log(status);
CREATE INDEX idx_dispatch_retry ON dispatch_log(status, next_retry_at);
```

### `platform_credentials`
OAuth metadata (tokens stored in Workers KV for security).

```sql
CREATE TABLE platform_credentials (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  connected INTEGER DEFAULT 0,
  connected_at TEXT,
  expires_at TEXT,
  metadata TEXT,                          -- JSON: shop_domain, user_id, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### `csv_batches`
eBay CSV batch upload tracking.

```sql
CREATE TABLE csv_batches (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|generated|uploaded|processing|completed|error
  listing_count INTEGER NOT NULL,
  r2_key TEXT,                            -- Path to CSV in R2
  download_url TEXT,                      -- Signed URL for download
  ebay_response TEXT,                     -- JSON response from File Exchange
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_csv_batches_status ON csv_batches(status);
```

### `browser_sessions`
Browser Rendering session cache.

```sql
CREATE TABLE browser_sessions (
  id TEXT PRIMARY KEY,
  listing_id TEXT REFERENCES listings(id),
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|error
  screenshot_r2_key TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_browser_listing ON browser_sessions(listing_id);
```

---

## 4. WRANGLER.TOML

See `wrangler.toml` — complete configuration with all bindings.

**Key Bindings:**

```toml
name = "caspers-jewelry-listings"
main = "worker/index.ts"
compatibility_date = "2024-01-01"

# Durable Objects
[[durable_objects.bindings]]
name = "LISTING_SESSION"
class_name = "ListingSession"

[[durable_objects.bindings]]
name = "INVENTORY_LOCK"
class_name = "InventoryLock"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "caspers-jewelry-db"
database_id = "<generated-on-first-deploy>"

# R2 Buckets
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "caspers-jewelry-media"

# KV Namespaces
[[kv_namespaces]]
binding = "TOKENS"
id = "<generated>"

[[kv_namespaces]]
binding = "RATELIMIT"
id = "<generated>"

[[kv_namespaces]]
binding = "CONFIG"
id = "<generated>"

# Queues
[[queues.producers]]
binding = "DISPATCH_QUEUE"
queue = "dispatch-queue"

[[queues.consumers]]
queue = "dispatch-queue"
max_batch_size = 10
max_batch_timeout = 30

# Workers AI
[ai]
binding = "AI"

# Browser Rendering
[browser]
binding = "BROWSER"
```

---

## 5. ENVIRONMENT VARIABLES

Required in `.dev.vars`:

```bash
# App Configuration
APP_SECRET_KEY=<32+ random bytes>
STORE_NAME=Caspers Jewelry
STORE_LOGO_R2_KEY=watermark/store_logo.png

# eBay (for CSV only, no API credentials needed)
EBAY_STORE_NAME=Caspers Jewelry

# Shopify (if used)
SHOPIFY_SHOP_DOMAIN=
SHOPIFY_ACCESS_TOKEN=

# Etsy
ETSY_KEYSTRING=
ETSY_SHARED_SECRET=

# Facebook
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Pinterest
PINTEREST_APP_ID=
PINTEREST_APP_SECRET=

# Whatnot, Instagram, Depop, Mercari, Poshmark
# No API credentials — browser automation only
```

---

## 6. PHASE 1 COMPLETION CHECKLIST

- [x] ADR documented with all architectural decisions
- [x] Complete file tree generated (92 files)
- [x] D1 schema designed (9 tables, all indexes)
- [x] SKU system designed (hierarchical format)
- [x] Platform strategy defined (10 platforms, 3 integration methods)
- [x] Browser Rendering approach for eBay + semi-automated platforms
- [x] wrangler.toml structure defined

**Files to Create in Phase 1:**
1. `Blueprint.md` (this file)
2. `wrangler.toml`
3. `worker/db/schema.sql`
4. `package.json`
5. `tsconfig.json`
6. `vite.config.ts`
7. `.dev.vars.example`

---

## 7. NEXT PHASE PREVIEW

**Phase 2 — Foundation** will create:
- Worker entry (`worker/index.ts`)
- All Durable Objects
- D1 schema application
- Base Hono routes
- React SPA shell
- Base layout components

---

*Blueprint generated by Vibe SDK Phase 1*
*Ready for Phase 2 execution*
