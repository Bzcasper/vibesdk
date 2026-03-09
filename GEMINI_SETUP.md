# Google Gemini Flash 3.1 Setup Guide

## Overview

The AI Enricher now supports **Google Gemini Flash 3.1 Preview** for vision analysis. This is the fastest and most capable model option.

**Features:**
- ⚡ Instant processing (no rate limits)
- 👁️ True image vision analysis
- 💰 Free with Google AI Studio
- 🎯 Excellent jewelry recognition
- 📊 Better accuracy than competitors

---

## Prerequisites

1. **Google Account** (free)
2. **Google AI Studio API Key** (free)
3. **Cloudflare Worker** (already deployed)

---

## Step 1: Get Your Gemini API Key

### Option A: Use Google AI Studio (Easiest)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key" in the left sidebar
3. Click "Create API Key in new Google Cloud Project"
4. Copy the API key (starts with `AIza...`)

### Option B: Use Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (or use existing)
3. Enable **Google Generative AI API**
4. Go to **Credentials** → Create **API Key**
5. Copy the key

---

## Step 2: Set the Secret in Cloudflare

```bash
wrangler secret put GOOGLE_AI_API_KEY
```

When prompted, paste your API key:
```
? Enter the secret text, or leave blank to read from stdin:
AIzaSy... [paste full key]
```

Verify it was set:
```bash
wrangler secret list
```

You should see `GOOGLE_AI_API_KEY` in the list.

---

## Step 3: Deploy

```bash
wrangler deploy
```

The worker will now use Gemini Flash 3.1 as the primary provider.

---

## Step 4: Verify

Test the enrichment endpoint:

```bash
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/info
```

Response should show:
```json
{
  "status": {
    "gemini_configured": true,
    "byok_configured": false,
    "cloudflare_available": true,
    "preferred_provider": "gemini"
  }
}
```

---

## Test with Real Image

```bash
curl -X POST https://listing-factory.eternaleleganceemporium.workers.dev/api/enrich/image \
  -F "image=@jewelry.jpg" \
  -F "folder=test-gemini"
```

**Expected output:**
- ✅ Vision analysis with detailed materials
- ✅ SEO-optimized title
- ✅ Professional description
- ✅ Market-competitive price
- ✅ eBay item specifics

---

## Provider Priority

The system now uses this priority order:

1. **Gemini Flash 3.1** (if GOOGLE_AI_API_KEY set) ⭐
2. **OpenAI Gateway** (if OPENAI_API_KEY + AI_GATEWAY_URL set)
3. **Cloudflare Models** (always available)

---

## Performance

| Provider | Speed | Vision | Accuracy |
|----------|-------|--------|----------|
| Gemini | ⚡⚡⚡ Fast | ✅ Yes | ⭐⭐⭐⭐⭐ |
| OpenAI | ⚡⚡ Medium | ✅ Yes | ⭐⭐⭐⭐ |
| Cloudflare | ⚡ Slow | ❌ No | ⭐⭐⭐ |

---

## Cost

**Google Gemini Flash:**
- Free tier: 15 requests/minute, 1.5M tokens/day
- Paid tier: $0.075/M input, $0.30/M output tokens

**vs. OpenAI GPT-4V:**
- $0.01-0.03 per image (expensive)

**vs. Cloudflare:**
- Free, but no vision analysis

---

## Troubleshooting

### "GOOGLE_AI_API_KEY not set"
```bash
wrangler secret put GOOGLE_AI_API_KEY
# Paste your key
wrangler deploy
```

### "API error: 403"
Your API key may not have access. Verify in [Google AI Studio](https://aistudio.google.com/)

### "API error: 429"
Rate limit exceeded. Wait and retry (free tier: 15 req/min)

### "Invalid image format"
Only JPEG, PNG, WebP supported. Convert and retry.

---

## Example Results

### Input: Gold Diamond Ring Photo

**Output:**
```json
{
  "success": true,
  "data": {
    "title": "14K Gold Princess Cut Diamond Ring, Excellent Condition",
    "price_suggested": 1200,
    "item_specifics": {
      "Type": "Ring",
      "Material": "14K Gold",
      "Gemstone": "Diamond",
      "Condition": "Excellent",
      "Style": "Princess Cut"
    },
    "provider": "gemini"
  }
}
```

---

## Next Steps

1. ✅ Get API key from Google AI Studio
2. ✅ Set GOOGLE_AI_API_KEY secret
3. ✅ Deploy with `wrangler deploy`
4. ✅ Test with real jewelry images
5. ✅ Monitor API usage in [Google Cloud Console](https://console.cloud.google.com/)

---

## Documentation

- **[Gemini API Docs](https://ai.google.dev/docs)**
- **[Vision Best Practices](https://ai.google.dev/docs/vision)**
- **[Gemini Models](https://ai.google.dev/models)**

---

## Support

If issues occur:
1. Check API key in Google AI Studio
2. Verify rate limits not exceeded
3. Ensure image is valid JPEG/PNG
4. Check `wrangler tail` logs

---

**Status: Ready to use! Set API key and deploy.**
