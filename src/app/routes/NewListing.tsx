/**
 * NewListing — Folder Upload + Real-time Enrichment
 * Drag-drop folder, watch AI enrichment progress, review & publish
 */

import { useState, useRef, useEffect } from 'react';
import UploadZone from '../components/UploadZone';
import EnrichmentProgress from '../components/EnrichmentProgress';
import ListingPreview from '../components/ListingPreview';

interface EnrichmentState {
	listing_id: string;
	status: 'draft' | 'enriching' | 'ready' | 'error';
	currentStep: string | null;
	stepHistory: Array<{
		step: string;
		status: 'running' | 'complete' | 'error';
		duration_ms: number;
		timestamp: string;
	}>;
	fields: Record<string, any>;
	error: string | null;
}

export default function NewListing() {
	const [listing, setListing] = useState<EnrichmentState | null>(null);
	const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
	const [isPublishing, setIsPublishing] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	const platforms = ['ebay', 'shopify', 'etsy', 'facebook', 'tiktok', 'pinterest', 'instagram', 'poshmark', 'whatnot', 'mercari'];

	const handleUploadComplete = async (listing_id: string) => {
		// Initialize enrichment session
		const response = await fetch(`/api/session/${listing_id}/init`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ listing_id }),
		});

		if (response.ok) {
			const data = await response.json();
			setListing(data as EnrichmentState);
			connectWebSocket(listing_id);
		}
	};

	const connectWebSocket = (listing_id: string) => {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${window.location.host}/api/session/${listing_id}`;

		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('WebSocket connected');
		};

		ws.onmessage = (event) => {
			const message = JSON.parse(event.data);

			switch (message.type) {
				case 'state_sync':
					setListing(message.state);
					break;
				case 'step_start':
					setListing((prev) =>
						prev
							? {
									...prev,
									currentStep: message.step,
								}
							: null
					);
					break;
				case 'step_complete':
					setListing((prev) =>
						prev
							? {
									...prev,
									stepHistory: [
										...prev.stepHistory,
										{
											step: message.step,
											status: 'complete',
											duration_ms: message.duration_ms,
											timestamp: new Date().toISOString(),
										},
									],
									currentStep: null,
								}
							: null
					);
					break;
				case 'field_ready':
					setListing((prev) =>
						prev
							? {
									...prev,
									fields: {
										...prev.fields,
										[message.key]: message.value,
									},
								}
							: null
					);
					break;
				case 'listing_complete':
					setListing((prev) =>
						prev
							? {
									...prev,
									status: 'ready',
									currentStep: null,
								}
							: null
					);
					break;
			}
		};

		ws.onerror = () => {
			console.error('WebSocket error');
		};

		wsRef.current = ws;
	};

	const handlePublish = async () => {
		if (!listing || selectedPlatforms.length === 0) return;

		setIsPublishing(true);

		try {
			const response = await fetch('/api/dispatch/publish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					listing_id: listing.listing_id,
					platforms: selectedPlatforms,
				}),
			});

			if (response.ok) {
				alert('Publishing to platforms...');
				// Could redirect to dispatch status page
			} else {
				alert('Failed to publish');
			}
		} catch (err) {
			console.error('Publish error:', err);
			alert('Error publishing listing');
		} finally {
			setIsPublishing(false);
		}
	};

	if (!listing) {
		return <UploadZone onUploadComplete={handleUploadComplete} />;
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-slate-900">New Listing</h1>
				<p className="text-slate-600 mt-1">Listing ID: {listing.listing_id}</p>
			</div>

			{/* Progress */}
			<EnrichmentProgress listing={listing} />

			{/* Preview */}
			{listing.status === 'ready' && <ListingPreview listing={listing} />}

			{/* Platform Selection */}
			{listing.status === 'ready' && (
				<div className="bg-white rounded-lg border border-slate-200 p-6">
					<h2 className="text-lg font-semibold text-slate-900 mb-4">Select Platforms</h2>
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
						{platforms.map((platform) => (
							<label
								key={platform}
								className="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50"
							>
								<input
									type="checkbox"
									checked={selectedPlatforms.includes(platform)}
									onChange={(e) => {
										if (e.target.checked) {
											setSelectedPlatforms([...selectedPlatforms, platform]);
										} else {
											setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
										}
									}}
									className="w-4 h-4 text-blue-600"
								/>
								<span className="ml-2 capitalize font-medium text-slate-900">{platform}</span>
							</label>
						))}
					</div>

					{/* Publish Button */}
					<div className="mt-6">
						<button
							onClick={handlePublish}
							disabled={selectedPlatforms.length === 0 || isPublishing}
							className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isPublishing ? 'Publishing...' : `Publish to ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
