# VIBE SDK — PHASE PROMPT CHAIN (Phase 2 → 5)
# Continuing from completed Blueprint (Phase 1)
# Starting point: All Phase 1 files exist and TypeScript compiles
# ─────────────────────────────────────────────────────────────────
# HOW TO USE:
# Each prompt feeds directly into the next.
# Where you see [FROM PHASE 1] — the file already exists, paste its contents.
# Where you see [OUTPUT OF X.X] — paste exactly what the previous prompt returned.
# Never skip a prompt. Never merge two prompts into one call.
# ─────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════╗
║  PHASE 2 — FOUNDATION                                           ║
║  Agent: projectSetup                                            ║
║  Goal: Working Worker that serves React SPA + Durable Objects   ║
╚══════════════════════════════════════════════════════════════════╝

# ── 2.1 — Worker Entry Point ─────────────────────────────────────
#
# FEED INTO: projectSetup agent
# INPUT FILES: worker/env.ts, wrangler.toml (both from Phase 1)
# OUTPUT: worker/index.ts

Write worker/index.ts — the Hono application entry point.

[FROM PHASE 1: paste worker/env.ts]
[FROM PHASE 1: paste wrangler.toml]

Rules:
- Import Hono from 'hono'
- Type the app as Hono<{ Bindings: Env }>
- Register these route groups in this exact order:

  1. cors() middleware — all routes
  2. /api/listings        → import from ./routes/listings
  3. /api/media          → import from ./routes/media
  4. /api/export         → import from ./routes/export
  5. /api/upload-jobs    → import from ./routes/upload-jobs
  6. /api/social         → import from ./routes/social
  7. /api/settings       → import from ./routes/settings
  8. /api/session/:id    → WebSocket upgrade handler (inline, delegates to LISTING_SESSION DO)
  9. /api/browser/:id    → WebSocket upgrade handler (inline, delegates to BROWSER_SESSION DO)
  10. /* catch-all       → serve React SPA via env.ASSETS.fetch(request)

- Export default: { fetch: app.fetch, scheduled: scheduledHandler }
- Export named: ListingSession, BrowserSession (the DO classes — stubs for now)
- scheduledHandler is a stub that returns immediately

Do not implement route handlers yet — just register the imports.
Create stub files for each route import that export an empty Hono router.
Output: worker/index.ts + one stub file per route.
Output only TypeScript. No prose.


# ── 2.2 — ListingSession Durable Object ──────────────────────────
#
# FEED INTO: projectSetup agent
# INPUT FILES: worker/env.ts (Phase 1), worker/index.ts (2.1 output)
# OUTPUT: worker/durable-objects/ListingSession.ts

Write worker/durable-objects/ListingSession.ts

[FROM PHASE 1: paste worker/env.ts]
[OUTPUT OF 2.1: paste worker/index.ts]

This DO is keyed by listing UUID. One instance per listing, lives indefinitely.

State shape — persist ALL of this in DO storage using this.ctx.storage:
Use the ListingSessionState type already defined in worker/env.ts.
If ListingSessionState needs fields added, add them and note the change.

The DO must handle these fetch() routes:
  POST /init          — initialize state for a new listing, store in DO storage
  GET  /state         — return current full state as JSON
  POST /step/start    — mark a step as running, broadcast to WebSocket clients
  POST /step/complete — mark a step done, store output, broadcast
  POST /step/error    — mark a step failed, store error, broadcast
  POST /field         — store one AI-generated field, broadcast field_ready event
  GET  /upgrade       — WebSocket upgrade (called by Worker route handler)

WebSocket broadcast format — every connected client receives:
  { type: 'step_start',    step: string, timestamp: string }
  { type: 'step_complete', step: string, output: unknown, duration_ms: number }
  { type: 'step_error',    step: string, error: string }
  { type: 'field_ready',   key: string, value: unknown, ai_suggested: boolean, confidence: number | null }
  { type: 'state_sync',    state: ListingSessionState }   ← sent on new WebSocket connect

Build lock: store a boolean "buildLock" in DO storage.
POST /init sets buildLock = true.
POST /step/complete on the final step sets buildLock = false.
If a second POST /init arrives while buildLock = true, return 409 Conflict.

Output only TypeScript. No prose.


# ── 2.3 — BrowserSession Durable Object ──────────────────────────
#
# FEED INTO: projectSetup agent  
# INPUT: worker/env.ts (Phase 1), output of 2.2 for reference pattern
# OUTPUT: worker/durable-objects/BrowserSession.ts

Write worker/durable-objects/BrowserSession.ts

[FROM PHASE 1: paste worker/env.ts]
[OUTPUT OF 2.2: paste ListingSession.ts as reference for DO patterns]

This DO is keyed by upload job UUID. Holds one Puppeteer browser instance.

State shape — persist in DO storage:
  jobId: string | null
  exportId: string | null
  status: 'idle' | 'launching' | 'navigating' | 'uploading' | 'complete' | 'error'
  currentStep: string
  screenshotR2Keys: string[]
  successCount: number
  errorCount: number
  errorMessages: string[]
  error: string | null
  startedAt: string | null
  completedAt: string | null

Fetch routes:
  POST /execute    — accepts { jobId, exportId, csvR2Key }, starts browser job async
  GET  /state      — return current state
  GET  /upgrade    — WebSocket upgrade

WebSocket broadcast format:
  { type: 'job_step',         step: string }
  { type: 'screenshot_ready', r2Key: string, step: string }
  { type: 'job_complete',     successCount: number, errorCount: number }
  { type: 'job_error',        error: string, lastScreenshotKey: string | null }
  { type: 'state_sync',       state: BrowserSessionState }   ← on connect

IMPORTANT: POST /execute returns immediately with 202 Accepted.
The actual browser job runs via this.ctx.waitUntil(this.runJob(...)).
This prevents the HTTP request from timing out during a long upload.

Output only TypeScript. No prose.


# ── 2.4 — D1 Query Layer: listings.ts ────────────────────────────
#
# FEED INTO: projectSetup agent
# INPUT: worker/db/schema.sql (Phase 1), worker/env.ts (Phase 1)
# OUTPUT: worker/db/listings.ts

Write worker/db/listings.ts — all D1 query functions for the listings tables.

[FROM PHASE 1: paste worker/db/schema.sql]
[FROM PHASE 1: paste worker/env.ts]

Write typed, async query functions. All queries use prepared statements.
Never concatenate strings into SQL.

Functions required:

createListing(db: D1Database, draft: ListingDraft): Promise<string>
  — inserts into listings table, returns UUID

getListingById(db: D1Database, id: string): Promise<Listing | null>
  — returns full listing row or null

updateListingStatus(db: D1Database, id: string, status: ListingStatus): Promise<void>

setListingField(db: D1Database, params: {
  listingId: string
  key: string
  value: string
  aiSuggested: boolean
  confidence: number | null
}): Promise<void>
  — upsert into listing_fields (insert or replace)

getListingFields(db: D1Database, listingId: string): Promise<Record<string, {
  value: string
  aiSuggested: boolean
  confidence: number | null
}>>

listListingsByStatus(db: D1Database, status: ListingStatus, limit: number, offset: number): Promise<Listing[]>

createMediaAsset(db: D1Database, asset: Omit<MediaAsset, 'id' | 'createdAt'>): Promise<string>

updateMediaAssetStatus(db: D1Database, id: string, status: string, publicUrl?: string): Promise<void>

createCSVExport(db: D1Database, listingIds: string[]): Promise<string>

updateCSVExport(db: D1Database, id: string, updates: Partial<CSVExport>): Promise<void>

createUploadJob(db: D1Database, exportId: string): Promise<string>

updateUploadJob(db: D1Database, id: string, updates: Partial<UploadJob>): Promise<void>

logDispatch(db: D1Database, entry: Omit<DispatchLogEntry, 'id' | 'createdAt'>): Promise<void>

Define Zod schemas for Listing, MediaAsset, CSVExport, UploadJob, DispatchLogEntry.
Validate every D1 result through these schemas before returning.

Output only TypeScript. No prose.


# ── 2.5 — React SPA Shell ────────────────────────────────────────
#
# FEED INTO: projectSetup agent
# INPUT: Blueprint.md file tree section (Phase 1), worker/env.ts for types
# OUTPUT: frontend/app/root.tsx + all route stub files + shared layout

Write the React SPA application shell.

[FROM PHASE 1: paste the file tree section from Blueprint.md]
[FROM PHASE 1: paste worker/env.ts for type reference]

Files to create:

1. frontend/app/root.tsx
   - React Router v6 BrowserRouter
   - Route definitions for all pages from the Blueprint file tree
   - Persistent sidebar navigation (always visible)
   - Dark theme: background #0A0B0E, surfaces #111318

2. frontend/app/components/shared/Layout.tsx
   - Sidebar: logo/store name at top, nav links, platform status indicators at bottom
   - Main content area: scrollable, padded
   - Top bar: breadcrumb + action button slot (right side)

3. Sidebar nav links (in order):
   - Dashboard (icon: LayoutDashboard)
   - New Listing (icon: Plus) — highlighted as primary action
   - Inventory (icon: Package)
   - Export & Upload (icon: Upload)
   - Social Content (icon: Share2)
   - Settings (icon: Settings)

4. Platform status indicators in sidebar footer:
   For each of: eBay, Shopify, Etsy, Facebook, Poshmark
   Show a colored dot: green=connected, red=error, grey=not connected
   Fetch status from GET /api/settings/platforms on mount

5. Create stub route files for every page route in the file tree.
   Each stub: exports a default React component returning a placeholder div 
   with the page name. No logic yet.

Color system as CSS variables in root.tsx:
  --bg-base: #0A0B0E
  --bg-surface: #111318
  --bg-elevated: #1A1D24
  --border: #252830
  --text-primary: #E8EAF0
  --text-secondary: #8890A4
  --text-muted: #454D60
  --accent-ebay: #E53238
  --accent-shopify: #96BF48
  --accent-primary: #3B82F6
  --accent-success: #22C55E
  --accent-warning: #F59E0B
  --accent-error: #EF4444

Use Tailwind utility classes only. Use lucide-react for all icons.
Output only TypeScript JSX. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 3 — PHASE GENERATION                                     ║
║  Agent: phaseGeneration                                         ║
║  Goal: All agent logic, AI calls, builders, validators          ║
╚══════════════════════════════════════════════════════════════════╝

# ── 3.1 — Raw Input Ingest ───────────────────────────────────────
#
# INPUT: worker/env.ts (Phase 1)
# OUTPUT: worker/agents/listing/ingest.ts

Write worker/agents/listing/ingest.ts

[FROM PHASE 1: paste worker/env.ts]

This file has one job: normalize any raw input into a ListingDraft.

Define and export these types:

type RawInputType = 'freetext' | 'photo_description' | 'structured_form' | 'bulk_csv_row'

interface RawInput {
  type: RawInputType
  content: string
  imageCount: number
  sourceLabel?: string
}

interface ListingDraft {
  id: string
  sku: string                              // format: CJP-{CATEGORY}-{YYMM}-{SEQ}
  rawInput: RawInput
  fields: Record<string, unknown>          // empty at ingest
  htmlDescription: string | null
  csvRow: Record<string, string> | null
  mediaAssets: string[]
  status: ListingStatus
  createdAt: string
}

Write normalizeInput(body: unknown): ListingDraft
- Validate body with Zod (accept all 4 input types)
- Assign UUID via crypto.randomUUID()
- Assign SKU: generate placeholder, real category fills in after classification
  placeholder format: CJP-MISC-{YYMM}-{4 random hex chars}
- Set status to 'draft'
- Throw InputValidationError (typed class) on invalid input
  InputValidationError must have: message, field (which field failed), received (what was received)

Write the Zod schema for each input type as a named export so routes can use them.

Output only TypeScript. No prose.


# ── 3.2 — AI Enricher: Classification ───────────────────────────
#
# INPUT: output of 3.1 (ListingDraft type), worker/env.ts
# OUTPUT: worker/agents/listing/enricher.ts (first section)

Start writing worker/agents/listing/enricher.ts
This file will grow across prompts 3.2 through 3.6. 
Start with the file header and the classification step only.

[OUTPUT OF 3.1: paste ingest.ts]
[FROM PHASE 1: paste worker/env.ts]

Write:

1. File header with all imports that will be needed across the full enricher
   (import future functions as TODO comments so imports are ready)

2. CLASSIFICATION_SYSTEM_PROMPT — a const string
   Instruct the AI: output only valid JSON, no prose, no markdown fences.
   The AI must extract structured product data from any raw description.

3. ClassificationResult Zod schema and inferred TypeScript type:
   {
     category_name: string
     ebay_category_id: number
     sku_category: SkuCategory        // use the SkuCategory enum from env.ts
     item_type: string
     brand: string | null
     model: string | null
     condition_grade: 'New' | 'Excellent' | 'VeryGood' | 'Good' | 'Fair'
     era_or_year: string | null
     primary_material: string | null
   }

4. buildClassificationPrompt(draft: ListingDraft): string
   Formats the raw input content into the user message.

5. runClassification(env: Env, draft: ListingDraft): Promise<ClassificationResult>
   - Calls env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', ...)
   - temperature: 0.1
   - max_tokens: 1000
   - Parse response.response as JSON
   - Validate with ClassificationResult Zod schema
   - On parse failure: retry ONCE with prompt: 
     "Your previous response was not valid JSON. Return only the JSON object, nothing else. 
      Previous attempt: {rawResponse}"
   - On second failure: throw EnrichmentError with { step: 'classification', rawResponse }

Output only TypeScript. No prose.
End the file with a TODO comment: "// Continue in prompts 3.3 → 3.6"


# ── 3.3 — AI Enricher: Item Specifics ───────────────────────────
#
# INPUT: output of 3.2 (enricher.ts so far)
# OUTPUT: enricher.ts with item specifics step added

Add the ITEM SPECIFICS step to worker/agents/listing/enricher.ts

[OUTPUT OF 3.2: paste enricher.ts]

Append to the file (do not rewrite — add after the classification section):

1. ITEM_SPECIFICS_SYSTEM_PROMPT
   The AI must output a JSON array of {name, value} pairs.
   Use official eBay Item Specific names for the detected category.
   Prefer eBay's accepted value lists for common specifics (Color, Size, Material, etc).
   Max 20 pairs. No duplicates. No empty values.

2. ItemSpecific Zod schema: z.object({ name: z.string().min(1), value: z.string().min(1) })
   Response schema: z.array(ItemSpecific).max(20)

3. buildItemSpecificsPrompt(draft: ListingDraft, classification: ClassificationResult): string
   Include: category_name, item_type, brand, material, era, condition from classification.
   Append the raw input content.

4. runItemSpecifics(env: Env, draft: ListingDraft, classification: ClassificationResult): Promise<ItemSpecific[]>
   - temperature: 0.2, max_tokens: 2000
   - Same retry pattern as classification
   - On both failures: return empty array (item specifics are not blocking)
     Log warning: "Item specifics generation failed, proceeding with empty array"

Output only the NEW code to append. Do not rewrite the whole file.
Show exactly where to append: "// APPEND AFTER LINE: runClassification function"


# ── 3.4 — AI Enricher: Title ─────────────────────────────────────
#
# INPUT: output of 3.3 (enricher.ts)
# OUTPUT: enricher.ts with title step added

Add the TITLE GENERATION step to worker/agents/listing/enricher.ts

[OUTPUT OF 3.3: paste enricher.ts]

Append after the item specifics section:

1. TITLE_SYSTEM_PROMPT
   Rules the AI must follow:
   - Maximum 80 characters — count carefully before outputting
   - Structure: [Brand if known] [Key Spec] [Item Type] [Condition signal if space allows]
   - Lead with the most searchable term (what would a buyer type first?)
   - No ALL CAPS. No excessive punctuation. No store name.
   - Output only JSON: { title: string, char_count: number, keywords_used: string[] }

2. TitleResult Zod schema with refinement:
   z.object({
     title: z.string().max(80),   ← hard reject if over 80
     char_count: z.number().max(80),
     keywords_used: z.array(z.string()),
   })

3. buildTitlePrompt(draft: ListingDraft, classification: ClassificationResult, itemSpecifics: ItemSpecific[]): string

4. runTitleGeneration(env: Env, draft: ListingDraft, classification: ClassificationResult, itemSpecifics: ItemSpecific[]): Promise<TitleResult>
   - temperature: 0.5, max_tokens: 500
   - If Zod rejects because title > 80 chars:
     Retry with: "The title '{bad_title}' is {n} characters. It must be 80 or fewer. 
                  Shorten it while keeping the most important keywords."
   - If second attempt also > 80: hard truncate at word boundary, log warning
   - On JSON parse failure: same retry pattern as classification

Output only NEW code to append. Show append location.


# ── 3.5 — AI Enricher: Description + Pricing ────────────────────
#
# INPUT: output of 3.4 (enricher.ts)
# OUTPUT: enricher.ts with description + pricing steps added

Add DESCRIPTION and PRICING steps to worker/agents/listing/enricher.ts

[OUTPUT OF 3.4: paste enricher.ts]

Append after the title section:

--- DESCRIPTION ---

1. DESCRIPTION_SYSTEM_PROMPT
   The AI writes honest, specific, buyer-protective copy. No HTML.
   Condition details must be specific: "light scratches on interior" not "light wear".
   Never upgrade condition in copy (Good condition cannot be described as Excellent).
   Output only JSON matching the schema below.

2. DescriptionResult Zod schema:
   {
     short_description: z.string().max(400),    // 75 words max
     long_description: z.string().max(3000),    // 200-400 words
     condition_details: z.string().max(500),    // specific, honest
     what_is_included: z.string().max(300),     // comma-separated items
     shipping_note: z.string().max(150),        // one sentence
   }

3. buildDescriptionPrompt(draft, classification, titleResult): string

4. runDescriptionGeneration(env, draft, classification, titleResult): Promise<DescriptionResult>
   - temperature: 0.6, max_tokens: 3000
   - Same retry pattern

--- PRICING ---

5. PRICING_SYSTEM_PROMPT
   Seller is asking for a price suggestion, not a guarantee.
   The AI must include a caveat in the rationale that its pricing knowledge 
   may be outdated and the seller should verify with current eBay sold listings.
   Output only JSON.

6. PricingResult Zod schema:
   {
     suggested_price: z.number().positive(),
     price_range: z.tuple([z.number().positive(), z.number().positive()]),
     strategy: z.enum(['premium', 'market', 'competitive', 'liquidation']),
     rationale: z.string().max(300),
   }

7. buildPricingPrompt(draft, classification, descriptionResult): string

8. runPricingGeneration(env, draft, classification, descriptionResult): Promise<PricingResult>
   - temperature: 0.3, max_tokens: 500
   - On failure: return safe default { suggested_price: 0, price_range: [0, 0], 
     strategy: 'market', rationale: 'Pricing unavailable — please set manually.' }
   - Never throw on pricing failure (pricing is not blocking)

Output only NEW code to append. Show append location.


# ── 3.6 — AI Enricher: Pipeline Orchestrator ────────────────────
#
# INPUT: output of 3.5 (complete enricher.ts)
# OUTPUT: enricher.ts with orchestrator function added + SKU finalization

Add the pipeline orchestrator to worker/agents/listing/enricher.ts

[OUTPUT OF 3.5: paste enricher.ts]

Append at the bottom of the file:

Write runEnrichmentPipeline(
  env: Env,
  draft: ListingDraft,
  sessionDO: DurableObjectStub,   // the ListingSession DO for this listing
): Promise<EnrichedDraft>

The orchestrator:
1. Calls sessionDO POST /step/start for each step before running it
2. Calls sessionDO POST /step/complete with output after each step succeeds
3. Calls sessionDO POST /step/error if a step throws
4. Runs steps in this exact order:
   step 'classify'       → runClassification()
   step 'item_specifics' → runItemSpecifics()  
   step 'title'          → runTitleGeneration()
   step 'description'    → runDescriptionGeneration()
   step 'pricing'        → runPricingGeneration()

After all steps complete:
5. Finalize the SKU: replace MISC placeholder with the sku_category from ClassificationResult
   SKU format: CJP-{sku_category}-{YYMM}-{SEQ}
   SEQ: read from env.CONFIG KV key "sku_seq_{category}", increment, write back
6. Persist every result field to D1 via setListingField() (import from worker/db/listings.ts)
7. Update listing status to 'enriched' in D1

Define EnrichedDraft as ListingDraft with required fields populated:
  fields must contain: classification, itemSpecifics, title, description, pricing
  sku must be finalized (no MISC placeholder)

Output only NEW code to append. Show append location.


# ── 3.7 — HTML Builder ───────────────────────────────────────────
#
# INPUT: output of 3.6 (EnrichedDraft type)
# OUTPUT: worker/agents/listing/html-builder.ts

Write worker/agents/listing/html-builder.ts

[OUTPUT OF 3.6: paste the EnrichedDraft type definition]

This is a pure function — no AI calls, no network calls.

Export:
  type HtmlTemplate = 'base' | 'minimal' | 'luxury'

  function buildHTMLDescription(
    draft: EnrichedDraft,
    template: HtmlTemplate,
    imageUrls: string[],
    storeConfig: { storeName: string; tagline: string }
  ): string

TEMPLATE: 'base'
  Complete inline-styled HTML. Structure:
  
  a. HEADER: dark bar (#1a1a2e background, white text)
     - H1: item title
     - Condition badge: colored pill (green=New, blue=Excellent, yellow=VeryGood, 
       orange=Good, red=Fair)
  
  b. TWO COLUMN BODY (flex row, wraps on narrow):
     Left column (45%):
     - Hero image: first imageUrl, full width, max-height 400px, object-fit contain
     - Thumbnail strip: remaining imageUrls as 60x60px thumbnails
     Right column (55%):
     - H2: "Item Details"
     - Specs table: two-column (label | value), striped rows, from itemSpecifics
     - H2: "Condition"
     - Paragraph: condition_details text
     - H2: "What's Included"
     - Paragraph: what_is_included text
  
  c. FULL-WIDTH DESCRIPTION:
     - H2: "About This Item"
     - Paragraph: long_description text
  
  d. FOOTER: light grey background (#f5f5f5)
     - "Ships from [location]" | storeName | "SKU: [sku]"
     - shipping_note text

TEMPLATE: 'minimal'
  Single column. No images embedded. Text only. Fast load.
  Specs as a simple list, not a table.

TEMPLATE: 'luxury'
  Full-width hero image (100% width, max-height 500px).
  Centered layout, max-width 800px, auto margins.
  Large title (28px), generous padding (32px).
  Dark header with gold accent color (#B8976A).
  Editorial copy layout.

SAFETY RULES — enforce in code:
- Escape all user-supplied text: replace & < > " ' with HTML entities
- Remove any <script> tags from any string before injection
- Remove any <iframe> tags from any string before injection
- All image src attributes must start with https:// — skip others with a console.warn
- If imageUrls is empty: skip image section entirely, do not render broken img tags
- Validate output length < 500000 chars before returning
  If over limit: use 'minimal' template regardless of requested template, log warning

Output only TypeScript. No prose.


# ── 3.8 — CSV Builder ────────────────────────────────────────────
#
# INPUT: output of 3.7 (EnrichedDraft type + html output)
# OUTPUT: worker/agents/listing/csv-builder.ts

Write worker/agents/listing/csv-builder.ts

[OUTPUT OF 3.6: paste EnrichedDraft type]
[FROM PHASE 1: paste the eBay platform config section from worker/env.ts]

Export these types:

interface EbayCSVRow {
  Action: string
  SiteID: string
  Country: string
  Currency: string
  CustomLabel: string
  Category: string
  ConditionID: string
  Title: string
  Description: string
  Format: string
  Duration: string
  StartPrice: string
  Quantity: string
  Location: string
  PicURL: string
  ShippingType: string
  'ShippingService-1:Option': string
  'ShippingService-1:Cost': string
  PaymentProfileName: string
  ReturnProfileName: string
  ShippingProfileName: string
  [itemSpecific: string]: string  // ItemSpecific(1-20):Name and :Value columns
}

Write buildCSVRow(
  draft: EnrichedDraft,
  htmlDescription: string,
  imageUrls: string[],
  config: { marketplace: string; currency: string; location: string; 
            paymentProfile: string; returnProfile: string; shippingProfile: string }
): EbayCSVRow

Condition grade to ConditionID mapping:
  New=1000, Excellent=3000, VeryGood=4000, Good=5000, Fair=6000

Title enforcement: if title > 80 chars after trimming, truncate at last word boundary 
before char 80. Log a warning with the listing SKU and truncation details.

PicURL: join imageUrls with '|'. eBay max is 24. If more than 24, take first 24 and log warning.

ItemSpecifics: map draft.fields.itemSpecifics array to:
  'ItemSpecific(1):Name', 'ItemSpecific(1):Value', 
  'ItemSpecific(2):Name', 'ItemSpecific(2):Value', etc.

Description: the htmlDescription string — will be escaped by buildCSVFile.

Validate completed row with EbayCSVRow Zod schema.
Throw CSVValidationError with field-level details on failure.

Write buildCSVFile(rows: EbayCSVRow[]): string
- First row: column headers (union of all keys across all rows)
- Each data row: values in same column order as header
- escapeCSVField(value: string): string
  Rules: if value contains comma, double-quote, or newline → wrap in double quotes
  Embedded double quotes → escape as ""
  The Description field will always trigger quoting (it's HTML)
  Empty string: output as empty (no quotes needed)

Output only TypeScript. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 4 — PHASE IMPLEMENTATION                                 ║
║  Agent: phaseImplementation                                     ║
║  Goal: Browser automation, social content, complete React GUI   ║
╚══════════════════════════════════════════════════════════════════╝

# ── 4.1 — eBay Login Session Manager ────────────────────────────
#
# INPUT: worker/env.ts (Phase 1)
# OUTPUT: worker/agents/browser/ebay-login.ts

Write worker/agents/browser/ebay-login.ts

[FROM PHASE 1: paste worker/env.ts]

CRITICAL CONSTRAINT: 
Do NOT automate eBay's login form with stored credentials.
eBay uses CAPTCHA, device fingerprinting, and 2FA.
Strategy: seller logs in manually once → we save the cookies → reuse them.

Write these functions:

class LoginRequiredError extends Error {
  code = 'LOGIN_REQUIRED' as const
  constructor() {
    super('eBay session expired or missing. Re-authenticate via Settings > eBay Connection.')
  }
}

async function saveSessionCookies(page: Page, env: Env): Promise<void>
  - Get all cookies from the page with page.cookies()
  - Filter to .ebay.com domain only
  - Store in env.TOKENS KV under key 'ebay_session_cookies'
  - TTL: 20 hours (72000 seconds)
  - Also store the capture timestamp under 'ebay_session_captured_at'

async function isSessionValid(env: Env): Promise<boolean>
  - Check env.TOKENS.get('ebay_session_cookies')
  - Returns false if null

async function restoreSession(page: Page, env: Env): Promise<boolean>
  - Get cookies from KV
  - If null: return false
  - Call page.setCookie(...cookies)
  - Return true

async function getReadyPage(browser: Browser, env: Env): Promise<Page>
  - Create new page, set viewport 1280x900
  - Call restoreSession()
  - If restoreSession returns false: throw LoginRequiredError
  - Navigate to https://www.ebay.com/sh/ovw (Seller Hub overview)
  - Check if page has any element matching '[data-testid*="user"]' or '.gh-IdentityHeader'
  - If not found: clear the stale cookies, throw LoginRequiredError
  - If found: return the authenticated page

async function clearSession(env: Env): Promise<void>
  - Delete 'ebay_session_cookies' from env.TOKENS

Output only TypeScript. No prose.


# ── 4.2 — eBay CSV Upload Automation ────────────────────────────
#
# INPUT: output of 4.1, worker/env.ts
# OUTPUT: worker/agents/browser/ebay-uploader.ts

Write worker/agents/browser/ebay-uploader.ts

[OUTPUT OF 4.1: paste ebay-login.ts]
[FROM PHASE 1: paste worker/env.ts]

Write uploadCSVToSellerHub(
  browser: Browser,
  params: { csvR2Key: string; jobId: string; exportId: string },
  env: Env,
  onStep: (step: string) => Promise<void>
): Promise<{ successCount: number; errorCount: number; errorMessages: string[] }>

Internal helper: randomDelay(min: number, max: number): Promise<void>
  Uses setTimeout. Prevents automation detection.
  Use between every interaction: min 400ms, max 1200ms.

Steps to implement:

STEP 1 — "Preparing authenticated page..."
  Call getReadyPage(browser, env) from ebay-login.ts
  If LoginRequiredError: rethrow (don't catch here — let caller handle)

STEP 2 — "Navigating to File Exchange..."
  page.goto('https://bulksell.ebay.com/ws/eBayISAPI.dll?FileExchangeCenter')
  waitUntil: 'networkidle0', timeout: 30000
  captureScreenshot(page, env, jobId, '01-loaded')
  await randomDelay(600, 1200)

STEP 3 — "Fetching CSV from storage..."
  env.MEDIA_BUCKET.get(csvR2Key)
  If null: throw new UploadError('CSV file not found in R2', { jobId, csvR2Key })

STEP 4 — "Attaching CSV file..."
  const fileInput = await page.$('input[type="file"]')
  If null: captureScreenshot '02-no-file-input' then throw UploadError('File input not found')
  Upload buffer as: name=listing-export-{jobId}.csv, mimeType='text/csv'
  captureScreenshot '02-file-attached'
  await randomDelay(800, 1500)

STEP 5 — "Submitting to eBay..."
  const btn = await page.$('input[type="submit"], button[type="submit"]')
  If null: captureScreenshot '03-no-submit' then throw UploadError('Submit button not found')
  await btn.click()
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
  captureScreenshot '03-submitted'

STEP 6 — "Reading eBay's response..."
  const bodyText = await page.evaluate(() => document.body.innerText)
  const result = parseFileExchangeResult(bodyText)
  captureScreenshot '04-result'
  await page.close()

Write parseFileExchangeResult(bodyText: string): { successCount: number; errorCount: number; errorMessages: string[] }
  Match these known eBay File Exchange response patterns:
  - Success: "X item(s) successfully submitted"
  - Errors: "X item(s) had errors" followed by error descriptions
  - Unknown page: return { successCount: 0, errorCount: 0, errorMessages: ['Unexpected response page — verify manually'] }

Write captureScreenshot(page: Page, env: Env, jobId: string, step: string): Promise<string>
  Takes PNG screenshot, saves to R2 at: screenshots/{jobId}/{step}.png
  Returns R2 key.
  Wrap in try/catch — screenshot failure must NEVER throw. Log warning and return ''.

Define UploadError class with: message, context: Record<string, unknown>.

Output only TypeScript. No prose.


# ── 4.3 — TikTok Content Generator ──────────────────────────────
#
# INPUT: output of 3.6 (EnrichedDraft type), worker/env.ts
# OUTPUT: worker/agents/social/tiktok.ts

Write worker/agents/social/tiktok.ts

[OUTPUT OF 3.6: paste EnrichedDraft type only]
[FROM PHASE 1: paste worker/env.ts]

Export these types:

interface TikTokScriptSegment {
  timestamp: string       // "0:00-0:03"
  voiceover: string       // exact spoken words
  visual: string          // what to show on camera
  text_overlay: string | null
}

interface TikTokVideoBrief {
  shots: Array<{
    name: string
    duration_seconds: number
    angle: string
    lighting: string
  }>
  props: string[]
  estimated_minutes: number
}

interface TikTokPackage {
  hook: string                        // ≤12 words, stops scroll
  duration: '15s' | '30s' | '60s'
  segments: TikTokScriptSegment[]
  video_brief: TikTokVideoBrief
  caption: string                     // ≤150 chars (pre-truncation limit)
  hashtags: string[]                  // 15-20 tags
  audio_vibe: string                  // one phrase describing ideal background audio
  cta_overlay: string                 // text for final 3-second overlay
}

TIKTOK_SYSTEM_PROMPT rules to encode:
- Never start with "POV:", "Wait for it", "You won't believe", "So I found"
- Hook: state the item, the deal, or the discovery immediately and specifically
- Condition in script must match condition in listing exactly
- For pre-owned: lead with story, age, brand heritage, investment angle
- For new: lead with the deal, the key spec, the use case
- Caption must be ≤150 chars — count before outputting
- Audio vibe is a genre/mood description, not a specific song (copyright)

TikTokPackage Zod schema with these refinements:
  hook: max 80 chars
  caption: max 150 chars
  hashtags: min 10, max 20 items
  segments: min 2 items

generateTikTokPackage(env: Env, draft: EnrichedDraft): Promise<TikTokPackage>
  temperature: 0.7, max_tokens: 2500
  Retry once on parse failure.
  On second failure: throw SocialGenerationError({ platform: 'tiktok', step: 'generate' })

Output only TypeScript. No prose.


# ── 4.4 — Pinterest Content Generator ───────────────────────────
#
# INPUT: output of 3.6 (EnrichedDraft type), worker/env.ts
# OUTPUT: worker/agents/social/pinterest.ts

Write worker/agents/social/pinterest.ts

[OUTPUT OF 3.6: paste EnrichedDraft type only]
[FROM PHASE 1: paste worker/env.ts]

Export these types:

interface PinterestPin {
  title: string           // ≤100 chars
  description: string     // ≤500 chars — include price naturally
  alt_text: string        // for accessibility and SEO
  destination_url: string // placeholder: will be replaced with live eBay URL
}

interface PinterestIdeaSlide {
  slide_number: number
  image_role: 'hero' | 'detail' | 'scale' | 'lifestyle' | 'condition'
  text_overlay: string
  voiceover: string | null
}

interface PinterestBoardStrategy {
  primary_board: string
  secondary_boards: string[]   // 2-4 additional boards
  new_board_suggestion: string | null
  posting_schedule: string     // e.g. "Pin 3x over 10 days, evenings 7-9pm"
}

interface PinterestPackage {
  primary_pin: PinterestPin
  board_strategy: PinterestBoardStrategy
  idea_slides: PinterestIdeaSlide[]    // 3-5 slides
  seo_keywords: string[]               // 8-12 long-tail keywords
}

PINTEREST_SYSTEM_PROMPT rules:
- Pinterest is a search engine — optimize every word for discovery
- Include price in description naturally, not as a label ("Available for $X")
- Long-tail keywords: "vintage 1970s levi denim jacket men size large" not "jeans"
- Board names must be real, specific, searchable boards a real Pinterest user would follow
- Idea slides must tell a story: hero → detail → context → condition → CTA

PinterestPackage Zod schema:
  primary_pin.title: max 100 chars
  primary_pin.description: max 500 chars
  idea_slides: min 3, max 5
  seo_keywords: min 6, max 12

generatePinterestPackage(env: Env, draft: EnrichedDraft): Promise<PinterestPackage>
  temperature: 0.6, max_tokens: 2000
  Same retry + error pattern as tiktok.ts

Output only TypeScript. No prose.


# ── 4.5 — Queue Consumers ────────────────────────────────────────
#
# INPUT: all agent files so far, worker/env.ts
# OUTPUT: worker/queues/social-jobs.ts + worker/queues/browser-jobs.ts

Write both queue consumers.

[FROM PHASE 1: paste worker/env.ts — focus on queue message types]
[OUTPUT OF 4.2: paste ebay-uploader.ts for import reference]
[OUTPUT OF 4.3: paste tiktok.ts for import reference]
[OUTPUT OF 4.4: paste pinterest.ts for import reference]

FILE 1: worker/queues/social-jobs.ts

Handles messages of type DispatchQueueMessage where action involves social generation.
For each message in the batch:
  1. Get the listing from D1
  2. Get listing fields from D1 (reconstruct EnrichedDraft)
  3. Generate TikTok package via generateTikTokPackage()
  4. Generate Pinterest package via generatePinterestPackage()
  5. Store both in D1 social_content table
  6. Update listing status to include 'social_ready'
  7. message.ack()
On any error: logDispatch() to D1, message.retry()

FILE 2: worker/queues/browser-jobs.ts

Handles browser CSV upload jobs.
max_batch_size is 1 — process single message only.
For the message:
  1. Get export record from D1
  2. Get the BrowserSession DO for this jobId
  3. POST /execute to the DO with { jobId, exportId, csvR2Key }
  4. Poll GET /state on the DO every 5 seconds until status is 'complete' or 'error'
  5. On complete: update D1 upload_jobs and csv_exports records
  6. On error: log to D1 dispatch_log, message.retry() up to 3 times

Output only TypeScript. No prose.


# ── 4.6 — React: useWebSocket Hook ──────────────────────────────
#
# INPUT: outputs of 2.2 (DO state types), 2.3 (BrowserSession state types)
# OUTPUT: frontend/app/hooks/useWebSocket.ts

Write frontend/app/hooks/useWebSocket.ts

This shared hook is used by ALL components that connect to Durable Object WebSockets.

[OUTPUT OF 2.2: paste the WebSocket message types from ListingSession.ts]
[OUTPUT OF 2.3: paste the WebSocket message types from BrowserSession.ts]

export function useWebSocket<T>(
  url: string | null,
  onMessage: (message: T) => void,
  onReconnect?: () => void
): { status: 'connecting' | 'open' | 'reconnecting' | 'closed'; send: (data: unknown) => void }

Behavior:
- Connect when url is non-null, disconnect when url becomes null
- On disconnect: reconnect with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
- While reconnecting: status = 'reconnecting'
- On reconnect: call onReconnect() so component can request state_sync from server
- On unmount (useEffect cleanup): close WebSocket, clear all timers
- On message received:
  - Try JSON.parse — if fails: console.warn('WebSocket: non-JSON message'), skip
  - If parsed: call onMessage(parsed as T)
- On unknown message type: console.warn('WebSocket: unknown message type', msg.type)

Output only TypeScript. No prose.


# ── 4.7 — React: Phase Progress Component ───────────────────────
#
# INPUT: output of 4.6 (useWebSocket hook), ListingSession message types
# OUTPUT: frontend/app/components/listing/PhaseProgress.tsx

Write frontend/app/components/listing/PhaseProgress.tsx

[OUTPUT OF 4.6: paste useWebSocket.ts]
[OUTPUT OF 2.2: paste the WebSocket message types from ListingSession.ts]

Props:
  listingId: string
  onComplete: (fields: Record<string, unknown>) => void

WebSocket URL: /api/session/{listingId}
On connect: send { type: 'request_sync' } to get current state

Steps (display in this order):
  classify         → "Identifying category and type..."
  item_specifics   → "Extracting item details..."
  title            → "Writing your eBay title..."
  description      → "Writing listing copy..."
  pricing          → "Suggesting a price..."
  html_build       → "Building HTML description..."
  image_process    → "Processing images..."
  csv_build        → "Assembling eBay CSV row..."
  tiktok_generate  → "Writing TikTok script..."
  pinterest_generate → "Generating Pinterest pins..."

Per-step rendering:
- PENDING:  grey circle, muted label
- RUNNING:  blue spinning ring (CSS @keyframes spin), white label, "working..." subtext
- COMPLETE: green checkmark, white label, inline output preview:
    classify: show detected category name + brand
    title: show the actual title text
    pricing: show the suggested price in large text
    all others: show a brief summary string
- ERROR: red X, label, error message in small red text, [Retry] button

On step_complete for 'csv_build': call onComplete(allFields)
On state_sync received: reconcile displayed steps with server state

Use Tailwind classes matching the dark theme from 2.5.
No external animation libraries — CSS only.

Output only TypeScript JSX. No prose.


# ── 4.8 — React: Upload Job Panel ───────────────────────────────
#
# INPUT: output of 4.6 (useWebSocket), BrowserSession message types
# OUTPUT: frontend/app/components/browser/UploadJobPanel.tsx

Write frontend/app/components/browser/UploadJobPanel.tsx

[OUTPUT OF 4.6: paste useWebSocket.ts]
[OUTPUT OF 2.3: paste the WebSocket message types from BrowserSession.ts]

Props:
  jobId: string

WebSocket URL: /api/browser/{jobId}
On connect: send { type: 'request_sync' }

Render:

1. STATUS HEADER
   Job ID displayed as monospace truncated (first 8 chars + "...")
   Status badge with pulsing animation when active:
   idle=grey, launching=amber(pulse), navigating=blue(pulse),
   uploading=blue(pulse), complete=green, error=red

2. STEP TIMELINE
   Each step as a row: icon | step text
   Completed steps: checkmark icon, muted text
   Current step: spinner icon, white text, "..." subtext
   Pending steps: empty circle, muted grey text

   Steps in order:
   "Browser ready"
   "Navigating to File Exchange"
   "CSV file attached"
   "Submitted to eBay"
   "Reading eBay's response"
   "Complete"

3. SCREENSHOT STRIP
   Horizontal scroll container
   Each screenshot: 120px wide thumbnail, shows step name as caption below
   Clicking opens a modal with full-size image
   New screenshots append automatically as job_screenshot_ready events arrive

4. RESULT PANEL (visible only on complete or error)
   On complete: green banner "X listings submitted to eBay"
                Sub-line: "X errors" (if any) — expandable list of error messages
   On error: red banner with error message
             "Last screenshot:" + thumbnail of most recent screenshot
             [Retry Upload] button

Output only TypeScript JSX. No prose.


# ── 4.9 — React: New Listing Page ───────────────────────────────
#
# INPUT: PhaseProgress from 4.7, HtmlPreview stub, all agent types
# OUTPUT: frontend/app/routes/new-listing.tsx

Write frontend/app/routes/new-listing.tsx — the primary daily-use screen.

[OUTPUT OF 4.7: paste PhaseProgress.tsx]
[OUTPUT OF 3.1: paste the ListingDraft type]

Three-panel layout on desktop (CSS grid: 28% | 44% | 28%), stacked on mobile.

LEFT PANEL — INPUT
  Large textarea: placeholder with 3 example inputs:
    "Vintage Levi's 501, size 32x30, faded wash, no rips..."
    "Nike Air Force 1 '07, size 10, worn twice, original box..."  
    "Wedgwood blue jasperware vase, 8 inches, no chips..."
  Character counter below textarea
  Image dropzone below textarea:
    - "Drop photos here or click to browse"
    - Shows thumbnails immediately on drop
    - Shows file count badge when images selected
  [Generate Listing] button — full width, disabled until textarea has ≥10 chars
  
  When generation starts: disable entire left panel

MIDDLE PANEL — AI BUILD PROGRESS
  PhaseProgress component fills this panel
  Shows when generation is running
  When complete: transitions to show a summary card:
    SKU | Category | Title | Price suggestion
    [View Full Listing] button → navigate to /listing/{id}

RIGHT PANEL — QUICK PREVIEW
  Initially: placeholder with instruction text
  As steps complete: updates live via same WebSocket
    title: appears after title step
    price: appears after pricing step
    "HTML ready" badge: appears after html_build step
    TikTok hook: appears after tiktok_generate step

POST form submission:
  POST /api/listings with { rawInput, imageCount }
  Response: { listingId: string }
  Then: render PhaseProgress with that listingId
  Navigate to /listing/{listingId} when onComplete fires

Output only TypeScript JSX. No prose.


# ── 4.10 — React: Social Content Studio ─────────────────────────
#
# INPUT: TikTokPackage (4.3), PinterestPackage (4.4)
# OUTPUT: frontend/app/routes/social/[id].tsx

Write frontend/app/routes/social/[id].tsx

[OUTPUT OF 4.3: paste TikTokPackage type]
[OUTPUT OF 4.4: paste PinterestPackage type]

URL param: listingId
Fetch: GET /api/social/{listingId} on mount
Loading state: skeleton placeholders while fetching
Empty state: "Social content not yet generated" + [Generate Now] button

Two-column layout (50/50, stacked on mobile):

LEFT — TIKTOK
  Platform header: "TikTok" with red accent dot
  Hook: displayed large, 24px, prominent — "Your opening line:"
  
  Script timeline table:
    Header row: Time | Say This | Show This | Text Overlay
    One row per segment, alternating row background
    All text selectable
  
  Video brief: collapsible section, default closed
    When open: shot checklist — each shot has a checkbox the seller ticks off while filming
  
  Caption preview box:
    Shows caption text
    Character counter: green under 100, yellow 100-130, red 130-150
    Cutoff indicator at 150 chars
  
  Hashtag chips: wrapping flex row, each tag as a chip
  
  Action bar (sticky bottom of left column):
    [Copy Hook] [Copy Script] [Copy Caption + Tags] [Copy Everything]

RIGHT — PINTEREST
  Platform header: "Pinterest" with red accent dot
  
  Simulated pin card:
    Grey placeholder rectangle (image slot)
    Pin title below in bold
    Description preview (truncated at 3 lines, "see more" to expand)
  
  Board strategy: 
    Primary board labeled "Primary" with star icon
    Secondary boards listed below
    New board suggestion (if any) in italic with "+" icon
    Posting schedule in muted text
  
  Idea slides: numbered sequence
    Each slide: number badge | image_role tag | text_overlay | voiceover (if any)
  
  SEO keywords: chip display
  
  Action bar:
    [Copy Pin Title] [Copy Description] [Copy All Pinterest]
  
  Top right corner: [Regenerate Social] button — calls POST /api/social/{listingId}/regenerate

Output only TypeScript JSX. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 5 — DEBUGGER                                             ║
║  Agent: deepDebugger                                            ║
║  Goal: Find and fix every gap before first run                  ║
╚══════════════════════════════════════════════════════════════════╝

# ── 5.1 — Zod Coverage Audit ────────────────────────────────────
#
# INPUT: all files from phases 2-4
# OUTPUT: list of every unvalidated boundary + fixed code

[PASTE ALL FILES from phases 2-4]

Find every place where data crosses a boundary without Zod validation:

Boundaries to check:
1. Every Workers AI response — is .response parsed with Zod before use?
2. Every D1 query result — is the row shape validated before TypeScript trusts it?
3. Every Hono route handler — is request body validated with Zod?
4. Every WebSocket message received on the frontend — is it validated before use?
5. Every R2 object.get() result — is null handled before accessing .body?
6. Every Queue message body — is it validated before the consumer uses it?

For each unvalidated boundary found:
  Output: { file, line_range, issue, fix: "exact code to add" }

Then output: corrected versions of every file that needs changes.
Skip files with no issues.


# ── 5.2 — Error Path Completeness ───────────────────────────────
#
# INPUT: all files from phases 2-4
# OUTPUT: every missing error handler + fixes

[PASTE ALL FILES from phases 2-4]

For every async operation, verify a catch exists:

Check in this order:
1. Every await in queue consumers — does failure log to D1 AND call message.retry()?
2. Every await in browser uploader — does timeout throw UploadError (not generic Error)?
3. Every await in AI enricher — does runEnrichmentPipeline handle partial failure?
   (if 'title' step fails, can 'description' still run? it should)
4. Every DO fetch() call from Worker routes — is 502/503 from DO handled?
5. Every env.MEDIA_BUCKET.get() — is the null case handled before .arrayBuffer()?

For each gap: output the minimal fix — just the try/catch or null-check needed.
Do not rewrite functions. Output patch-style: 
  "In file X, wrap line Y in try/catch: { before code } → { after code }"


# ── 5.3 — eBay CSV Edge Cases ────────────────────────────────────
#
# INPUT: output of 3.8 (csv-builder.ts)
# OUTPUT: verified or corrected csv-builder.ts

[OUTPUT OF 3.8: paste csv-builder.ts]

Test escapeCSVField() and buildCSVFile() against these inputs.
State PASS or FAIL for each. Fix every FAIL.

1.  Title: 'Vintage Ring, Gold, Size 7'        — contains commas
2.  Title: 'Bracelet 8" Chain Length'           — contains double quote
3.  Title: exactly 80 characters               — boundary condition, must not truncate
4.  Title: 81 characters                        — must truncate, must log warning with SKU
5.  Description: multi-line HTML with <table>   — newlines inside a quoted field
6.  Description: HTML with "alt text" quotes    — double quotes inside quoted field
7.  imageUrls: single URL, no pipe needed       — must not append trailing pipe
8.  imageUrls: 25 URLs provided                 — must truncate to 24, must log warning
9.  imageUrls: empty array                      — PicURL column must be empty string
10. StartPrice: 0                               — must this be rejected? (eBay requires > 0)
    Decision: if suggested_price is 0, throw CSVValidationError requiring seller to set price manually
11. ItemSpecifics: 21 pairs provided            — must truncate to 20, must log warning
12. ItemSpecific value: empty string            — must skip that pair entirely

Output: PASS/FAIL table + corrected escapeCSVField and buildCSVFile if any FAILs.


# ── 5.4 — WebSocket Resilience ───────────────────────────────────
#
# INPUT: output of 4.6 (useWebSocket.ts), 4.7 (PhaseProgress), 4.8 (UploadJobPanel)
# OUTPUT: verified components + any fixes

[OUTPUT OF 4.6: paste useWebSocket.ts]
[OUTPUT OF 4.7: paste PhaseProgress.tsx]
[OUTPUT OF 4.8: paste UploadJobPanel.tsx]

Verify these scenarios:

1. WebSocket disconnects after step 4 of 10 is complete.
   Does PhaseProgress show "reconnecting..." instead of freezing?
   Does it request state_sync on reconnect to recover steps 1-4?

2. User opens the same listing in two browser tabs.
   Do both receive the same events? (Both connect to same DO — should work)
   Does closing one tab affect the other?

3. A step takes longer than 60 seconds.
   Does the WebSocket stay open? (Workers have 30s CPU limit but WS connections can persist)
   Does the spinner keep spinning?

4. The DO sends a message with type: 'unknown_future_type'.
   Does the component log and continue without crashing?

5. Component unmounts while on step 6.
   Is the WebSocket closed in useEffect cleanup?
   Are all setTimeout/setInterval timers cleared?

For any scenario that fails: output the exact fix.


# ── 5.5 — End-to-End Integration Trace ──────────────────────────
#
# INPUT: all files from phases 2-4 + all fixes from 5.1-5.4
# OUTPUT: confirmed integration map OR list of broken connections

[PASTE ALL FILES — phases 2-4 plus all debug fixes]

Trace this complete user journey step by step.
For each step: name the exact function and file that handles it.
Mark WIRED (function exists and is called) or BROKEN (gap found).

Journey:
1.  Seller types "1990s Carhartt canvas work jacket size XL, faded, minor fraying on cuffs" 
    and clicks Generate Listing
2.  POST /api/listings fires from new-listing.tsx
3.  Hono route in worker/routes/listings.ts receives it
4.  normalizeInput() creates ListingDraft with SKU CJP-MISC-{YYMM}-xxxx
5.  ListingSession DO is instantiated via LISTING_SESSION binding
6.  POST /init sent to DO — buildLock set to true
7.  PhaseProgress.tsx opens WebSocket to /api/session/{id}
8.  state_sync message received — UI shows all steps pending
9.  runEnrichmentPipeline() begins — each step fires step_start before running
10. classify step: Workers AI returns ClassificationResult
    sku_category becomes 'CLOTHING'
    SKU updated to CJP-CLOTHING-{YYMM}-xxxx
11. item_specifics step completes — 18 pairs stored via setListingField()
12. title step completes — "Vintage Carhartt Canvas Work Jacket Mens XL Faded USA Made" (77 chars)
13. description step completes
14. pricing step completes — suggested $89.00, strategy 'market'
15. buildHTMLDescription() called with 'base' template
16. HTML stored in D1 listing_html table
17. buildCSVRow() called — EbayCSVRow assembled with HTML in Description column
18. CSV row JSON stored in D1 listing_fields
19. listing status updated to 'enriched'
20. Social queue message enqueued to QUEUE_SOCIAL
21. TikTok and Pinterest packages generated and stored in D1 social_content
22. buildLock released on final step
23. PhaseProgress fires onComplete() — new-listing.tsx receives fields
24. User navigates to /listing/{id}
25. Listing detail page loads with HTML preview in iframe
26. Listing detail page shows Social tab with TikTok + Pinterest content
27. User goes to /export, selects this listing, clicks "Generate CSV"
28. POST /api/export creates csv_exports record, generates CSV file, stores in R2
29. User clicks "Auto-Upload to eBay"
30. POST /api/upload-jobs creates upload_jobs record, enqueues to QUEUE_BROWSER
31. UploadJobPanel.tsx opens WebSocket to /api/browser/{jobId}
32. Queue consumer picks up browser job
33. POST /execute sent to BrowserSession DO
34. DO launches Puppeteer via env.BROWSER
35. getReadyPage() restores eBay session from KV
36. CSV uploaded to File Exchange — screenshots captured at each step
37. eBay returns success response
38. D1 upload_jobs status updated to 'upload_complete'
39. listing_platforms record created (if exists in schema)
40. UploadJobPanel shows "1 listing submitted to eBay"

For every BROKEN step: write the minimal fix — the one function call or import 
that connects the gap.

Output: numbered trace list with WIRED/BROKEN status + fix for each BROKEN item.