/**
 * UploadZone Component
 * Drag-drop folder upload with file preview
 */

import { useState, useCallback } from 'react';

interface UploadZoneProps {
	onUploadComplete: (listing_id: string) => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
	const [isDragActive, setIsDragActive] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [files, setFiles] = useState<File[]>([]);

	const handleDrag = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
		},
		[]
	);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragActive(false);

		const droppedFiles = Array.from(e.dataTransfer.files);
		setFiles(droppedFiles);
		handleUpload(droppedFiles);
	}, []);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const selectedFiles = Array.from(e.target.files);
			setFiles(selectedFiles);
			handleUpload(selectedFiles);
		}
	}, []);

	const handleUpload = async (filesToUpload: File[]) => {
		if (filesToUpload.length === 0) return;

		setIsUploading(true);
		const formData = new FormData();

		filesToUpload.forEach((file) => {
			formData.append('files', file);
		});

		try {
			// Simulate upload progress
			let progress = 0;
			const progressInterval = setInterval(() => {
				progress += Math.random() * 30;
				if (progress > 90) progress = 90;
				setUploadProgress(progress);
			}, 200);

			const response = await fetch('/api/listings', {
				method: 'POST',
				body: formData,
			});

			clearInterval(progressInterval);

			if (response.ok) {
				const data = await response.json() as any;
				setUploadProgress(100);

				// Redirect to enrichment progress after 1 second
				setTimeout(() => {
					onUploadComplete(data.data?.id || data.listing_id || "");
				}, 1000);
			} else {
				alert('Upload failed');
				setIsUploading(false);
			}
		} catch (err) {
			console.error('Upload error:', err);
			alert('Error uploading files');
			setIsUploading(false);
		}
	};

	return (
		<div className="min-h-[400px] flex items-center justify-center">
			<div className="w-full max-w-2xl">
				<div
					onDragEnter={handleDrag}
					onDragLeave={handleDrag}
					onDragOver={handleDrag}
					onDrop={handleDrop}
					className={`relative rounded-lg border-2 border-dashed transition-all p-12 text-center ${
						isDragActive
							? 'border-blue-500 bg-blue-50'
							: 'border-slate-300 bg-slate-50 hover:border-slate-400'
					}`}
				>
					{!isUploading ? (
						<>
							<div className="mb-4 text-4xl">📁</div>
							<h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Jewelry Images</h2>
							<p className="text-slate-600 mb-6">
								Drag and drop your folder or images here, or click to select files
							</p>

							<input
								type="file"
								multiple
								accept="image/*"
								onChange={handleChange}
								disabled={isUploading}
								className="hidden"
								id="file-input"
							/>

							<label htmlFor="file-input" className="inline-block">
								<button
									onClick={() => document.getElementById('file-input')?.click()}
									disabled={isUploading}
									className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
								>
									Select Folder
								</button>
							</label>

							{files.length > 0 && (
								<div className="mt-6 text-left">
									<p className="text-sm font-medium text-slate-900 mb-2">Selected files:</p>
									<ul className="space-y-1">
										{files.slice(0, 5).map((file) => (
											<li key={file.name} className="text-xs text-slate-600">
												✓ {file.name}
											</li>
										))}
										{files.length > 5 && (
											<li className="text-xs text-slate-600">
												+ {files.length - 5} more files
											</li>
										)}
									</ul>
								</div>
							)}
						</>
					) : (
						<>
							<div className="mb-4 text-4xl">⏳</div>
							<h2 className="text-2xl font-bold text-slate-900 mb-4">Uploading...</h2>

							{/* Progress Bar */}
							<div className="w-full bg-slate-200 rounded-full h-2 mb-4 overflow-hidden">
								<div
									className="bg-blue-600 h-full transition-all"
									style={{ width: `${uploadProgress}%` }}
								/>
							</div>

							<p className="text-slate-600">{Math.round(uploadProgress)}% complete</p>
						</>
					)}
				</div>

				{/* Tips */}
				<div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
					<p className="text-sm font-medium text-blue-900 mb-2">💡 Tips for best results:</p>
					<ul className="text-xs text-blue-800 space-y-1">
						<li>• Clear, well-lit photos from multiple angles</li>
						<li>• Include close-ups of details and hallmarks</li>
						<li>• At least 3-5 images per item</li>
						<li>• JPEG or PNG format recommended</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
