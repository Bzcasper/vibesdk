/**
 * Inventory — Listing Grid with Status Badges
 * View all listings, filter by status, see platform publication status
 */

import { useState, useEffect } from 'react';

interface Listing {
	id: string;
	title: string;
	description: string;
	status: string;
	created_at: string;
	platforms_published: { [key: string]: boolean };
	image_url?: string;
}

export default function Inventory() {
	const [listings, setListings] = useState<Listing[]>([]);
	const [filter, setFilter] = useState<string>('all');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchListings();
	}, [filter]);

	const fetchListings = async () => {
		setLoading(true);
		try {
			const query = filter !== 'all' ? `?status=${filter}` : '';
			const response = await fetch(`/api/listings${query}`);
			if (response.ok) {
				const data = await response.json() as any;
				setListings(data.data || []);
			}
		} catch (err) {
			console.error('Failed to fetch listings:', err);
		} finally {
			setLoading(false);
		}
	};

	const statusBadgeColor = (status: string) => {
		const colors: { [key: string]: string } = {
			draft: 'bg-slate-100 text-slate-900',
			enriching: 'bg-amber-100 text-amber-900',
			ready: 'bg-blue-100 text-blue-900',
			published: 'bg-green-100 text-green-900',
			live: 'bg-emerald-100 text-emerald-900',
			error: 'bg-red-100 text-red-900',
		};
		return colors[status] || 'bg-slate-100 text-slate-900';
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Inventory</h1>
					<p className="text-slate-600 mt-1">Manage your listings across all platforms</p>
				</div>
				<a href="/new-listing" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
					+ New Listing
				</a>
			</div>

			{/* Filter Tabs */}
			<div className="flex gap-2 border-b border-slate-200">
				{['all', 'draft', 'enriching', 'ready', 'published', 'live', 'error'].map((status) => (
					<button
						key={status}
						onClick={() => setFilter(status)}
						className={`px-4 py-2 font-medium border-b-2 transition-colors ${
							filter === status
								? 'border-blue-600 text-blue-600'
								: 'border-transparent text-slate-600 hover:text-slate-900'
						}`}
					>
						{status.charAt(0).toUpperCase() + status.slice(1)}
					</button>
				))}
			</div>

			{/* Listings Grid */}
			{loading ? (
				<div className="text-center py-12">
					<p className="text-slate-600">Loading listings...</p>
				</div>
			) : listings.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-slate-600 mb-4">No listings found</p>
					<a href="/new-listing" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
						Create your first listing
					</a>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{listings.map((listing) => (
						<div key={listing.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
							{/* Image */}
							{listing.image_url && (
								<img src={listing.image_url} alt={listing.title} className="w-full h-48 object-cover" />
							)}

							{/* Content */}
							<div className="p-4">
								<div className="flex items-start justify-between mb-2">
									<h3 className="font-semibold text-slate-900 line-clamp-2">{listing.title}</h3>
									<span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusBadgeColor(listing.status)}`}>
										{listing.status}
									</span>
								</div>

								<p className="text-sm text-slate-600 line-clamp-2 mb-4">{listing.description}</p>

								{/* Platform Badges */}
								<div className="flex flex-wrap gap-2 mb-4">
									{Object.entries(listing.platforms_published).map(([platform, published]) => (
										<span
											key={platform}
											className={`px-2 py-1 text-xs font-medium rounded ${
												published
													? 'bg-green-100 text-green-900'
													: 'bg-slate-100 text-slate-600'
											}`}
										>
											{published ? '✓' : '○'} {platform}
										</span>
									))}
								</div>

								{/* Date */}
								<p className="text-xs text-slate-500">{new Date(listing.created_at).toLocaleDateString()}</p>

								{/* Actions */}
								<div className="mt-4 flex gap-2">
									<a
										href={`/listing/${listing.id}`}
										className="flex-1 px-3 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200"
									>
										View
									</a>
									<button className="flex-1 px-3 py-2 text-center text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
										Edit
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
