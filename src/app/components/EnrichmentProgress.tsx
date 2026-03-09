/**
 * EnrichmentProgress Component
 * Shows real-time enrichment pipeline progress
 */

interface EnrichmentState {
	status: string;
	currentStep: string | null;
	stepHistory: Array<{
		step: string;
		status: string;
		duration_ms: number;
		timestamp: string;
	}>;
	error: string | null;
}

interface Props {
	listing: EnrichmentState;
}

const ENRICHMENT_STEPS = [
	{ id: 'ingest', name: 'Ingest Images', description: 'Validating and organizing images' },
	{ id: 'classify', name: 'Classify', description: 'Detecting jewelry type and category' },
	{ id: 'extract_fields', name: 'Extract Fields', description: 'Analyzing details and condition' },
	{ id: 'complete_fields', name: 'Complete Fields', description: 'Filling in missing information' },
	{ id: 'generate_titles', name: 'Generate Titles', description: 'Creating platform-specific titles' },
	{ id: 'generate_descriptions', name: 'Generate Descriptions', description: 'Writing compelling descriptions' },
	{ id: 'suggest_pricing', name: 'Suggest Pricing', description: 'Analyzing market and recommending prices' },
	{ id: 'process_images', name: 'Process Images', description: 'Optimizing images for platforms' },
];

export default function EnrichmentProgress({ listing }: Props) {
	const getStepStatus = (stepId: string) => {
		const history = listing.stepHistory.find((h) => h.step === stepId);
		if (history) {
			return history.status;
		}
		if (listing.currentStep === stepId) {
			return 'running';
		}
		return 'pending';
	};

	const isStepCompleted = (stepId: string) => {
		return listing.stepHistory.some((h) => h.step === stepId && h.status === 'complete');
	};

	const isStepRunning = (stepId: string) => {
		return listing.currentStep === stepId;
	};

	return (
		<div className="bg-white rounded-lg border border-slate-200 p-6">
			<h2 className="text-lg font-semibold text-slate-900 mb-6">Enrichment Progress</h2>

			{/* Status Overview */}
			<div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-slate-600">Overall Status</p>
						<p className="text-2xl font-bold text-slate-900 capitalize mt-1">{listing.status}</p>
					</div>
					<div className="text-right">
						<p className="text-sm font-medium text-slate-600">
							{listing.stepHistory.filter((h) => h.status === 'complete').length}/{ENRICHMENT_STEPS.length} Steps
						</p>
						{listing.error && (
							<p className="text-sm text-red-600 mt-1">⚠️ {listing.error}</p>
						)}
					</div>
				</div>
			</div>

			{/* Progress Bar */}
			<div className="mb-6">
				<div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
					<div
						className={`h-full transition-all ${
							listing.status === 'ready'
								? 'bg-green-600'
								: listing.status === 'error'
									? 'bg-red-600'
									: 'bg-blue-600'
						}`}
						style={{
							width: `${(listing.stepHistory.filter((h) => h.status === 'complete').length / ENRICHMENT_STEPS.length) * 100}%`,
						}}
					/>
				</div>
			</div>

			{/* Steps Timeline */}
			<div className="space-y-3">
				{ENRICHMENT_STEPS.map((step, index) => {
					const status = getStepStatus(step.id);
					const completed = isStepCompleted(step.id);
					const running = isStepRunning(step.id);
					const stepHistory = listing.stepHistory.find((h) => h.step === step.id);

					return (
						<div
							key={step.id}
							className={`flex items-start gap-4 p-3 rounded-lg border transition-all ${
								completed
									? 'bg-green-50 border-green-200'
									: running
										? 'bg-blue-50 border-blue-200'
										: 'bg-slate-50 border-slate-200'
							}`}
						>
							{/* Status Icon */}
							<div className="mt-0.5">
								{completed && <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
									<span className="text-white text-sm">✓</span>
								</div>}
								{running && <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
									<span className="text-white text-sm animate-spin">⟳</span>
								</div>}
								{!completed && !running && <div className="w-6 h-6 rounded-full bg-slate-300" />}
							</div>

							{/* Content */}
							<div className="flex-1 min-w-0">
								<p className={`font-medium ${
									running ? 'text-blue-900' : completed ? 'text-green-900' : 'text-slate-900'
								}`}>
									{step.name}
								</p>
								<p className="text-sm text-slate-600">{step.description}</p>
								{stepHistory && completed && (
									<p className="text-xs text-slate-500 mt-1">
										✓ Completed in {stepHistory.duration_ms}ms
									</p>
								)}
							</div>

							{/* Step Number */}
							<div className="text-sm font-medium text-slate-600">{index + 1}</div>
						</div>
					);
				})}
			</div>

			{/* Error Display */}
			{listing.error && (
				<div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
					<p className="font-medium text-red-900">❌ Error occurred</p>
					<p className="text-sm text-red-800 mt-1">{listing.error}</p>
				</div>
			)}
		</div>
	);
}
