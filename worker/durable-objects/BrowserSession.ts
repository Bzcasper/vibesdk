/**
 * BrowserSession Durable Object
 *
 * Holds one Puppeteer browser instance for the duration of one CSV upload job.
 * Keyed by upload job UUID.
 */

import { DurableObject } from "cloudflare:workers";
import { Env, UploadJobStatus } from "../types/env";

// ============================================================
// Types
// ============================================================

export interface BrowserSessionState {
	jobId: string | null;
	exportId: string | null;
	status: UploadJobStatus;
	currentStep: string;
	screenshotR2Keys: string[];
	successCount: number;
	errorCount: number;
	errorMessages: string[];
	error: string | null;
	startedAt: string | null;
	completedAt: string | null;
}

interface WebSocketMessage {
	type: string;
	[key: string]: unknown;
}

type WebSocketWithExtensions = WebSocket & {
	accept: () => void;
	send: (data: string) => void;
	close: (code?: number, reason?: string) => void;
};

// ============================================================
// Durable Object Implementation
// ============================================================

export class BrowserSession extends DurableObject<Env> {
	private state: BrowserSessionState;
	private connections: Set<WebSocketWithExtensions> = new Set();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.state = {
			jobId: null,
			exportId: null,
			status: UploadJobStatus.PENDING,
			currentStep: "idle",
			screenshotR2Keys: [],
			successCount: 0,
			errorCount: 0,
			errorMessages: [],
			error: null,
			startedAt: null,
			completedAt: null,
		};

		// Restore state from storage
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<BrowserSessionState>("state");
			if (stored) {
				this.state = stored;
			}
		});
	}

	// ============================================================
	// HTTP Request Handler
	// ============================================================

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// WebSocket upgrade
		if (path === "/upgrade" || request.headers.get("Upgrade") === "websocket") {
			return this.handleWebSocketUpgrade(request);
		}

		// Execute browser job
		if (request.method === "POST" && path === "/execute") {
			return this.handleExecute(request);
		}

		// Get state
		if (request.method === "GET" && path === "/state") {
			return this.handleGetState();
		}

		return new Response("Not found", { status: 404 });
	}

	// ============================================================
	// Route Handlers
	// ============================================================

	private async handleExecute(request: Request): Promise<Response> {
		const body = await request.json<{ jobId: string; exportId: string; csvR2Key: string }>();
		const { jobId, exportId, csvR2Key } = body;

		if (!jobId || !exportId || !csvR2Key) {
			return new Response(JSON.stringify({ error: "Missing required fields" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Initialize state
		this.state = {
			jobId,
			exportId,
			status: UploadJobStatus.LAUNCHING,
			currentStep: "initializing",
			screenshotR2Keys: [],
			successCount: 0,
			errorCount: 0,
			errorMessages: [],
			error: null,
			startedAt: new Date().toISOString(),
			completedAt: null,
		};

		await this.persistState();

		// Run job asynchronously
		this.ctx.waitUntil(this.runJob(csvR2Key));

		// Return immediately (202 Accepted)
		return new Response(JSON.stringify({ success: true, status: "started" }), {
			status: 202,
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleGetState(): Promise<Response> {
		return new Response(JSON.stringify(this.state), {
			headers: { "Content-Type": "application/json" },
		});
	}

	// ============================================================
	// Browser Job Execution
	// ============================================================

	private async runJob(_csvR2Key: string): Promise<void> {
		try {
			// Step 1: Launch browser
			await this.setStep("launching_browser");
			// TODO: Launch browser using Puppeteer
			// const browser = await puppeteer.launch(this.env.BROWSER);

			// Step 2: Navigate to eBay Seller Hub
			await this.setStep("navigating_to_ebay");
			// TODO: Navigate to eBay Seller Hub

			// Step 3: Handle login if needed
			await this.setStep("checking_login");
			// TODO: Check if logged in, handle login if needed

			// Step 4: Upload CSV
			await this.setStep("uploading_csv");
			// TODO: Upload the CSV file

			// Step 5: Wait for results
			await this.setStep("waiting_for_results");
			// TODO: Wait for upload to complete

			// Complete
			this.state.status = UploadJobStatus.DONE;
			this.state.currentStep = "complete";
			this.state.completedAt = new Date().toISOString();

			this.broadcast({
				type: "job_complete",
				successCount: this.state.successCount,
				errorCount: this.state.errorCount,
			});

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			this.state.status = UploadJobStatus.ERROR;
			this.state.error = errorMessage;
			this.state.currentStep = "error";
			this.state.errorMessages.push(errorMessage);

			this.broadcast({
				type: "job_error",
				error: errorMessage,
				lastScreenshotKey: this.state.screenshotR2Keys.at(-1) || null,
			});
		}

		await this.persistState();
	}

	private async setStep(step: string): Promise<void> {
		this.state.currentStep = step;
		this.broadcast({ type: "job_step", step });
		await this.persistState();
	}

	// ============================================================
	// WebSocket Handling
	// ============================================================

	private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair) as [WebSocket, WebSocketWithExtensions];

		server.accept();
		this.connections.add(server);

		// Send current state on connect
		server.send(JSON.stringify({
			type: "state_sync",
			state: this.state,
		}));

		server.addEventListener("close", () => {
			this.connections.delete(server);
		});

		server.addEventListener("error", () => {
			this.connections.delete(server);
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	private broadcast(message: WebSocketMessage): void {
		const data = JSON.stringify(message);
		for (const ws of this.connections) {
			try {
				ws.send(data);
			} catch {
				this.connections.delete(ws);
			}
		}
	}

	// ============================================================
	// State Persistence
	// ============================================================

	private async persistState(): Promise<void> {
		await this.ctx.storage.put("state", this.state);
	}

	// ============================================================
	// Screenshot Management
	// ============================================================

	async captureScreenshot(step: string): Promise<string> {
		// TODO: Capture screenshot using Puppeteer
		// const screenshot = await page.screenshot();
		// const r2Key = `screenshots/${this.state.jobId}/${step}-${Date.now()}.png`;
		// await this.env.R2_PROD.put(r2Key, screenshot);
		// this.state.screenshotR2Keys.push(r2Key);
		// this.broadcast({ type: "screenshot_ready", r2Key, step });
		// return r2Key;

		const r2Key = `screenshots/${this.state.jobId}/${step}-${Date.now()}.png`;
		this.state.screenshotR2Keys.push(r2Key);
		this.broadcast({ type: "screenshot_ready", r2Key, step });
		return r2Key;
	}
}
