# PHASE 5 — QUEUE CONSUMERS & SOCIAL CONTENT
## Async Platform Publishing + Content Generation

### Overview

Queue jobs from Phase 4 need consumers that actually execute:
- **DISPATCH_QUEUE** → Platform-specific publishers
- **MEDIA_QUEUE** → Image processing tasks  
- **SOCIAL_QUEUE** → Content generation (TikTok, Pinterest, Instagram)

### Implementation Strategy

#### 5.1 eBay CSV + Browser Upload

**File**: `worker/agents/dispatch/ebay-dispatcher.ts`

```typescript
// Process job from DISPATCH_QUEUE
// 1. Build eBay File Exchange CSV row from listing
// 2. Upload CSV to eBay Seller Hub via browser automation
// 3. Handle login, navigation, file upload, submission
// 4. Store publish result in D1 dispatch_logs
```

#### 5.2 API-Based Publishers

**Files**:
- `worker/agents/dispatch/shopify-dispatcher.ts`
- `worker/agents/dispatch/etsy-dispatcher.ts`
- `worker/agents/dispatch/facebook-dispatcher.ts`

```typescript
// 1. Get Shopify access token from KV_CONFIG
// 2. Call Shopify REST API /products (POST)
// 3. Map listing fields to Shopify product schema
// 4. Store published_url + external_id in D1
// 5. Handle errors, retry logic
```

#### 5.3 Social Media Content Generators

**Files**:
- `worker/agents/social/tiktok-generator.ts`
- `worker/agents/social/pinterest-generator.ts`
- `worker/agents/social/instagram-generator.ts`

```typescript
// TikTok:
// - Generate short video script (15-30 sec)
// - Suggest product clips from images
// - Create trending music recommendations
// - Store script + specs in D1

// Pinterest:
// - Generate pin copy (optimized for search)
// - Design specifications (dimensions, text placement)
// - Trending hashtags for jewelry category
// - Store pin specs in D1

// Instagram:
// - Generate carousel captions (slide 1-5)
// - Hashtag strategy (#jewelry #preowned #vintage)
// - Engagement hooks
// - CTA for Link in Bio
```

#### 5.4 Queue Consumer Entry Points

**File**: `worker/queues/handlers.ts`

```typescript
export async function dispatchQueueHandler(batch) {
  for (const job of batch.messages) {
    switch (job.body.type) {
      case 'ebay_upload':
        await handleEbayUpload(job.body);
        break;
      case 'shopify_create_product':
        await handleShopifyCreate(job.body);
        break;
      // ... other platforms
    }
  }
}

export async function socialQueueHandler(batch) {
  for (const job of batch.messages) {
    switch (job.body.type) {
      case 'tiktok_generate_content':
        await generateTikTokContent(job.body);
        break;
      // ... other social platforms
    }
  }
}
```

#### 5.5 React Dashboard

**Files**:
- `src/pages/Dashboard.tsx` - Overview, recent uploads, stats
- `src/pages/NewListing.tsx` - Folder upload + live progress
- `src/pages/Inventory.tsx` - Listing grid with status badges
- `src/pages/Platforms.tsx` - Platform connections, test publishing
- `src/components/UploadZone.tsx` - Drag-drop with progress bar
- `src/components/ListingPreview.tsx` - Platform-specific preview
- `src/hooks/useListingSession.ts` - WebSocket real-time updates

```tsx
// NewListing flow:
// 1. Drag-drop folder or select images
// 2. Enter product description (or use AI to extract from images)
// 3. Submit → POST /api/listings (create draft)
// 4. WebSocket connects to /api/session/:id
// 5. See enrichment progress in real-time
// 6. Review auto-generated titles, descriptions, pricing
// 7. Edit or approve
// 8. Choose platforms
// 9. POST /api/dispatch/publish
// 10. Watch dispatch status per platform
```

### Phase 5 Deliverables

#### Backend
- [x] Dispatch orchestrator (Phase 4)
- [ ] eBay CSV publisher + browser automation
- [ ] Shopify REST API consumer
- [ ] Etsy REST API consumer  
- [ ] Facebook Graph API consumer
- [ ] TikTok content generator
- [ ] Pinterest content generator
- [ ] Instagram content generator
- [ ] Queue consumer entry points
- [ ] Error handling + retry logic
- [ ] Dispatch logging to D1

#### Frontend
- [ ] Dashboard page with stats
- [ ] New listing page with folder upload
- [ ] Inventory page with listing grid
- [ ] Platforms connection page
- [ ] Real-time progress updates via WebSocket
- [ ] Platform-specific preview
- [ ] Dispatch status tracker

### Success Criteria

- [ ] Upload folder → enriched listing → all 10 platforms queued
- [ ] eBay CSV uploaded via browser automation
- [ ] Shopify product created via REST API
- [ ] Etsy listing created via REST API
- [ ] Facebook marketplace post created
- [ ] TikTok script + specs generated
- [ ] Pinterest pin copy + design specs generated
- [ ] Instagram carousel captions generated
- [ ] Real-time WebSocket progress updates
- [ ] Dashboard shows all listings and their platform status
- [ ] Can see published URLs on each platform

### Testing Checklist

```bash
# Test eBay upload
curl -X POST http://localhost:8787/api/dispatch/publish \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"test-123","platforms":["ebay"]}'

# Test Shopify  
curl -X POST http://localhost:8787/api/dispatch/publish \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"test-123","platforms":["shopify"]}'

# Test social
curl -X POST http://localhost:8787/api/dispatch/publish \
  -H "Content-Type: application/json" \
  -d '{"listing_id":"test-123","platforms":["tiktok","pinterest"]}'

# Check dispatch status
curl http://localhost:8787/api/dispatch/status/test-123
```

### API Documentation (Stub)

#### POST /api/dispatch/publish
Publish listing to specified platforms

**Request**:
```json
{
  "listing_id": "prod-uuid",
  "platforms": ["ebay", "shopify", "tiktok"]
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "listing_id": "prod-uuid",
    "results": [
      {
        "platform": "ebay",
        "status": "queued",
        "job_id": "ebay-prod-uuid-123456"
      },
      {
        "platform": "shopify",
        "status": "queued",
        "job_id": "shopify-prod-uuid-123456"
      },
      {
        "platform": "tiktok",
        "status": "queued",
        "job_id": "tiktok-prod-uuid-123456"
      }
    ],
    "queued_count": 3
  }
}
```

#### GET /api/dispatch/status/:listing_id
Get dispatch status across all platforms

**Response**:
```json
{
  "success": true,
  "data": {
    "listing_id": "prod-uuid",
    "overall_status": "in_progress",
    "platforms": {
      "ebay": {
        "status": "published",
        "job_id": "ebay-prod-uuid-123456",
        "external_id": "12345678901",
        "url": "https://www.ebay.com/itm/12345678901",
        "published_at": "2026-03-08T12:00:00Z"
      },
      "shopify": {
        "status": "in_progress",
        "job_id": "shopify-prod-uuid-123456",
        "error": null
      },
      "tiktok": {
        "status": "pending",
        "job_id": "tiktok-prod-uuid-123456",
        "content": {
          "script": "...",
          "duration_seconds": 20,
          "music_suggestions": [...]
        }
      }
    }
  }
}
```
