/**
 * HTML Builder
 *
 * Generates eBay-compliant HTML descriptions for listings.
 * Uses templates and the enriched listing data.
 */

import { EnrichedDraft } from "./enricher";

// ============================================================
// HTML Template
// ============================================================

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
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
		.pricing { text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; }
		.price-label { font-size: 14px; opacity: 0.9; }
		.price-value { font-size: 32px; font-weight: 700; }
		.footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #666; }
	</style>
</head>
<body>
	<div class="header">
		<h1 class="title">{{TITLE}}</h1>
		{{#BRAND_MODEL}}<p class="brand-model">{{BRAND}} {{MODEL}}</p>{{/BRAND_MODEL}}
	</div>

	{{#IMAGES}}
	<div class="gallery">
		{{IMAGES}}
	</div>
	{{/IMAGES}}

	<div class="section">
		<h2 class="section-title">Description</h2>
		<div class="description">
			<p>{{SHORT_DESCRIPTION}}</p>
			<p style="margin-top: 15px;">{{LONG_DESCRIPTION}}</p>
		</div>
	</div>

	<div class="section">
		<h2 class="section-title">Item Specifics</h2>
		<table class="specs-table">
			{{ITEM_SPECIFICS}}
		</table>
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
		<ul class="includes-list">
			{{INCLUDES_LIST}}
		</ul>
	</div>

	<div class="shipping-note">
		<strong>Shipping:</strong> {{SHIPPING_NOTE}}
	</div>

	<div class="footer">
		<p>Thank you for viewing our listing!</p>
	</div>
</body>
</html>`;

// ============================================================
// Helper Functions
// ============================================================

function conditionToClass(condition: string): string {
	const map: Record<string, string> = {
		New: "new",
		Excellent: "excellent",
		VeryGood: "verygood",
		Good: "good",
		Fair: "fair",
	};
	return map[condition] || "good";
}

function formatItemSpecifics(specs: Array<{ name: string; value: string }>): string {
	return specs
		.map(
			(spec) => `
			<tr>
				<td>${escapeHtml(spec.name)}</td>
				<td>${escapeHtml(spec.value)}</td>
			</tr>`
		)
		.join("");
}

function formatIncludesList(whatIsIncluded: string): string {
	const items = whatIsIncluded.split(",").map((item) => item.trim());
	return items
		.map((item) => `<li>${escapeHtml(item)}</li>`)
		.join("");
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&")
		.replace(/</g, "<")
		.replace(/>/g, ">")
		.replace(/"/g, """)
		.replace(/'/g, "&#039;");
}

// ============================================================
// Main Builder Function
// ============================================================

export function buildHtmlDescription(draft: EnrichedDraft, imageUrls: string[] = []): string {
	const { classification, itemSpecifics, title, description, pricing } = draft;

	// Build image gallery
	const imagesHtml =
		imageUrls.length > 0
			? imageUrls.map((url) => `<img src="${escapeHtml(url)}" alt="Product image" />`).join("\n")
			: "";

	// Build brand/model line
	const brandModel =
		classification.brand || classification.model
			? `${classification.brand || ""} ${classification.model || ""}`.trim()
			: "";

	// Build HTML
	let html = HTML_TEMPLATE;

	// Replace simple placeholders
	html = html.replace("{{TITLE}}", escapeHtml(title));
	html = html.replace("{{BRAND}}", escapeHtml(classification.brand || ""));
	html = html.replace("{{MODEL}}", escapeHtml(classification.model || ""));
	html = html.replace("{{SHORT_DESCRIPTION}}", escapeHtml(description.short_description));
	html = html.replace("{{LONG_DESCRIPTION}}", escapeHtml(description.long_description));
	html = html.replace("{{CONDITION_CLASS}}", conditionToClass(classification.condition_grade));
	html = html.replace("{{CONDITION_GRADE}}", classification.condition_grade);
	html = html.replace("{{CONDITION_DETAILS}}", escapeHtml(description.condition_details));
	html = html.replace("{{SHIPPING_NOTE}}", escapeHtml(description.shipping_note));

	// Replace conditional sections
	if (brandModel) {
		html = html.replace("{{#BRAND_MODEL}}", "").replace("{{/BRAND_MODEL}}", "");
		html = html.replace("{{BRAND_MODEL}}", escapeHtml(brandModel));
	} else {
		html = html.replace(/{{#BRAND_MODEL}}.*?{{\/BRAND_MODEL}}/s, "");
	}

	if (imageUrls.length > 0) {
		html = html.replace("{{#IMAGES}}", "").replace("{{/IMAGES}}", "");
		html = html.replace("{{IMAGES}}", imagesHtml);
	} else {
		html = html.replace(/{{#IMAGES}}.*?{{\/IMAGES}}/s, "");
	}

	// Replace item specifics
	html = html.replace("{{ITEM_SPECIFICS}}", formatItemSpecifics(itemSpecifics));

	// Replace includes list
	html = html.replace("{{INCLUDES_LIST}}", formatIncludesList(description.what_is_included));

	return html;
}

// ============================================================
// Template Variants
// ============================================================

export function buildMinimalHtml(draft: EnrichedDraft): string {
	return `
<!DOCTYPE html>
<html>
<head><title>${escapeHtml(draft.title)}</title></head>
<body>
	<h1>${escapeHtml(draft.title)}</h1>
	<p>${escapeHtml(draft.description.short_description)}</p>
	<p>Condition: ${draft.classification.condition_grade}</p>
	<p>Price: $${draft.pricing.suggested_price.toFixed(2)}</p>
</body>
</html>`;
}

export function buildProfessionalHtml(draft: EnrichedDraft, imageUrls: string[] = []): string {
	// Use the full template
	return buildHtmlDescription(draft, imageUrls);
}
