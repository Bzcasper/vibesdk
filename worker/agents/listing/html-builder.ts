/**
 * HTML Builder
 *
 * Generates eBay-compliant HTML descriptions for listings.
 */

import { EnrichedDraft } from "./enricher";

// HTML Template
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
		.header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #eee; }
		.title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; }
		.brand-model { font-size: 16px; color: #666; }
		.gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
		.gallery img { width: 100%; height: auto; border-radius: 8px; }
		.section { margin-bottom: 25px; }
		.section-title { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #eee; }
		.description { font-size: 15px; line-height: 1.7; }
		.specs-table { width: 100%; border-collapse: collapse; }
		.specs-table tr:nth-child(even) { background: #f9f9f9; }
		.specs-table td { padding: 10px 12px; border-bottom: 1px solid #eee; }
		.specs-table td:first-child { font-weight: 600; width: 40%; }
		.condition-box { background: #f8f9fa; border-radius: 8px; padding: 15px; margin-top: 10px; }
		.condition-grade { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 600; font-size: 14px; }
		.condition-new { background: #d4edda; color: #155724; }
		.condition-excellent { background: #cce5ff; color: #004085; }
		.condition-verygood { background: #d1ecf1; color: #0c5460; }
		.condition-good { background: #fff3cd; color: #856404; }
		.condition-fair { background: #f8d7da; color: #721c24; }
		.includes-list { list-style: none; }
		.includes-list li { padding: 5px 0; padding-left: 20px; position: relative; }
		.includes-list li:before { content: "✓"; position: absolute; left: 0; color: #28a745; }
		.shipping-note { background: #e7f3ff; border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; }
		.footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #666; }
	</style>
</head>
<body>
	<div class="header">
		<h1 class="title">{{TITLE}}</h1>
		<p class="brand-model">{{BRAND_MODEL}}</p>
	</div>
	<div class="gallery">{{IMAGES}}</div>
	<div class="section">
		<h2 class="section-title">Description</h2>
		<div class="description">
			<p>{{SHORT_DESCRIPTION}}</p>
			<p style="margin-top: 15px;">{{LONG_DESCRIPTION}}</p>
		</div>
	</div>
	<div class="section">
		<h2 class="section-title">Item Specifics</h2>
		<table class="specs-table">{{ITEM_SPECIFICS}}</table>
	</div>
	<div class="section">
		<h2 class="section-title">Condition</h2>
		<div class="condition-box">
			<span class="condition-grade condition-{{CONDITION_CLASS}}">{{CONDITION_GRADE}}</span>
			<p style="margin-top: 10px;">{{CONDITION_DETAILS}}</p>
		</div>
	</div>
	<div class="section">
		<h2 class="section-title">What's Included</h2>
		<ul class="includes-list">{{INCLUDES_LIST}}</ul>
	</div>
	<div class="shipping-note"><strong>Shipping:</strong> {{SHIPPING_NOTE}}</div>
	<div class="footer"><p>Thank you for viewing our listing!</p></div>
</body>
</html>`;

function conditionToClass(condition: string): string {
	const map: Record<string, string> = { New: "new", Excellent: "excellent", VeryGood: "verygood", Good: "good", Fair: "fair" };
	return map[condition] || "good";
}

function formatItemSpecifics(specs: Array<{ name?: string; value?: string }>): string {
	return specs
		.filter((s) => s.name && s.value)
		.map((s) => `<tr><td>${escapeHtml(s.name!)}</td><td>${escapeHtml(s.value!)}</td></tr>`)
		.join("\n");
}

function formatIncludesList(whatIsIncluded: string): string {
	return whatIsIncluded.split(",").map((item) => `<li>${escapeHtml(item.trim())}</li>`).join("\n");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "\x26amp;")
		.replace(/</g, "\x26lt;")
		.replace(/>/g, "\x26gt;")
		.replace(/"/g, "\x26quot;")
		.replace(/'/g, "\x26#039;");
}

export function buildHtmlDescription(draft: EnrichedDraft, imageUrls: string[] = []): string {
	const { classification, itemSpecifics, title, description } = draft;
	const imagesHtml = imageUrls.map((url) => `<img src="${escapeHtml(url)}" alt="Product image" />`).join("\n");
	const brandModel = (classification.brand || classification.model) ? `${classification.brand || ""} ${classification.model || ""}`.trim() : "";

	let html = HTML_TEMPLATE;
	html = html.replace("{{TITLE}}", escapeHtml(title));
	html = html.replace("{{BRAND_MODEL}}", escapeHtml(brandModel));
	html = html.replace("{{IMAGES}}", imagesHtml);
	html = html.replace("{{SHORT_DESCRIPTION}}", escapeHtml(description.short_description));
	html = html.replace("{{LONG_DESCRIPTION}}", escapeHtml(description.long_description));
	html = html.replace("{{CONDITION_CLASS}}", conditionToClass(classification.condition_grade));
	html = html.replace("{{CONDITION_GRADE}}", classification.condition_grade);
	html = html.replace("{{CONDITION_DETAILS}}", escapeHtml(description.condition_details));
	html = html.replace("{{SHIPPING_NOTE}}", escapeHtml(description.shipping_note));
	html = html.replace("{{ITEM_SPECIFICS}}", formatItemSpecifics(itemSpecifics));
	html = html.replace("{{INCLUDES_LIST}}", formatIncludesList(description.what_is_included));
	return html;
}

export function buildMinimalHtml(draft: EnrichedDraft): string {
	return `<!DOCTYPE html><html><head><title>${escapeHtml(draft.title)}</title></head><body><h1>${escapeHtml(draft.title)}</h1><p>${escapeHtml(draft.description.short_description)}</p><p>Condition: ${draft.classification.condition_grade}</p><p>Price: $${draft.pricing.suggested_price.toFixed(2)}</p></body></html>`;
}

export function buildProfessionalHtml(draft: EnrichedDraft, imageUrls: string[] = []): string {
	return buildHtmlDescription(draft, imageUrls);
}
