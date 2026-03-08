# VIBE SDK — PHASE PROMPT CHAIN
# eBay CSV + Browser Rendering + HTML Listings + Social Content Engine
# ─────────────────────────────────────────────────────────────────────
# HOW TO USE:
# Feed each prompt in sequence to the corresponding Vibe agent.
# Do not skip ahead. Each prompt output becomes the next prompt's input.
# Where you see [PASTE PREVIOUS OUTPUT] — paste exactly what the agent returned.
# ─────────────────────────────────────────────────────────────────────


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 1 — BLUEPRINT                                            ║
║  Agent: blueprint                                               ║
║  Model: GEMINI_3_FLASH_PREVIEW (high reasoning)                 ║
╚══════════════════════════════════════════════════════════════════╝

# ── BLUEPRINT PROMPT 1.1 — Project Identity ──────────────────────

You are starting a new Cloudflare Workers project from a fresh Vibe SDK fork.

Define the project identity. Output only the following JSON, nothing else:

{
  "project_name": "listing-factory",
  "tagline": "one sentence describing what this app does",
  "primary_user": "one sentence describing who uses this daily",
  "core_loop": "describe the 5-step user journey in one sentence each",
  "what_this_is_not": [
    "list 3 things this system explicitly does not do"
  ]
}

The system this project builds:
- Accepts raw product descriptions or photos as input
- Uses AI to generate complete eBay-ready listing data
- Builds a custom HTML description for each listing
- Assembles all listings into an eBay File Exchange CSV
- Uses Cloudflare Browser Rendering to upload that CSV to eBay Seller Hub automatically
- Generates TikTok scripts and Pinterest pin copy from the same listing data
- Has a web GUI the seller uses daily as their main listing tool


# ── BLUEPRINT PROMPT 1.2 — Stack Decisions ──────────────────────

Using the project identity from 1.1, make every stack decision.
Output only this JSON, nothing else.
For every field marked with a comment, choose the option listed or justify a different choice.

{
  "runtime": "Cloudflare Workers",
  "language": "TypeScript",
  "tsconfig_strict": true,
  "package_manager": "bun",

  "worker_router": "hono",                    // hono | itty-router | vanilla
  "frontend_framework": "react",              // react | none
  "frontend_routing": "react-router-v6",      // react-router-v6 | tanstack-router
  "css_approach": "tailwind-v4-utilities",    // tailwind-v4-utilities | vanilla
  "component_library": "shadcn-ui",          // shadcn-ui | none
  "icons": "lucide-react",

  "state_layer": "durable-objects",          // why: stateful browser sessions + WebSocket
  "database": "d1-sqlite",                   // why: SQL queries for listing history
  "file_storage": "r2",                      // why: images, CSVs, screenshots
  "cache_and_secrets": "workers-kv",         // why: session cookies, OAuth tokens, config
  "async_jobs": "cloudflare-queues",         // why: browser upload jobs + social generation
  "ai_text": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "ai_image": "@cf/bria-ai/rmbg",
  "browser_automation": "@cloudflare/puppeteer",

  "ebay_integration_method": "browser-rendering-plus-csv",
  "ebay_api_used": false,                    // no eBay developer account required
  "validation_library": "zod",

  "decisions_deferred": [
    "list any decisions that cannot be made until phase 2"
  ]
}


# ── BLUEPRINT PROMPT 1.3 — File Tree ────────────────────────────

Using the stack decisions from 1.2, generate the complete file tree.
Rules:
- Every file that will exist in the finished project must be listed
- No placeholder directories
- No "add more later" comments
- Annotate each file with exactly one line describing its single responsibility

Output as a code block containing only the annotated tree. No prose before or after.

Directories to include:
  worker/
    index.ts
    agents/inferutils/
    agents/listing/
    agents/browser/
    agents/social/
    agents/media/
    durable-objects/
    db/
    platforms/ebay/
    queues/
    middleware/
  frontend/
    app/routes/
    app/components/listing/
    app/components/browser/
    app/components/social/
    app/components/shared/
    app/hooks/
    app/lib/
  templates/
    html/
    csv/
  (config files at root)


# ── BLUEPRINT PROMPT 1.4 — D1 Schema ────────────────────────────

Using the file tree from 1.3, write the complete D1 SQLite schema.
Output only valid SQL. No prose. No markdown headers.
Every table needs: primary key, created_at, and a status field where relevant.

Tables required:
1. listings          — master record per item
2. listing_fields    — key-value store for all AI-generated fields per listing
3. media_assets      — images and videos linked to a listing
4. listing_html      — generated HTML description per listing
5. csv_exports       — a batch export job (one CSV = many listings)
6. upload_jobs       — browser automation job per CSV export
7. social_content    — TikTok + Pinterest content per listing
8. dispatch_log      — full audit trail of every action taken

Add indexes for every foreign key and every column used in WHERE clauses.


# ── BLUEPRINT PROMPT 1.5 — wrangler.toml ────────────────────────

Using the stack decisions from 1.2 and the schema from 1.4, write the complete wrangler.toml.
Output only the TOML. No prose.

Must include bindings for:
- Two Durable Object classes: ListingSession, BrowserSession
- D1 database
- Two R2 buckets: prod + dev
- Two KV namespaces: KV_CONFIG, KV_SESSIONS
- Two Queue producers: QUEUE_BROWSER, QUEUE_SOCIAL
- Two Queue consumers with correct batch sizes
  (browser jobs: max_batch_size = 1 because browser instances are heavy)
  (social jobs: max_batch_size = 5)
- Workers AI binding
- Browser Rendering binding
- compatibility_date: "2024-09-23"
- compatibility_flags: ["nodejs_compat"]

All secret values go in .dev.vars, not wrangler.toml.
Declare them as [vars] with empty string placeholders.


# ── BLUEPRINT PROMPT 1.6 — TypeScript Env Interface ─────────────

Using the wrangler.toml from 1.5, write the TypeScript Env interface.
This must match every binding declared in wrangler.toml exactly.
Output only the TypeScript. No prose.

File: worker/types/env.ts

Include imports for:
- DurableObjectNamespace
- D1Database
- R2Bucket
- KVNamespace
- Queue
- Ai (Workers AI)
- BrowserWorker (@cloudflare/puppeteer)

Also define these shared enums in this file:
- ListingStatus: all valid status values for the listings table
- UploadJobStatus: all valid status values for upload_jobs
- SocialPlatform: 'tiktok' | 'pinterest' | 'instagram'


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 2 — PROJECT SETUP                                        ║
║  Agent: projectSetup                                            ║
║  Model: GEMINI_3_FLASH_PREVIEW                                  ║
╚══════════════════════════════════════════════════════════════════╝

# ── SETUP PROMPT 2.1 — package.json ─────────────────────────────

Write the complete package.json for this Cloudflare Workers project.
Use bun as the package manager.

[PASTE wrangler.toml from 1.5]
[PASTE Env interface from 1.6]

Rules:
- Include all dependencies the file tree from 1.3 requires
- Scripts: dev, deploy, db:migrate, db:seed, type-check, lint
- Use exact version pins, not ranges
- Do not include packages that are not used by at least one file in the tree

Output only the JSON. No prose.


# ── SETUP PROMPT 2.2 — tsconfig.json ────────────────────────────

Write the complete tsconfig.json.
strict: true is mandatory.
Target: ES2022.
Module: ESNext.
Path aliases: "@/*" maps to "frontend/app/*"

Output only the JSON. No prose.


# ── SETUP PROMPT 2.3 — Worker Entry Point ───────────────────────

Write worker/index.ts — the Hono application entry point.

[PASTE Env interface from 1.6]
[PASTE file tree from 1.3]

Register route groups in this order:
1. CORS middleware (all routes)
2. /api/listings     — CRUD for listing records
3. /api/media        — image upload endpoint
4. /api/export       — CSV export generation
5. /api/upload-jobs  — browser upload job management
6. /api/social       — social content retrieval
7. /api/session/:id  — WebSocket upgrade to ListingSession DO
8. /api/browser/:id  — WebSocket upgrade to BrowserSession DO
9. /api/settings     — config read/write
10. /* (catch-all)   — serve React SPA

Export ListingSession and BrowserSession Durable Object classes.
Output only TypeScript. No prose.


# ── SETUP PROMPT 2.4 — ListingSession Durable Object ────────────

Write worker/durable-objects/ListingSession.ts

[PASTE Env interface from 1.6]

This DO is instantiated once per listing (keyed by listing UUID).
It must:
- Store all listing state in DO storage (survives Worker restarts)
- Accept WebSocket connections from the frontend
- Broadcast phase progress events to all connected WebSocket clients
- Expose a fetch() handler for internal Worker-to-DO calls
- Hold a build lock so only one AI pipeline runs at a time per listing

State shape to persist in DO storage:
{
  listingId: string
  status: ListingStatus
  currentStep: string | null
  stepHistory: Array<{ step: string, status: 'running'|'complete'|'error', duration_ms: number }>
  fields: Record<string, unknown>
  error: string | null
  createdAt: string
  updatedAt: string
}

WebSocket message types to broadcast:
- { type: 'step_start', step: string }
- { type: 'step_complete', step: string, output: unknown, duration_ms: number }
- { type: 'step_error', step: string, error: string }
- { type: 'field_ready', key: string, value: unknown, aiSuggested: boolean }
- { type: 'listing_complete' }

Output only TypeScript. No prose.


# ── SETUP PROMPT 2.5 — BrowserSession Durable Object ────────────

Write worker/durable-objects/BrowserSession.ts

[PASTE Env interface from 1.6]

This DO holds one Puppeteer browser instance for the duration of one CSV upload job.
It must:
- Launch the browser on first job request
- Keep the browser alive until the job completes or errors
- Broadcast step-by-step progress via WebSocket to connected frontend clients
- Store screenshot R2 keys as the job progresses
- Expose a /execute endpoint that accepts { jobId, exportId, csvR2Key }
- Clean up the browser instance on completion or error

State shape:
{
  jobId: string | null
  status: UploadJobStatus
  currentStep: string
  screenshotR2Keys: string[]
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

WebSocket message types:
- { type: 'job_step', step: string }
- { type: 'screenshot_ready', r2Key: string, step: string }
- { type: 'job_complete', successCount: number, errorCount: number }
- { type: 'job_error', error: string, screenshotKey: string }

Output only TypeScript. No prose.


# ── SETUP PROMPT 2.6 — D1 Query Helpers ─────────────────────────

Write worker/db/listings.ts — all D1 query functions for listings.

[PASTE D1 schema from 1.4]
[PASTE Env interface from 1.6]

Write typed functions for:
- createListing(db, draft) → string (returns UUID)
- getListingById(db, id) → Listing | null
- updateListingStatus(db, id, status) → void
- setListingField(db, listingId, key, value, aiSuggested, confidence) → void
- getListingFields(db, listingId) → Record<string, ListingField>
- listListingsByStatus(db, status, limit, offset) → Listing[]
- markListingSold(db, id) → void

Rules:
- All queries use prepared statements with .bind() — no string concatenation in SQL
- All functions are async and return typed results
- Use Zod to validate D1 row shapes before returning

Output only TypeScript. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 3 — PHASE GENERATION                                     ║
║  Agent: phaseGeneration                                         ║
║  Model: GEMINI_3_FLASH_PREVIEW                                  ║
╚══════════════════════════════════════════════════════════════════╝

# ── PHASE GEN PROMPT 3.1 — Ingest Agent ─────────────────────────

Write worker/agents/listing/ingest.ts

This file has one job: accept raw input in any format and normalize it 
into a single ListingDraft object.

Define these types (export them):

type RawInputType = 'freetext' | 'structured_form' | 'photo_description' | 'bulk_csv_row'

interface RawInput {
  type: RawInputType
  content: string           // always a string — structured inputs are JSON stringified
  imageCount: number        // 0 if no images
  sourceUrl?: string        // if scraped from URL
}

interface ListingDraft {
  id: string                // UUID — assigned at ingest
  sku: string               // auto-generated: [STORE]-[YYYYMMDD]-[4-digit-sequence]
  rawInput: RawInput
  fields: Record<string, unknown>   // empty at ingest, filled by enricher
  htmlDescription: string | null    // filled by html-builder
  csvRow: Record<string, string> | null  // filled by csv-builder
  mediaAssets: string[]     // R2 keys, populated during media processing
  status: ListingStatus
  createdAt: string
}

Write the normalizeInput() function:
- Input: unknown (raw API body)
- Validates with Zod
- Returns ListingDraft with empty fields
- Assigns UUID and SKU
- Throws typed InputValidationError on invalid input

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.2 — AI Enricher: Classification ──────────

Write the CLASSIFICATION step inside worker/agents/listing/enricher.ts

[PASTE ListingDraft type from 3.1]
[PASTE Env interface from 1.6]

This is the first of 6 AI enrichment steps.
It calls @cf/meta/llama-3.3-70b-instruct-fp8-fast.

Write:
1. The system prompt string (const CLASSIFICATION_SYSTEM_PROMPT)
2. The user prompt builder function: buildClassificationPrompt(draft: ListingDraft): string
3. The Zod schema for the expected JSON response (ClassificationResult)
4. The runClassification(env, draft) function that:
   - Calls Workers AI with temperature 0.1
   - Parses and validates response with Zod
   - On parse failure: retries once with an error-correction prompt
   - On second failure: throws EnrichmentError with the raw response attached
   - Returns ClassificationResult

ClassificationResult must include:
  category_name, ebay_category_id (number), item_type,
  brand (string|null), model (string|null),
  condition_grade (enum: New|Excellent|VeryGood|Good|Fair),
  era_or_year (string|null), primary_material (string|null)

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.3 — AI Enricher: Item Specifics ──────────

Write the ITEM SPECIFICS GENERATION step inside worker/agents/listing/enricher.ts

[PASTE ClassificationResult type from 3.2]

This is the second enrichment step. Runs after classification.

Write:
1. ITEM_SPECIFICS_SYSTEM_PROMPT
2. buildItemSpecificsPrompt(draft, classification): string
3. Zod schema: ItemSpecific = { name: string, value: string }
   Response schema: array of up to 20 ItemSpecifics
4. runItemSpecificsGeneration(env, draft, classification): Promise<ItemSpecific[]>

Rules for the system prompt:
- Instruct the AI to use official eBay Item Specific names for the detected category
- Max 20 pairs
- Values must be from eBay's accepted value lists where applicable
- Temperature: 0.2

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.4 — AI Enricher: Title + Description ─────

Write the TITLE and DESCRIPTION steps inside worker/agents/listing/enricher.ts

[PASTE all previous enricher types]

Two steps, two separate AI calls.

TITLE step:
- System prompt: instructs AI to write an 80-character max eBay title
- Keyword-first structure: [Brand] [Key Spec] [Item Type] [Condition Signal]
- Response schema: { title: string, char_count: number }
- Zod enforcement: char_count <= 80 (reject and retry if over)
- Temperature: 0.5

DESCRIPTION step:
- System prompt: instructs AI to write honest, buyer-protective copy
- Response schema:
  {
    short_description: string,   // 75 words max
    long_description: string,    // 200-400 words  
    condition_details: string,   // specific, honest
    what_is_included: string,    // comma-separated list
    shipping_note: string        // one sentence
  }
- Temperature: 0.6
- No HTML in output — HTML wrapping happens in html-builder.ts separately

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.5 — AI Enricher: Pricing ─────────────────

Write the PRICING SUGGESTION step inside worker/agents/listing/enricher.ts

This is the final enrichment step.

Response schema:
{
  suggested_price: number,
  price_range: [number, number],
  strategy: 'premium' | 'market' | 'competitive' | 'liquidation',
  rationale: string    // one sentence, must include caveat about knowledge cutoff
}

System prompt must:
- Acknowledge AI pricing data may be stale
- Tell AI to flag uncertainty explicitly in rationale
- Never present a price as definitive — always as a suggestion for seller review
- Temperature: 0.3

Write the full orchestrator function at the bottom of the file:
runEnrichmentPipeline(env, draft, onStep): Promise<EnrichedDraft>

This function calls all 5 steps in sequence, calling onStep(stepName) between each.
onStep is the WebSocket broadcast callback from ListingSession DO.
Returns a fully enriched ListingDraft.

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.6 — HTML Builder ─────────────────────────

Write worker/agents/listing/html-builder.ts

[PASTE EnrichedDraft type from 3.5]

This is a pure template engine — no AI calls.
Takes enriched listing data and returns a complete HTML string.

Write:
1. HtmlTemplate enum: 'base' | 'minimal' | 'luxury'
2. buildHTMLDescription(draft, template, imageUrls): string

The base template structure (implement fully in TypeScript string template):
- Inline styles only (no <style> tags, no external CSS)
- No <script> tags
- No <iframe> tags
- No external image URLs that are not https://
- Structure:
  a. Header bar: title + condition badge (dark background, white text)
  b. Two-column body:
     Left 45%: hero image + thumbnail gallery
     Right 55%: item specs table + condition details + what's included
  c. Full-width description section
  d. Footer: shipping policy + store name + SKU

The minimal template: single column, no images in description, text only.
The luxury template: large hero image, centered layout, editorial spacing.

Text escaping: all user-supplied strings must be HTML-escaped before injection.

Validation before return:
- Length < 500,000 chars (eBay limit)
- No <script> present in output
- Hero image URL starts with https://

Output only TypeScript. No prose.


# ── PHASE GEN PROMPT 3.7 — CSV Builder ──────────────────────────

Write worker/agents/listing/csv-builder.ts

[PASTE EnrichedDraft type from 3.5]
[PASTE D1 schema from 1.4]

Two functions:

FUNCTION 1: buildCSVRow(draft, imageUrls, config): EbayCSVRow
Maps the enriched draft to a single flat object matching eBay File Exchange columns.

Required column mappings:
- Action → 'Add'
- SiteID → from config.ebay_marketplace
- CustomLabel → draft.sku
- Category → draft.fields.ebay_category_id
- ConditionID → map from condition_grade string to eBay numeric ID:
    New=1000, Excellent=3000, VeryGood=4000, Good=5000, Fair=6000
- Title → draft.fields.title (enforce 80 char max, hard truncate + log if over)
- Description → the full HTML string from html-builder (will be CSV-escaped)
- Format → 'FixedPrice'
- Duration → 'GTC'
- StartPrice → draft.fields.suggested_price
- Quantity → 1 (always — OOAK enforcement)
- PicURL → imageUrls joined with pipe character '|'
- ItemSpecific(1-20):Name and ItemSpecific(1-20):Value → from draft.fields.itemSpecifics

Validate the completed row with a Zod EbayCSVRow schema before returning.
Throw CSVValidationError with field-level errors if invalid.

FUNCTION 2: buildCSVFile(rows): string
Takes array of EbayCSVRow, returns a complete CSV string.
CSV escaping rules:
- Fields containing comma, double-quote, or newline: wrap in double quotes
- Embedded double quotes: escape as ""
- The Description field (HTML) must always be wrapped in quotes
- Output uses \n line endings

Output only TypeScript. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 4 — PHASE IMPLEMENTATION                                 ║
║  Agent: phaseImplementation                                     ║
║  Model: GEMINI_3_FLASH_PREVIEW                                  ║
╚══════════════════════════════════════════════════════════════════╝

# ── IMPL PROMPT 4.1 — Browser: eBay Login Manager ───────────────

Write worker/agents/browser/ebay-login.ts

[PASTE Env interface from 1.6]

This file manages eBay session cookies for browser automation.

IMPORTANT CONSTRAINT:
Do NOT automate the eBay login form with stored username/password.
eBay has anti-automation detection (CAPTCHA, 2FA, device fingerprinting).
The session strategy is:
1. Seller logs in manually once via a visible browser window
2. We capture the resulting .ebay.com cookies
3. Store cookies in KV_SESSIONS with 20-hour TTL
4. Restore cookies on each browser job to skip login

Write these functions:
- getAuthenticatedPage(env, browser): Promise<Page>
  Restores cookies if valid session exists. 
  Throws LoginRequiredError if session is expired or missing.

- captureSessionCookies(page, env): Promise<void>
  Saves all .ebay.com domain cookies to KV_SESSIONS.

- isSessionValid(env): Promise<boolean>
  Checks KV for saved cookies and TTL.

- clearSession(env): Promise<void>
  Deletes saved cookies from KV.

Define LoginRequiredError as a typed error class with:
- message: "eBay session expired. Re-authenticate via Settings."
- code: 'LOGIN_REQUIRED'

Output only TypeScript. No prose.


# ── IMPL PROMPT 4.2 — Browser: CSV Uploader ─────────────────────

Write worker/agents/browser/ebay-uploader.ts

[PASTE Env interface from 1.6]
[PASTE BrowserSession state type from 2.5]

This file automates the eBay File Exchange CSV upload.
Target URL: https://bulksell.ebay.com/ws/eBayISAPI.dll?FileExchangeCenter

Write uploadCSVToSellerHub(browser, csvR2Key, env, jobId, onStep):

Steps to automate (each step calls onStep() before executing):
1. "Launching browser page..."
   setViewport 1280x900
2. "Navigating to File Exchange..."
   goto FileExchange URL, waitUntil networkidle0, timeout 30s
   captureScreenshot(page, env, jobId, '01-fileexchange-loaded')
3. "Reading CSV from storage..."
   Fetch CSV ArrayBuffer from R2
4. "Attaching CSV file..."
   Find input[type="file"] — throw BrowserAutomationError if not found
   Upload file buffer with name listing-export-{jobId}.csv, mimeType text/csv
   captureScreenshot(page, env, jobId, '02-file-attached')
5. "Submitting to eBay..."
   Find and click submit button
   waitForNavigation networkidle0, timeout 60s
   captureScreenshot(page, env, jobId, '03-submitted')
6. "Reading eBay response..."
   Extract page body text
   Run parseFileExchangeResult() on body text
   captureScreenshot(page, env, jobId, '04-result')

Write parseFileExchangeResult(bodyText): UploadResult
Extracts: successCount, errorCount, errorMessages[]
Use string matching on known eBay response patterns.

Write captureScreenshot(page, env, jobId, stepName): Promise<string>
Saves PNG to R2 at path: screenshots/{jobId}/{stepName}.png
Returns the R2 key.

Puppeteer timing rules:
- Add randomDelay(500, 1500) between interactions (anti-detection)
- Never click faster than a human would
- All page.waitFor calls have explicit timeouts

Define randomDelay(min, max): Promise<void> using setTimeout.

Output only TypeScript. No prose.


# ── IMPL PROMPT 4.3 — Social: TikTok Generator ──────────────────

Write worker/agents/social/tiktok.ts

[PASTE EnrichedDraft type from 3.5]
[PASTE Env interface from 1.6]

Define these types (export them):

interface TikTokScript {
  duration: '15s' | '30s' | '60s'
  segments: Array<{
    timestamp: string      // "0:00-0:03"
    voiceover: string      // exact words to say out loud
    visual: string         // what to show on camera
    text_overlay: string | null
  }>
}

interface TikTokVideoBrief {
  shots: Array<{
    shot_name: string
    duration_seconds: number
    camera_angle: string
    lighting_note: string
  }>
  props_needed: string[]
  estimated_film_minutes: number
}

interface TikTokPackage {
  hook: string               // opening line that stops scroll — max 12 words
  script: TikTokScript
  video_brief: TikTokVideoBrief
  caption: string            // in-app caption, max 150 chars before truncation
  hashtags: string[]         // 15-20 tags
  audio_vibe: string         // describe ideal background audio in one phrase
  cta_overlay: string        // text shown in last 3 seconds
}

Write TIKTOK_SYSTEM_PROMPT:
- Direct, specific, honest tone
- No fake surprise, no "POV:", no "Wait for it"
- Hook states the item, the rarity, or the deal immediately
- Condition described accurately (never upgrade condition in copy)
- For pre-owned: lean into story, provenance, investment angle
- For new/commodity: lead with the deal and the spec

Write generateTikTokPackage(env, draft): Promise<TikTokPackage>
- Temperature: 0.7 (creative but controlled)
- Validate response with Zod TikTokPackage schema
- Retry once on parse failure

Output only TypeScript. No prose.


# ── IMPL PROMPT 4.4 — Social: Pinterest Generator ───────────────

Write worker/agents/social/pinterest.ts

[PASTE EnrichedDraft type from 3.5]
[PASTE Env interface from 1.6]

Define these types (export them):

interface PinterestPin {
  title: string          // 100 chars max — keyword-rich, searchable
  description: string    // 500 chars max — include price, keywords, soft CTA
  alt_text: string       // for SEO + accessibility
  destination_url: string
}

interface IdeaPinSlide {
  slide_number: number
  image_role: string     // "hero shot" | "detail close-up" | "scale reference"
  text_overlay: string   // short text shown on slide
  voiceover: string | null
}

interface PinterestBoardStrategy {
  primary_board: string
  secondary_boards: string[]
  new_board_suggestion: string | null
  pin_schedule: string   // e.g. "Pin 3x over 2 weeks, 7–9pm ET"
}

interface PinterestPackage {
  primary_pin: PinterestPin
  board_strategy: PinterestBoardStrategy
  idea_pin_slides: IdeaPinSlide[]    // 3-5 slides
  seo_keywords: string[]             // 8-12 long-tail keywords
}

Write PINTEREST_SYSTEM_PROMPT:
- Pinterest is a search engine, not a social network
- Buyers are planners — optimize for saves, not likes
- Include price in pin description naturally
- Long-tail keywords: "vintage gold ring gift for her" not "ring"
- Board strategy must be specific to item type and style era

Write generatePinterestPackage(env, draft): Promise<PinterestPackage>
- Temperature: 0.6
- Validate with Zod

Output only TypeScript. No prose.


# ── IMPL PROMPT 4.5 — React: Phase Progress Component ───────────

Write frontend/app/components/listing/PhaseProgress.tsx

This component is the core UX of the application.
It receives WebSocket events from the ListingSession Durable Object
and renders the Vibe-style step-by-step build experience.

Props:
  listingId: string
  onComplete: (fields: Record<string, unknown>) => void

Steps to render in order:
  1. "Reading your item..."
  2. "Identifying category..."
  3. "Extracting item details..."
  4. "Completing missing fields..."
  5. "Writing your title..."
  6. "Writing listing copy..."
  7. "Suggesting a price..."
  8. "Building HTML description..."
  9. "Processing images..."
  10. "Assembling eBay CSV row..."
  11. "Generating TikTok script..."
  12. "Generating Pinterest pins..."
  13. "Ready."

For each step render:
- Pending: grey circle icon
- Running: spinning ring (CSS animation, no library)
- Complete: filled checkmark, step output previewed inline
  (title shows the actual title text, price shows the number, etc.)
- Error: red X with error message + "Retry" button

Use Tailwind utility classes only.
Dark theme background: bg-[#111318]
Text: text-[#E8EAF0] primary, text-[#8890A4] secondary
Accent: text-[#E53238] for eBay red, text-[#3B82F6] for action blue

Connect to WebSocket: ws://{host}/api/session/{listingId}
Handle reconnect on disconnect.

Output only TypeScript JSX. No prose.


# ── IMPL PROMPT 4.6 — React: HTML Preview Component ─────────────

Write frontend/app/components/listing/HtmlPreview.tsx

Props:
  html: string
  onEdit: (newHtml: string) => void
  onTemplateChange: (template: 'base' | 'minimal' | 'luxury') => void
  onRegenerate: () => void

Render:
1. Toolbar row above the iframe:
   - Template toggle: [Base] [Minimal] [Luxury] — active tab highlighted
   - [Mobile Preview] toggle — sets iframe to 375px width
   - [Edit HTML] button — opens html in a code editor below iframe
   - [Regenerate] button — calls onRegenerate
   - Character count: "X / 500,000 chars" in muted text

2. Sandboxed iframe:
   <iframe
     srcDoc={html}
     sandbox="allow-same-origin"
     title="eBay listing preview"
   />
   iframe is full width, minimum height 500px

3. Code editor (shown only when Edit HTML active):
   Use a <textarea> with monospace font as the editor (no Monaco dependency)
   Auto-resize to content height
   Calls onEdit on every change (debounced 500ms)

Use Tailwind only. Match dark theme from 4.5.

Output only TypeScript JSX. No prose.


# ── IMPL PROMPT 4.7 — React: Upload Job Monitor ─────────────────

Write frontend/app/components/browser/UploadJobPanel.tsx

Props:
  jobId: string
  exportId: string

This component connects via WebSocket to the BrowserSession DO
and renders live upload progress.

Display:
1. Status header: job ID (truncated) + status badge
   Status badge colors:
   - idle: grey
   - launching: yellow (pulsing)
   - uploading: blue (pulsing)
   - done: green
   - error: red

2. Step list — each step shows as it happens:
   ✓ Browser launched
   ✓ Navigated to File Exchange
   ✓ CSV file attached
   ⟳ Waiting for eBay validation...  (spinning when current)
   ○ Reading results
   ○ Confirming listings live

3. Screenshot gallery — horizontal scroll strip
   Each screenshot appears as a thumbnail as its R2 key arrives
   Clicking a thumbnail opens it full size in a modal
   
4. Result summary (shown on completion):
   "N listings submitted successfully"
   "N errors" (if any) with error messages expandable

5. Error state: full error message + last screenshot + "Retry" button

Connect to WebSocket: ws://{host}/api/browser/{jobId}

Output only TypeScript JSX. No prose.


# ── IMPL PROMPT 4.8 — React: Social Content Studio ──────────────

Write frontend/app/routes/social/[id].tsx

[PASTE TikTokPackage type from 4.3]
[PASTE PinterestPackage type from 4.4]

Full-page social content studio for one listing.

Layout: Two columns, equal width, side by side on desktop, stacked on mobile.

LEFT COLUMN — TikTok:
- Section header: "TikTok" with platform color accent
- Hook displayed large (24px, prominent)
- Script as a timeline table:
  Columns: Time | Voiceover | Visual | Overlay
  Each row is one segment
- Video brief as a checklist (seller checks off shots as they film)
- Action bar at bottom:
  [Copy Script] [Copy Caption] [Copy Hashtags] [Copy All]
- Caption character counter: shows 150-char preview cutoff visually
- Hashtag chips displayed as tags

RIGHT COLUMN — Pinterest:
- Section header: "Pinterest" with platform color accent
- Pin preview card (simulated Pinterest card layout):
  Image placeholder, title, description preview
- Board strategy as ordered list (primary board first)
- Idea Pin slides as numbered sequence with slide content
- SEO keywords as chips
- Action bar: [Copy Pin Title] [Copy Description] [Copy All]

Regenerate button top right: triggers fresh social generation for this listing.

Output only TypeScript JSX. No prose.


╔══════════════════════════════════════════════════════════════════╗
║  PHASE 5 — DEBUGGER / CODE FIXER                                ║
║  Agent: deepDebugger                                            ║
║  Model: GEMINI_3_FLASH_PREVIEW (high reasoning)                 ║
╚══════════════════════════════════════════════════════════════════╝

# ── DEBUG PROMPT 5.1 — Type Audit ───────────────────────────────

Audit every TypeScript file in the project for type safety.

[PASTE all files generated in phases 2-4]

Check:
1. No implicit `any` types anywhere
2. Every function has explicit return type annotations
3. Every Workers AI response is validated through Zod before use
4. Every D1 query result is validated through Zod before use
5. Every Durable Object state read is validated through Zod before use
6. The Env interface matches every binding in wrangler.toml exactly
7. All imports resolve (no missing modules)

For each issue found output:
{
  "file": "path/to/file.ts",
  "line": 0,
  "issue": "description",
  "fix": "exact code replacement"
}

Fix every issue. Output corrected files only (skip files with no changes).


# ── DEBUG PROMPT 5.2 — CSV Escaping Validation ──────────────────

Validate the CSV escaping logic in worker/agents/listing/csv-builder.ts

[PASTE csv-builder.ts from 3.7]

Test these edge cases mentally and fix any that would produce invalid CSV:

1. Title contains a comma: "Ring, Vintage Gold, Size 7"
2. Title contains double quotes: 'Bracelet 8" Length'
3. HTML description contains double quotes (very common)
4. HTML description contains newlines (always present in multi-line HTML)
5. HTML description contains commas (always present)
6. Item Specific value is empty string
7. PicURL contains only one image (no pipe needed)
8. PicURL contains 24 images (maximum, pipe-separated)
9. StartPrice is 0.00 (free item — should this be allowed?)
10. Title is exactly 80 characters (boundary condition)
11. Title is 81 characters (must truncate — confirm truncation is logged)

For each edge case: state whether current code handles it correctly.
If not: provide the fix.
Output corrected escapeCSVField() and buildCSVFile() functions if changes needed.


# ── DEBUG PROMPT 5.3 — Browser Automation Error Paths ───────────

Audit worker/agents/browser/ebay-uploader.ts for missing error handling.

[PASTE ebay-uploader.ts from 4.2]

For each step in uploadCSVToSellerHub, verify:
1. What happens if page.goto() times out?
2. What happens if the file input element is not found?
   (eBay may change their UI — must handle gracefully)
3. What happens if the submit button is not found?
4. What happens if waitForNavigation times out after submit?
5. What happens if R2.get() returns null (CSV file missing)?
6. What happens if parseFileExchangeResult finds no recognizable pattern?
   (eBay may return an error page instead of the expected result page)
7. What happens if captureScreenshot fails?
   (R2 outage — must not prevent the rest of the job from completing)

For each gap: write the missing try/catch or null-check.
Screenshot failures must be non-blocking (log warning, continue job).
All other failures must: update DO state, broadcast error via WebSocket, 
log to D1 dispatch_log, then throw so the Queue retries.

Output corrected uploadCSVToSellerHub function only.


# ── DEBUG PROMPT 5.4 — WebSocket Reconnect Logic ────────────────

Audit frontend/app/components/listing/PhaseProgress.tsx
and frontend/app/components/browser/UploadJobPanel.tsx

[PASTE both components from 4.5 and 4.7]

Both components connect to WebSockets via Durable Objects.
Verify and fix the following:

1. What happens if the WebSocket disconnects mid-build?
   Must: attempt reconnect with exponential backoff (1s, 2s, 4s, max 30s)
   Must: show reconnecting status to user (not a blank/broken UI)
   Must: on reconnect, request current state from DO to re-sync missed events

2. What happens if the component unmounts while WebSocket is open?
   Must: close the WebSocket connection cleanly in useEffect cleanup

3. What happens if the server sends a message type the client doesn't recognize?
   Must: log unknown type, do not crash

4. What happens if WebSocket message is not valid JSON?
   Must: catch JSON.parse error, log, do not crash

Write a shared useWebSocket(url, onMessage, onReconnect) hook in
frontend/app/hooks/useWebSocket.ts that both components use.
This eliminates the duplicate reconnect logic.

Output: the new useWebSocket.ts hook + corrected versions of both components.


# ── DEBUG PROMPT 5.5 — Final Integration Check ──────────────────

Perform a final end-to-end integration audit.

[PASTE all files from phases 2-4 plus all debug fixes from 5.1-5.4]

Trace the complete happy path:

1. Seller types "Vintage Levi's 501 jeans, size 32x30, faded wash, 
   no rips, original orange tab" into the intake form
2. IntakeForm.tsx calls POST /api/listings with the raw text
3. Worker creates ListingDraft, instantiates ListingSession DO, returns listing ID
4. PhaseProgress.tsx connects WebSocket to ListingSession DO
5. Worker calls runEnrichmentPipeline() — each step broadcasts via DO
6. PhaseProgress.tsx renders each step as it completes
7. html-builder.ts generates HTML description, stored in D1 listing_html
8. csv-builder.ts generates CSV row, stored in D1 (as JSON in listing_fields)
9. TikTok and Pinterest packages generated, stored in D1 social_content
10. Seller sees complete listing: HTML preview, TikTok script, Pinterest pins
11. Seller goes to Export, selects this listing, clicks "Generate CSV"
12. Worker assembles CSV file, stores in R2, creates csv_exports record
13. Seller clicks "Auto-Upload to eBay"
14. Worker enqueues browser job to QUEUE_BROWSER
15. Queue consumer picks up job, instantiates BrowserSession DO
16. UploadJobPanel.tsx connects WebSocket to BrowserSession DO
17. BrowserSession launches Puppeteer, navigates to File Exchange
18. CSV uploaded, screenshots captured at each step
19. eBay returns success response
20. upload_jobs record updated to 'upload_complete'
21. listing_platforms record created, listing status updated to 'live'

For each step: confirm the function/file that handles it exists and is wired correctly.
List any broken connections (function exists but is not called, route registered 
but handler missing, DO method defined but never invoked, etc.)
For each broken connection: write the minimal fix.

Output: list of issues found + fixes. If no issues: confirm "integration complete."