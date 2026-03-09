/**
 * AI Enricher — Upload Images, Get Complete Listings
 * Multi-image batch processing with real-time progress
 */

import { useState, useRef } from 'react';

interface EnrichedItem {
	folder: string;
	filename: string;
	listing_id: string;
	title: string;
	price: number;
	status: string;
}

interface EnrichmentResult {
	processed: number;
	failed: number;
	total: number;
	results: EnrichedItem[];
	errors?: any[];
}

export default function Enricher() {
	const [enrichmentResult, setEnrichmentResult] = useState<EnrichmentResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [dragActive, setDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDrag = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(e.type === 'dragenter' || e.type === 'dragover');
	};

	const processFiles = async (files: File[]) => {
		if (files.length === 0) return;

		setLoading(true);
		setEnrichmentResult(null);

		try {
			const formData = new FormData();
			files.forEach(file => formData.append('images', file));

			const response = await fetch('/api/enrich/folder', {
				method: 'POST',
				body: formData,
			});

			const data = await response.json() as any;
			setEnrichmentResult(data.data);
		} catch (error) {
			console.error('Enrichment failed:', error);
			setEnrichmentResult({
				processed: 0,
				failed: 1,
				total: 1,
				results: [],
				errors: [{ error: (error as Error).message }],
			});
		} finally {
			setLoading(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragActive(false);

		const files = Array.from(e.dataTransfer.files).filter(f =>
			f.type.startsWith('image/')
		);
		processFiles(files);
	};

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			processFiles(Array.from(e.target.files));
		}
	};

	return (
		<div className="space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold text-slate-900">AI Enricher</h1>
				<p className="text-slate-600 mt-1">Upload images, get complete listings instantly</p>
			</div>

			{/* Upload Area */}
			<div
				onDragEnter={handleDrag}
				onDragLeave={handleDrag}
				onDragOver={handleDrag}
				onDrop={handleDrop}
				className={`border-2 border-dashed rounded-lg p-12 text-center transition cursor-pointer ${
					dragActive
						? 'border-blue-600 bg-blue-50'
						: 'border-slate-300 bg-slate-50 hover:border-slate-400'
				}`}
				onClick={() => fileInputRef.current?.click()}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					accept="image/*"
					onChange={handleFileInput}
					className="hidden"
				/>

				<div className="space-y-3">
					<div className="text-4xl">📸</div>
					<div>
						<p className="text-lg font-semibold text-slate-900">Drop images here or click</p>
						<p className="text-sm text-slate-600">Supported: JPG, PNG, WebP</p>
					</div>

					{loading && (
						<div className="flex items-center justify-center gap-2 mt-4">
							<div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
							<span className="text-sm text-blue-600 font-medium">Processing...</span>
						</div>
					)}
				</div>
			</div>

			{/* Results */}
			{enrichmentResult && (
				<div className="bg-white rounded-lg border border-slate-200 p-6">
					{/* Summary */}
					<div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-slate-200">
						<div>
							<p className="text-sm font-medium text-slate-600">Processed</p>
							<p className="text-3xl font-bold text-green-600">{enrichmentResult.processed}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-slate-600">Failed</p>
							<p className={`text-3xl font-bold ${enrichmentResult.failed > 0 ? 'text-red-600' : 'text-slate-600'}`}>
								{enrichmentResult.failed}
							</p>
						</div>
						<div>
							<p className="text-sm font-medium text-slate-600">Total</p>
							<p className="text-3xl font-bold text-slate-900">{enrichmentResult.total}</p>
						</div>
					</div>

					{/* Success Results */}
					{enrichmentResult.results.length > 0 && (
						<div className="mb-6">
							<h2 className="text-lg font-semibold text-slate-900 mb-4">✓ Successful Enrichments</h2>
							<div className="space-y-3">
								{enrichmentResult.results.map((item, idx) => (
									<div
										key={idx}
										className="flex items-start justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
									>
										<div className="flex-1">
											<p className="font-medium text-slate-900">{item.title}</p>
											<p className="text-sm text-slate-600 mt-1">
												📁 {item.folder} • 💰 ${item.price}
											</p>
										</div>
										<a
											href={`/listings/${item.listing_id}`}
											className="ml-4 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
										>
											View
										</a>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Error Results */}
					{enrichmentResult.errors && enrichmentResult.errors.length > 0 && (
						<div>
							<h2 className="text-lg font-semibold text-slate-900 mb-4">✗ Failed Items</h2>
							<div className="space-y-2">
								{enrichmentResult.errors.map((error, idx) => (
									<div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg">
										<p className="text-sm text-red-900 font-medium">{error.folder || 'Unknown'}</p>
										<p className="text-xs text-red-700 mt-1">{error.error}</p>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
						<button
							onClick={() => {
								setEnrichmentResult(null);
								fileInputRef.current?.click();
							}}
							className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
						>
							Process More Images
						</button>
						{enrichmentResult.results.length > 0 && (
							<button
								onClick={() => {
									// Could implement batch export or publishing
									const csv = enrichmentResult.results
										.map(r => `"${r.title}",${r.price},"${r.folder}"`)
										.join('\n');
									const element = document.createElement('a');
									element.setAttribute(
										'href',
										'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
									);
									element.setAttribute('download', 'enriched-listings.csv');
									element.style.display = 'none';
									document.body.appendChild(element);
									element.click();
									document.body.removeChild(element);
								}}
								className="px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 transition"
							>
								Export CSV
							</button>
						)}
					</div>
				</div>
			)}

			{/* How It Works */}
			{!enrichmentResult && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{[
						{ step: '1', title: 'Upload', desc: 'Drop image files here' },
						{ step: '2', title: 'Analyze', desc: 'Vision AI inspects jewelry' },
						{ step: '3', title: 'Generate', desc: 'LLM creates content' },
						{ step: '4', title: 'Done', desc: 'Ready to publish' },
					].map((item, idx) => (
						<div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 text-center">
							<div className="text-3xl font-bold text-blue-600 mb-2">{item.step}</div>
							<p className="font-semibold text-slate-900">{item.title}</p>
							<p className="text-sm text-slate-600 mt-1">{item.desc}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
