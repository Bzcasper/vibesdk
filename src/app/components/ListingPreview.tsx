/**
 * ListingPreview Component
 * Shows enriched listing with platform-specific previews
 */

interface EnrichmentState {
	listing_id: string;
	fields: Record<string, any>;
}

interface Props {
	listing: EnrichmentState;
}

export default function ListingPreview({ listing }: Props) {
	const fields = listing.fields;

	return (
		<div className="space-y-6">
			{/* Listing Overview */}
			<div className="bg-white rounded-lg border border-slate-200 p-6">
				<h2 className="text-lg font-semibold text-slate-900 mb-4">Listing Details</h2>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					{/* Title */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">Title</label>
						<input
							type="text"
							value={fields.title || 'Pre-owned Jewelry Item'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
						/>
						{fields.title_confidence && (
							<p className="text-xs text-slate-500 mt-1">Confidence: {Math.round(fields.title_confidence * 100)}%</p>
						)}
					</div>

					{/* SKU */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">SKU</label>
						<input
							type="text"
							value={fields.sku || 'Auto-generated'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-sm"
						/>
					</div>

					{/* Category */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">Category</label>
						<input
							type="text"
							value={fields.category || 'Jewelry'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
						/>
					</div>

					{/* Condition */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">Condition</label>
						<input
							type="text"
							value={fields.condition || 'Pre-owned'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
						/>
					</div>

					{/* Price */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">Suggested Price</label>
						<input
							type="text"
							value={fields.price_suggested ? `$${fields.price_suggested.toFixed(2)}` : '$0.00'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold"
						/>
					</div>

					{/* Grade */}
					<div>
						<label className="block text-sm font-medium text-slate-900 mb-1">Grade/Quality</label>
						<input
							type="text"
							value={fields.condition_grade || 'Good'}
							readOnly
							className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
						/>
					</div>
				</div>

				{/* Description */}
				<div className="mt-4">
					<label className="block text-sm font-medium text-slate-900 mb-1">Description</label>
					<textarea
						value={fields.description || 'No description'}
						readOnly
						rows={4}
						className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
					/>
				</div>
			</div>

			{/* Platform-Specific Previews */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* eBay Preview */}
				<PlatformPreview
					platform="eBay"
					title={fields.ebay_title || fields.title}
					description={fields.ebay_description || fields.description}
					price={fields.price_suggested}
					condition={fields.condition}
				/>

				{/* Shopify Preview */}
				<PlatformPreview
					platform="Shopify"
					title={fields.shopify_title || fields.title}
					description={fields.shopify_description || fields.description}
					price={fields.price_suggested}
				/>

				{/* Etsy Preview */}
				<PlatformPreview
					platform="Etsy"
					title={fields.etsy_title || fields.title}
					description={fields.etsy_description || fields.description}
					price={fields.price_suggested}
					tags={['pre-owned', 'jewelry', 'vintage']}
				/>

				{/* Facebook Preview */}
				<PlatformPreview
					platform="Facebook Marketplace"
					title={fields.facebook_title || fields.title}
					description={fields.facebook_description || fields.description}
					price={fields.price_suggested}
				/>
			</div>

			{/* Social Media Content */}
			<div className="bg-white rounded-lg border border-slate-200 p-6">
				<h2 className="text-lg font-semibold text-slate-900 mb-4">Social Media Content</h2>

				<div className="space-y-4">
					{/* TikTok */}
					{fields.tiktok_script && (
						<div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
							<p className="text-sm font-medium text-slate-900 mb-2">🎬 TikTok Script</p>
							<p className="text-sm text-slate-700">{fields.tiktok_script}</p>
						</div>
					)}

					{/* Pinterest */}
					{fields.pinterest_pin_title && (
						<div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
							<p className="text-sm font-medium text-slate-900 mb-2">📌 Pinterest Pin Title</p>
							<p className="text-sm text-slate-700">{fields.pinterest_pin_title}</p>
						</div>
					)}

					{/* Instagram */}
					{fields.instagram_caption && (
						<div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
							<p className="text-sm font-medium text-slate-900 mb-2">📸 Instagram Caption</p>
							<p className="text-sm text-slate-700">{fields.instagram_caption}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function PlatformPreview({
	platform,
	title,
	description,
	price,
	condition,
	tags,
}: {
	platform: string;
	title?: string;
	description?: string;
	price?: number;
	condition?: string;
	tags?: string[];
}) {
	return (
		<div className="bg-white rounded-lg border border-slate-200 p-6">
			<p className="text-sm font-medium text-slate-600 mb-3">{platform} Preview</p>
			<div className="space-y-3">
				{title && (
					<div>
						<p className="text-sm font-semibold text-slate-900 line-clamp-2">{title}</p>
					</div>
				)}
				{description && (
					<p className="text-xs text-slate-700 line-clamp-3">{description}</p>
				)}
				{price && (
					<p className="text-base font-semibold text-slate-900">💰 ${price.toFixed(2)}</p>
				)}
				{condition && (
					<p className="text-xs text-slate-600">Condition: {condition}</p>
				)}
				{tags && (
					<div className="flex flex-wrap gap-1">
						{tags.map((tag) => (
							<span key={tag} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
								#{tag}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
