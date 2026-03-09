# PHASE 4 — FULL PIPELINE IMPLEMENTATION
## Folder Upload → AI Models → Multi-Platform Dispatch → Media Creation

### Architecture Overview

```
User Upload Folder
       ↓
┌──────────────────────────────────────────────┐
│   ListingSession DO (Stateful)               │
│   - Tracks enrichment progress                │
│   - Broadcasts phase updates via WebSocket    │
│   - Manages file uploads via R2               │
└──────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────┐
│   ENRICHMENT PIPELINE (Worker AI)            │
│   1. Ingest raw images + description         │
│   2. Classification (Llama 3.3)              │
│   3. Field Extraction (Llama 3.3)            │
│   4. Field Completion (Llama 3.3)            │
│   5. Title Generation (Platform-specific)    │
│   6. Description Generation (HTML/Markdown)  │
│   7. Pricing Strategy (Market analysis)      │
│   8. Image Processing (Background removal)   │
└──────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────┐
│   LISTING ASSEMBLY                           │
│   - Generate SKU (CJP-CATEGORY-YYMM-SEQ)     │
│   - Build eBay CSV row                       │
│   - Build HTML description                   │
│   - Store complete listing in D1             │
└──────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────┐
│   MULTI-PLATFORM DISPATCH                    │
│   - Queue publishing jobs (Queues)           │
│   - Browser automation for eBay upload       │
│   - API calls for Shopify, Etsy, Facebook    │
│   - Social queues for TikTok, Pinterest      │
└──────────────────────────────────────────────┘
       ↓
┌──────────────────────────────────────────────┐
│   MEDIA CONTENT GENERATION                   │
│   - TikTok: Video script + product clips     │
│   - Pinterest: Pin copy + design specs       │
│   - Instagram: Carousel captions + hashtags  │
│   - Facebook: Listing description + CTA      │
└──────────────────────────────────────────────┘
```

### Phase 4 Implementation Tasks

#### 4.1 Image Processing Pipeline
- **File**: `worker/agents/media/processor.ts`
- **Tasks**:
  - Extract images from upload folder
  - Validate formats (JPG, PNG, WebP)
  - Remove backgrounds (@cf/bria/rmbg)
  - Generate platform-specific sizes
  - Store optimized versions in R2
  - Update ListingSession with progress

#### 4.2 Platform-Specific Output Builders
- **Files**:
  - `worker/agents/platforms/ebay/csv-generator.ts` (Phase 3 - enhance)
  - `worker/agents/platforms/shopify/listing-builder.ts` (new)
  - `worker/agents/platforms/etsy/listing-builder.ts` (new)
  - `worker/agents/platforms/facebook/marketplace-builder.ts` (new)

#### 4.3 Dispatch System
- **Files**:
  - `worker/agents/dispatch/index.ts` (main orchestrator)
  - `worker/agents/dispatch/ebay-dispatcher.ts` (CSV + browser)
  - `worker/agents/dispatch/api-dispatcher.ts` (Shopify, Etsy, Facebook)
  - `worker/agents/dispatch/social-dispatcher.ts` (TikTok, Pinterest)

#### 4.4 Social Media Content Generation
- **Files**:
  - `worker/agents/social/tiktok-scripter.ts`
  - `worker/agents/social/pinterest-designer.ts`
  - `worker/agents/social/instagram-captioner.ts`

#### 4.5 React Frontend Dashboard
- **Files**:
  - `src/pages/Dashboard.tsx`
  - `src/pages/NewListing.tsx` (drag-drop folder upload)
  - `src/pages/Inventory.tsx` (listing grid)
  - `src/pages/Platforms.tsx` (platform connections)
  - `src/components/UploadZone.tsx`
  - `src/components/ListingPreview.tsx`
  - `src/hooks/useListingSession.ts` (WebSocket)

### Leverage Vibe SDK Systems

#### Durable Objects (Stateful)
- **ListingSession DO**:
  - Persists enrichment state
  - Broadcasts via WebSocket to connected clients
  - Prevents concurrent builds (build lock)
  - Stores intermediate results in storage.put()

#### AI Gateway
- All Llama calls go through @cf/meta/llama-3.3-70b-instruct-fp8-fast
- Free tier: 10k tokens/day
- Rate limiting via KV (TOKENS namespace)
- Fallback model if rate limited

#### Queues
- **DISPATCH_QUEUE**: Publishing jobs to platforms
- **MEDIA_QUEUE**: Image processing tasks
- **SOCIAL_QUEUE**: Content generation tasks

#### KV Storage
- **CONFIG**: Platform credentials, API keys
- **TOKENS**: Rate limit tracking
- **BROWSER_CACHE**: Cached eBay session cookies
- **SESSIONS**: WebSocket session tickets

#### D1 Database
- Listings table (complete enriched listing)
- Media assets (image metadata + R2 paths)
- Platform outputs (published URLs per platform)
- Dispatch logs (what got sent where and when)

### Phase 4 Success Criteria

- [ ] Single folder upload → complete enriched listing
- [ ] Listing publishable to all 10 platforms with one click
- [ ] WebSocket broadcasts enrichment progress in real-time
- [ ] Platform-specific media generated automatically
- [ ] No manual data entry required
- [ ] Image processing handles all common formats
- [ ] CSS/HTML listings render correctly on platforms
- [ ] Social content ready to post immediately after enrichment

### Phase 4 Deliverables

1. **Full pipeline working locally** (wrangler dev)
2. **Folder upload → D1 listing** working
3. **Multi-platform dispatch queued** (not yet executed)
4. **React dashboard** showing listing preview
5. **WebSocket** real-time progress updates
6. **Types** for all platform-specific outputs
7. **Validation** with Zod for each stage
8. **Error handling** + retry logic for failed platforms

### Notes

- Use the phase system from ListingSessionState to track progress
- Each model call should update a phase: "classifying", "extracting", "generating_titles", etc
- Broadcast to WebSocket after each phase
- Store AI outputs in D1 for audit trail
- Generate SKU after classification (we know the category)
- Image processing happens in parallel with text enrichment
- Social content generation is separate queue (Phase 5)
