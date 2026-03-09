# AI Enricher Setup Guide — BYOK Cloudflare AI Gateway

## Overview
The Enricher pipeline processes folders of jewelry images and generates:
- ✨ SEO-optimized titles (80 chars)
- 📝 Rich product descriptions (HTML)
- 💰 Competitive pricing suggestions
- 📊 eBay item specifics (key-value pairs)

## Architecture

### Vision Pipeline (GPT-4V)
1. **Image Analysis** → Jewelry type, materials, condition, era
2. **Feature Extraction** → Colors, styles, notable characteristics
3. **Condition Assessment** → New/Excellent/Good/Fair

### LLM Pipeline (GPT-4)
1. **Title Generation** → SEO keywords, character-constrained
2. **Description Writing** → Compelling copy, buyer confidence
3. **Pricing Strategy** → Market analysis, competitive rates
4. **Item Specifics** → eBay-compatible metadata

## Setup Instructions

### 1. Configure BYOK (Bring Your Own Key)

```bash
# Set your OpenAI API key in wrangler environment
wrangler secret put OPENAI_API_KEY
# Enter your key when prompted (sk-...)

# Update wrangler.jsonc
{
  "vars": {
    "AI_GATEWAY_URL": "https://gateway.ai.cloudflare.com/v1/{ACCOUNT_ID}/{GATEWAY_ID}/openai"
  }
}
```

### 2. Verify Cloudflare AI Gateway Configuration

```bash
# Check your gateway configuration
curl -X GET https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/gateway \
  -H "Authorization: Bearer {CF_TOKEN}"
```

### 3. Deploy

```bash
npm run build
wrangler deploy
```

## API Endpoints

### POST /api/enrich/image
Process a single image.

```bash
curl -X POST https://your-worker.dev/api/enrich/image \
  -F "image=@jewelry.jpg" \
  -F "folder=vintage-rings"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listing_id": "uuid-xxx",
    "title": "14K Gold Diamond Ring Vintage Estate",
    "description": "<p>Beautiful vintage ring...</p>",
    "price_suggested": 299.99,
    "item_specifics": {
      "Type": "Ring",
      "Material": "14K Gold",
      "Gemstone": "Diamond",
      "Condition": "Excellent",
      "Style": "Vintage"
    },
    "analysis": {
      "materials": ["14K Gold", "Diamond"],
      "condition": "excellent",
      "notable_features": ["Intricate setting", "Clear stone"],
      "colors": ["Gold", "Clear"]
    }
  }
}
```

### POST /api/enrich/folder
Batch process multiple images.

```bash
# Upload folder of images
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
    "results": [
      {
        "folder": "vintage-rings",
        "filename": "ring1.jpg",
        "listing_id": "uuid-1",
        "title": "14K Gold Diamond Ring",
        "price": 299.99,
        "status": "success"
      },
      ...
    ]
  }
}
```

### GET /api/enrich/:id
Get enrichment status and details.

```bash
curl https://your-worker.dev/api/enrich/uuid-xxx
```

## Frontend: AI Enricher Page

Navigate to **✨ AI Enricher** in the sidebar.

### Features
- Drag & drop image upload
- Real-time processing
- Success/error breakdown
- Export results as CSV
- Direct listing view

### Workflow
1. Drop image folder or click upload
2. System analyzes each image via Vision AI
3. Generates content via LLM pipeline
4. Stores listings in D1 database
5. Saves images to R2 storage
6. Returns summary with titles, prices, specifics

## Database Schema

### tables.listings
Stores enriched listing data:
- `title` — Generated SEO title
- `description` — HTML description
- `price_final` — Suggested price
- `status` — 'ready' for publishing

### tables.listing_fields
Item specifics (key-value pairs):
- Material, Type, Style, Condition, etc.

### tables.media_assets
Image metadata and R2 references:
- `r2_key` — Path in R2 bucket
- `status` — 'processed'

## KV Storage

### CONFIG Namespace
Caches AI model responses for 24hrs:
```
enrich:{hash} → {analysis_json}
```

### TOKENS Namespace
Reserved for platform API keys (future integration).

## Performance Metrics

- **Image Analysis:** 2-5 seconds (Vision API)
- **Title Generation:** 1-2 seconds
- **Description:** 2-3 seconds
- **Pricing:** 1-2 seconds
- **Total Per Image:** ~8 seconds

**Batch Processing (10 images):** ~2 minutes

## Cost Estimation

### Per Image Processing
- Vision API (GPT-4V): ~$0.01-0.03
- LLM Calls (4x GPT-4): ~0.02-0.05
- **Total per image:** ~$0.04-0.08

### Bring Your Own Key Benefits
- Use existing OpenAI credits
- No Cloudflare API markup
- Full control of rate limits
- Volume discounts apply

## Troubleshooting

### Vision API Error (400)
- Verify OPENAI_API_KEY is set
- Check image format (JPEG/PNG)
- Ensure image is valid base64

### Timeout
- Images > 50MB may timeout
- Increase Worker timeout in wrangler
- Consider splitting batches

### Rate Limits
- OpenAI: 3,500 req/min (Pro)
- Adjust batch size if hitting limits
- Implement queue for heavy loads

## Next Steps

1. ✅ Test single image enrichment
2. ✅ Test batch folder processing
3. ✅ Verify listings appear in Inventory
4. ✅ Publish to platforms (eBay, TikTok, etc.)
5. Implement inventory sync
6. Add marketplace-specific optimizations

## Production Checklist

- [ ] BYOK API key configured
- [ ] Rate limits set appropriately
- [ ] Error handling tested
- [ ] R2 storage quota verified
- [ ] D1 database backups enabled
- [ ] Monitoring/logging in place
- [ ] Cost tracking enabled
