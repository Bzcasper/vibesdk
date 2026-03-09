/**
 * Grok Queue Job Handler
 * Processes Grok enrichment in background via Cloudflare Queue
 */

import { D1Database, Queue, R2Bucket } from "@cloudflare/workers-types";
import { GrokAIPipeline } from "../lib/ai-grok";

export interface GrokJob {
	jobId: string;
	listingId: string;
	imageBase64: string;
	mimeType: string;
	folder: string;
	createdAt: string;
}

export interface GrokJobResult {
	jobId: string;
	status: "pending" | "processing" | "completed" | "failed";
	result?: {
		title: string;
		description: string;
		price_suggested: number;
		item_specifics: Record<string, string>;
		raw_analysis: any;
		provider: string;
	};
	error?: string;
	completedAt?: string;
}

export async function handleGrokJob(
	job: GrokJob,
	db: D1Database,
	media: R2Bucket,
	apiKey: string,
): Promise<GrokJobResult> {
	console.log(`[GrokQueue] Processing job ${job.jobId}`);

	try {
		// Initialize Grok pipeline
		const grok = new GrokAIPipeline(apiKey);

		// Update status to processing
		await updateJobStatus(db, job.jobId, "processing");

		// Run full enrichment (this takes ~60-90s but runs in queue worker)
		const result = await grok.enrichFromImage(
			job.imageBase64,
			job.mimeType,
		);

		// Save listing to database
		const now = new Date().toISOString();
		await db
			.prepare(
				`
			INSERT INTO listings (id, sku, status, title, description, price_final, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`,
			)
			.bind(
				job.listingId,
				job.folder,
				"ready",
				result.title,
				result.description,
				result.price_suggested,
				now,
				now,
			)
			.run();

		// Save item specifics
		for (const [key, value] of Object.entries(result.item_specifics)) {
			const fieldId = crypto.randomUUID();
			const valueStr =
				typeof value === "string" ? value : JSON.stringify(value);
			await db
				.prepare(
					`
				INSERT INTO listing_fields (id, listing_id, key, value, ai_suggested, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`,
				)
				.bind(fieldId, job.listingId, key, valueStr, 1, now)
				.run();
		}

		// Update job as completed
		const jobResult: GrokJobResult = {
			jobId: job.jobId,
			status: "completed",
			result: {
				...result,
				provider: "grok",
			},
			completedAt: new Date().toISOString(),
		};

		await saveJobResult(db, jobResult);

		console.log(`[GrokQueue] Job ${job.jobId} completed successfully`);
		return jobResult;
	} catch (error) {
		console.error(`[GrokQueue] Job ${job.jobId} failed:`, error);

		const jobResult: GrokJobResult = {
			jobId: job.jobId,
			status: "failed",
			error: (error as Error).message,
			completedAt: new Date().toISOString(),
		};

		await saveJobResult(db, jobResult);
		return jobResult;
	}
}

async function updateJobStatus(
	db: D1Database,
	jobId: string,
	status: string,
): Promise<void> {
	await db
		.prepare(
			`
		INSERT INTO grok_jobs (job_id, status, created_at)
		VALUES (?, ?, ?)
		ON CONFLICT(job_id) DO UPDATE SET status = ?, updated_at = ?
	`,
		)
		.bind(
			jobId,
			status,
			new Date().toISOString(),
			status,
			new Date().toISOString(),
		)
		.run();
}

async function saveJobResult(
	db: D1Database,
	result: GrokJobResult,
): Promise<void> {
	await db
		.prepare(
			`
		INSERT INTO grok_jobs (job_id, status, result, error, completed_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(job_id) DO UPDATE SET status = ?, result = ?, error = ?, completed_at = ?, updated_at = ?
	`,
		)
		.bind(
			result.jobId,
			result.status,
			result.result ? JSON.stringify(result.result) : null,
			result.error || null,
			result.completedAt || null,
			new Date().toISOString(),
			result.status,
			result.result ? JSON.stringify(result.result) : null,
			result.error || null,
			result.completedAt || null,
			new Date().toISOString(),
		)
		.run();
}

/**
 * Get job status from database
 */
export async function getJobStatus(
	db: D1Database,
	jobId: string,
): Promise<GrokJobResult | null> {
	const row = (await db
		.prepare(
			`
		SELECT job_id, status, result, error, completed_at
		FROM grok_jobs
		WHERE job_id = ?
	`,
		)
		.bind(jobId)
		.first()) as any;

	if (!row) return null;

	return {
		jobId: row.job_id,
		status: row.status,
		result: row.result ? JSON.parse(row.result) : undefined,
		error: row.error,
		completedAt: row.completed_at,
	};
}
