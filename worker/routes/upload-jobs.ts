/**
 * Upload Jobs API Routes
 * Browser automation job management
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import { createUploadJob, getUploadJobById, getCSVExportById } from "../db/listings";

const app = new Hono<{ Bindings: Env }>();

// Create upload job for an export
app.post("/", async (c) => {
	try {
		const { exportId } = await c.req.json();

		if (!exportId) {
			return c.json({ success: false, error: "exportId required" }, 400);
		}

		// Verify export exists
		const exportRecord = await getCSVExportById(c.env.DB, exportId);
		if (!exportRecord) {
			return c.json({ success: false, error: "Export not found" }, 404);
		}

		const jobId = await createUploadJob(c.env.DB, exportId);

		// Get BrowserSession DO stub
		const id = c.env.BROWSER_SESSION.idFromName(jobId);
		const stub = c.env.BROWSER_SESSION.get(id);

		// Trigger browser job (async)
		const csvR2Key = exportRecord.r2_key;
		if (csvR2Key) {
			// Fire and forget - the DO handles the job
			c.executionCtx.waitUntil(
				stub.fetch("http://internal/execute", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId, exportId, csvR2Key }),
				} as any)
			);
		}

		return c.json({
			success: true,
			data: { id: jobId, status: "pending" },
		}, 201);
	} catch (error) {
		console.error("Upload job creation error:", error);
		return c.json({ success: false, error: "Failed to create upload job" }, 500);
	}
});

// Get upload job status
app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const job = await getUploadJobById(c.env.DB, id);

	if (!job) {
		return c.json({ success: false, error: "Job not found" }, 404);
	}

	return c.json({ success: true, data: job });
});

// WebSocket endpoint for real-time updates
app.get("/:id/ws", async (c) => {
	const id = c.req.param("id");

	// Upgrade to WebSocket via BrowserSession DO
	const doId = c.env.BROWSER_SESSION.idFromName(id);
	const stub = c.env.BROWSER_SESSION.get(doId);

	// Forward the upgrade request to the DO
	return stub.fetch(c.req.raw as any);
});

export default app;
