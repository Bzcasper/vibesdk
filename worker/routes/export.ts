/**
 * Export API Routes
 * CSV export generation endpoints
 */

import { Hono } from "hono";
import { Env } from "../types/env";
import { createCSVExport, getCSVExportById, updateCSVExport, listListingsByStatus } from "../db/listings";
import { ListingStatus } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

// Create CSV export for listings
app.post("/", async (c) => {
	try {
		const { listingIds } = await c.req.json();

		if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
			return c.json({ success: false, error: "listingIds array required" }, 400);
		}

		const exportId = await createCSVExport(c.env.DB, listingIds);

		// TODO: Queue CSV generation job
		// await c.env.QUEUE_BROWSER.send({ type: 'csv_generate', exportId, listingIds });

		return c.json({
			success: true,
			data: { id: exportId, status: "pending" },
		}, 201);
	} catch (error) {
		console.error("Export creation error:", error);
		return c.json({ success: false, error: "Failed to create export" }, 500);
	}
});

// Get export status
app.get("/:id", async (c) => {
	const id = c.req.param("id");
	const exportRecord = await getCSVExportById(c.env.DB, id);

	if (!exportRecord) {
		return c.json({ success: false, error: "Export not found" }, 404);
	}

	return c.json({ success: true, data: exportRecord });
});

// Download CSV
app.get("/:id/download", async (c) => {
	const id = c.req.param("id");
	const exportRecord = await getCSVExportById(c.env.DB, id);

	if (!exportRecord) {
		return c.json({ success: false, error: "Export not found" }, 404);
	}

	if (!exportRecord.r2_key) {
		return c.json({ success: false, error: "CSV not yet generated" }, 400);
	}

	// Get from R2
	const object = await c.env.R2_PROD.get(exportRecord.r2_key);
	if (!object) {
		return c.json({ success: false, error: "CSV file not found" }, 404);
	}

	return new Response(object.body as any, {
		headers: {
			"Content-Type": "text/csv",
			"Content-Disposition": `attachment; filename="export-${id}.csv"`,
		},
	});
});

export default app;
