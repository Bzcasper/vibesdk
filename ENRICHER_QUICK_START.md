# AI Enricher — Quick Start Guide

## 🚀 Live Production URL
```
https://listing-factory.eternaleleganceemporium.workers.dev/enrich
```

## 📡 API Endpoints

### 1. Text Enrichment (Fastest)
```bash
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/text \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Beautiful vintage gold ring with diamond",
    "folder": "my-item"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "listing_id": "uuid",
    "title": "Vintage Gold Diamond Ring",
    "description": "<p>Beautiful vintage...</p>",
    "price_suggested": 299,
    "item_specifics": {
      "Type": "Ring",
      "Material": "Gold",
      "Condition": "Excellent"
    },
    "provider": "cloudflare-models"
  }
}
```

### 2. Single Image Enrichment
```bash
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/image \
  -F "image=@jewelry.jpg" \
  -F "folder=my-ring"
```

### 3. Batch Processing (Multiple Images)
```bash
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/folder \
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
        "folder": "item-1",
        "filename": "ring1.jpg",
        "listing_id": "uuid",
        "title": "14K Gold Ring",
        "price": 299,
        "status": "success"
      }
    ]
  }
}
```

### 4. Get Listing Details
```bash
curl https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/LIST_ID
```

### 5. Provider Status
```bash
curl https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/info
```

---

## 💻 Web UI

Navigate to: `/enrich` in the web app

**Features:**
- ✅ Drag & drop upload
- ✅ Real-time progress
- ✅ Result preview
- ✅ Export CSV
- ✅ View listings

---

## ⚡ Performance

| Method | Time | Provider |
|--------|------|----------|
| Text | ~5-6s | Cloudflare |
| Image | ~2-3s | Cloudflare |
| Batch (10 items) | ~60s | Cloudflare |

---

## 🎯 Generated Content

### Title
- ✅ SEO-optimized
- ✅ 80 characters max
- ✅ Material + condition + style
- Example: "18K Gold Diamond Halo Ring, Excellent"

### Description
- ✅ HTML formatted
- ✅ Compelling copy
- ✅ Buyer-focused
- ✅ 500-1000 words

### Price
- ✅ Market-aware
- ✅ Material-based ($25-$999)
- ✅ Condition-adjusted
- ✅ Conservative estimates

### Item Specifics
- ✅ eBay-compatible
- ✅ 5 key fields
- ✅ Searchable metadata

---

## 🔑 Optional: Enable GPT-4V Vision

For professional-grade image analysis:

```bash
wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key (sk-...)
```

Then redeploy:
```bash
wrangler deploy
```

**Benefits:**
- GPT-4V vision analysis
- Higher pricing range ($25-$5,000)
- Color detection
- Material identification
- Feature extraction

---

## 💾 Database

All listings are automatically saved to:
- **D1 Database:** Listings, fields, specifics
- **R2 Storage:** Images (optional)
- **KV Cache:** Analysis results (24hr TTL)

---

## 🛠️ Troubleshooting

### Image fails with "Could not parse analysis"
→ Ensure OPENAI_API_KEY is set (otherwise uses Cloudflare fallback)

### "UNIQUE constraint failed: listings.sku"
→ Use unique folder names for each item

### Type errors in item specifics
→ Already fixed! All values properly coerced to strings

### Slow batch processing
→ Cloudflare rate limits apply. Adjust batch size if needed.

---

## 📊 Live Examples

### Example 1: Vintage Ring
```
Input: "14K gold ring with diamond, vintage, excellent condition"
Output:
  Title: "14K Gold Vintage Diamond Ring, Excellent Condition"
  Price: $450
  Type: Ring | Material: 14K Gold | Condition: Excellent
```

### Example 2: Modern Pendant
```
Input: "18K white gold pendant with emerald"
Output:
  Title: "18K White Gold Emerald Pendant Necklace"
  Price: $380
  Type: Pendant | Material: 18K White Gold | Stone: Emerald
```

---

## 🎓 API Response Format

```typescript
{
  success: boolean;
  data?: {
    listing_id: string;
    title: string;
    description: string;
    price_suggested: number;
    item_specifics: Record<string, string>;
    provider: "openai-gateway" | "cloudflare-models";
    analysis?: VisionAnalysis;
  };
  error?: string;
}
```

---

## 🚀 Next Steps

1. **Try it now:** Visit `/enrich` in the web app
2. **Upload images:** Drag & drop or click to select
3. **Review results:** Check title, price, specifics
4. **Publish:** Export to eBay or other platforms
5. **Upgrade (optional):** Set OPENAI_API_KEY for GPT-4V

---

**Status:** ✅ Production Ready
**Last Updated:** March 8, 2026
