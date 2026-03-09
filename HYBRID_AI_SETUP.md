# Hybrid AI Pipeline — Cloudflare Models + BYOK Support

## Overview
The enrichment pipeline automatically switches between:
- ✅ **Cloudflare Models** (free tier, always available)
- ✅ **OpenAI Gateway BYOK** (if configured, higher quality)

## Architecture

```
┌─────────────────┐
│   Upload Text   │
│   or Images     │
└────────┬────────┘
         │
         ├─→ HybridAIPipeline
         │   ├─→ Check BYOK configured?
         │   │   └─→ Yes: Use OpenAI Gateway
         │   │   └─→ No: Use Cloudflare Models
         │   └─→ Fallback: Cloudflare on error
         │
         ├─→ Vision Analysis (if image)
         ├─→ Title Generation
         ├─→ Description Writing
         ├─→ Price Suggestion
         └─→ Item Specifics Extraction
         │
         └─→ Store in D1 + R2
```

## Components

### 1. CloudflareAIPipeline (`worker/lib/ai-cloudflare.ts`)
Uses Cloudflare Workers AI (free tier):
- Model: `@cf/meta/llama-2-7b-chat-int8` (Llama 2 7B)
- No API keys needed
- Rate limits: ~10 req/min per worker
- Fallback for text-only enrichment

### 2. AIPipeline (`worker/lib/ai-pipeline.ts`)
Uses OpenAI Gateway (BYOK):
- Models: GPT-4V (vision), GPT-4 (text)
- Requires: `AI_GATEWAY_URL` environment variable
- Higher quality output
- Full vision analysis support

### 3. HybridAIPipeline (`worker/lib/ai-hybrid.ts`)
Smart router that:
- Auto-detects BYOK configuration
- Falls back gracefully on errors
- Prefers Cloudflare for text (faster)
- Uses BYOK for images (better quality)

## API Endpoints

### 1. Text Enrichment (Fastest)
```bash
curl -X POST https://your-worker.dev/api/enrich/text \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Vintage 14K gold ring with diamond",
    "folder": "vintage-rings"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listing_id": "uuid",
    "title": "Vintage 14K Gold Diamond Ring",
    "description": "<p>Beautiful vintage...</p>",
    "price_suggested": 299.99,
    "item_specifics": {
      "Type": "Ring",
      "Material": "14K Gold",
      "Condition": "Excellent"
    },
    "provider": "cloudflare-models"
  }
}
```

### 2. Single Image Enrichment
```bash
curl -X POST https://your-worker.dev/api/enrich/image \
  -F "image=@jewelry.jpg" \
  -F "folder=vintage-rings"
```

Uses:
- BYOK if configured → Full vision + LLM analysis
- Fallback to Cloudflare → Text-based enrichment

### 3. Batch Folder Processing
```bash
curl -X POST https://your-worker.dev/api/enrich/folder \
  -F "images=@ring1.jpg" \
  -F "images=@ring2.jpg" \
  -F "images=@necklace.jpg"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "failed": 0,
    "total": 3,
    "provider": {
      "byok_configured": false,
      "cloudflare_available": true,
      "preferred_provider": "cloudflare"
    },
    "results": [...]
  }
}
```

### 4. Provider Status
```bash
curl https://your-worker.dev/api/enrich/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": {
      "byok_configured": false,
      "cloudflare_available": true,
      "preferred_provider": "cloudflare"
    },
    "endpoints": {
      "text": "POST /api/enrich/text — Fast, no image needed",
      "image": "POST /api/enrich/image — BYOK if available, falls back to Cloudflare",
      "folder": "POST /api/enrich/folder — Batch processing"
    },
    "note": "Using Cloudflare Models - free tier"
  }
}
```

## Configuration

### Option 1: Cloudflare Models Only (Default)
No additional setup needed. Works out of the box.

```bash
# Check status
curl https://your-worker.dev/api/enrich/info
```

### Option 2: Enable BYOK (Optional Upgrade)
1. Set API key:
```bash
wrangler secret put OPENAI_API_KEY
# Enter your sk-... key
```

2. Verify wrangler config has AI_GATEWAY_URL:
```jsonc
// wrangler.jsonc
{
  "vars": {
    "AI_GATEWAY_URL": "https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY_ID}/openai"
  }
}
```

3. Redeploy:
```bash
wrangler deploy
```

4. Check status:
```bash
curl https://your-worker.dev/api/enrich/info
# Should show: "byok_configured": true
```

## Performance

### Cloudflare Models
- **Text Enrichment:** 2-5 seconds
- **Cost:** Free (included in Workers tier)
- **Rate Limit:** ~10 req/min per worker

### OpenAI Gateway (BYOK)
- **Text Enrichment:** 3-8 seconds
- **Image Analysis:** 5-15 seconds
- **Cost:** ~$0.01-0.05 per image
- **Rate Limit:** Depends on tier (3,500+ req/min typical)

## Quality Comparison

| Feature | Cloudflare | BYOK |
|---------|-----------|------|
| Title Generation | Good | Excellent |
| Description | Good | Excellent |
| Pricing Suggestions | Conservative | Market-aware |
| Image Analysis | Text-based fallback | Full vision |
| Material Detection | Keyword-based | AI vision |
| Condition Assessment | Text-based | Visual analysis |
| Cost | Free | $0.01-0.05/item |

## Failure & Fallback Behavior

```
Text Enrichment Request:
1. Try Cloudflare Models
2. If error → Fallback to minimal enrichment
   - Title from first sentence
   - Description wrapped in <p>
   - Price: $79
   - Return what we can

Image Enrichment Request (BYOK configured):
1. Try OpenAI Gateway (vision)
2. If error → Try Cloudflare Models
3. If error → Return error response
```

## Database Schema

All enrichments store to these tables:

### listings
```sql
id, sku, status='ready', title, description, price_final, created_at, updated_at
```

### listing_fields
```sql
id, listing_id, key, value, ai_suggested=1, created_at
```

### media_assets (images only)
```sql
id, listing_id, r2_key, original_filename, mime_type, size_bytes, status='processed'
```

## SDK Integration

The Vibe SDK (`sdk/`) can be used to:
- Build custom enrichment workflows
- Create agents for marketplace publishing
- Implement custom validation rules
- Build UI components for the enrichment flow

Example:
```ts
import { PhasicClient } from '@cf-vibesdk/sdk';

const client = new PhasicClient({
  baseUrl: 'https://build.cloudflare.dev',
  apiKey: process.env.VIBESDK_API_KEY!,
});

// Build enrichment agent
const session = await client.build(
  'Build an enrichment agent that takes jewelry images and generates eBay listings'
);
```

## Monitoring & Logging

Check worker logs:
```bash
wrangler tail
```

Look for:
- `[HybridAI]` — Provider selection
- `[CloudflareAI]` — Using Cloudflare Models
- `[AIPipeline]` — Using BYOK

## Troubleshooting

### "No AI provider configured"
- **Cause:** Cloudflare Models disabled, BYOK not set
- **Fix:** Contact support to enable AI in your account

### Timeouts on text enrichment
- **Cause:** Cloudflare rate limits
- **Fix:** Implement request queuing, spread batches

### Image analysis gives generic results
- **Cause:** Using Cloudflare fallback instead of BYOK
- **Fix:** Configure BYOK for full vision analysis

### BYOK not being used
- **Cause:** `AI_GATEWAY_URL` not set
- **Fix:** Add to wrangler.jsonc and redeploy

## Production Checklist

- [ ] Verify `/api/enrich/info` shows correct provider
- [ ] Test text enrichment endpoint
- [ ] Test batch folder upload (if using images)
- [ ] Verify listings appear in inventory
- [ ] Check database for stored records
- [ ] Monitor rate limits if using BYOK
- [ ] Set up cost tracking if using BYOK
- [ ] Configure monitoring/alerting

## Next Steps

1. **Test the API** — Use any endpoint above
2. **Publish to Platform** — Export to eBay, TikTok, etc.
3. **Monitor Quality** — Track enrichment success rates
4. **Optimize Pricing** — A/B test pricing strategies
5. **Scale Batch Processing** — Implement queue for bulk uploads

## Live Demo

**Endpoint:** https://listing-factory.eternaleleganceemporium.workers.dev

**Try now:**
```bash
# Check status
curl https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/info

# Enrich text
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/text \
  -H "Content-Type: application/json" \
  -d '{"description":"Vintage gold ring with diamond","folder":"rings"}'
```
