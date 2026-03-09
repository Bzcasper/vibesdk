/**
 * ListingSession Durable Object
 *
 * Manages per-listing state, WebSocket connections for live updates,
 * and serves as the "build lock" to prevent concurrent pipeline execution.
 *
 * Keyed by listing UUID - one instance per listing.
 */

import { DurableObject } from "cloudflare:workers";
import { Env, ListingStatus } from "../types/env";

// ============================================================
// Types
// ============================================================

export interface ListingSessionState {
	listingId: string;
	status: ListingStatus;
	currentStep: string | null;
	stepHistory: Array<{
		step: string;
		status: "running" | "complete" | "error";
		duration_ms: number;
		timestamp: string;
	}>;
	fields: Record<string, unknown>;
	error: string | null;
	buildLock: boolean;
	createdAt: string;
	updatedAt: string;
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

export class ListingSession extends DurableObject<Env> {
	private state: ListingSessionState;
	private connections: Set<WebSocketWithExtensions> = new Set();
	private stepStartTime: number | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		// Initialize default state
		this.state = {
			listingId: "",
			status: ListingStatus.DRAFT,
			currentStep: null,
			stepHistory: [],
			fields: {},
			error: null,
			buildLock: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Restore state from storage
		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<ListingSessionState>("state");
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

		// REST API routes
		if (request.method === "POST" && path === "/init") {
			return this.handleInit(request);
		}

		if (request.method === "GET" && path === "/state") {
			return this.handleGetState();
		}

		if (request.method === "POST" && path === "/step/start") {
			return this.handleStepStart(request);
		}

		if (request.method === "POST" && path === "/step/complete") {
			return this.handleStepComplete(request);
		}

		if (request.method === "POST" && path === "/step/error") {
			return this.handleStepError(request);
		}

		if (request.method === "POST" && path === "/field") {
			return this.handleSetField(request);
		}

		return new Response("Not found", { status: 404 });
	}

	// ============================================================
	// Route Handlers
	// ============================================================

	private async handleInit(request: Request): Promise<Response> {
		const body = await request.json<{ listingId: string }>();
		const { listingId } = body;

		if (!listingId) {
			return new Response(JSON.stringify({ error: "listingId required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Check build lock
		if (this.state.buildLock) {
			return new Response(JSON.stringify({ error: "Build already in progress" }), {
				status: 409,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Initialize state
		this.state = {
			listingId,
			status: ListingStatus.ENRICHING,
			currentStep: null,
			stepHistory: [],
			fields: {},
			error: null,
			buildLock: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await this.persistState();

		return new Response(JSON.stringify({ success: true, state: this.state }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleGetState(): Promise<Response> {
		return new Response(JSON.stringify(this.state), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleStepStart(request: Request): Promise<Response> {
		const body = await request.json<{ step: string }>();
		const { step } = body;

		this.state.currentStep = step;
		this.stepStartTime = Date.now();

		this.broadcast({
			type: "step_start",
			step,
			timestamp: new Date().toISOString(),
		});

		await this.persistState();

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleStepComplete(request: Request): Promise<Response> {
		const body = await request.json<{ step: string; output?: unknown }>();
		const { step, output } = body;

		const duration_ms = this.stepStartTime ? Date.now() - this.stepStartTime : 0;

		this.state.stepHistory.push({
			step,
			status: "complete",
			duration_ms,
			timestamp: new Date().toISOString(),
		});

		this.state.currentStep = null;
		this.stepStartTime = null;

		this.broadcast({
			type: "step_complete",
			step,
			output,
			duration_ms,
		});

		await this.persistState();

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleStepError(request: Request): Promise<Response> {
		const body = await request.json<{ step: string; error: string }>();
		const { step, error } = body;

		const duration_ms = this.stepStartTime ? Date.now() - this.stepStartTime : 0;

		this.state.stepHistory.push({
			step,
			status: "error",
			duration_ms,
			timestamp: new Date().toISOString(),
		});

		this.state.currentStep = null;
		this.state.error = error;
		this.stepStartTime = null;

		this.broadcast({
			type: "step_error",
			step,
			error,
		});

		await this.persistState();

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private async handleSetField(request: Request): Promise<Response> {
		const body = await request.json<{
			key: string;
			value: unknown;
			aiSuggested?: boolean;
			confidence?: number;
		}>();
		const { key, value, aiSuggested = false, confidence = null } = body;

		this.state.fields[key] = {
			value,
			aiSuggested,
			confidence,
		};

		this.broadcast({
			type: "field_ready",
			key,
			value,
			ai_suggested: aiSuggested,
			confidence,
		});

		await this.persistState();

		return new Response(JSON.stringify({ success: true }), {
			headers: { "Content-Type": "application/json" },
		});
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

		// Handle close
		server.addEventListener("close", () => {
			this.connections.delete(server);
		});

		// Handle errors
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
		this.state.updatedAt = new Date().toISOString();
		await this.ctx.storage.put("state", this.state);
	}

	// ============================================================
	// Public Methods (for internal Worker calls)
	// ============================================================

	async completeBuild(): Promise<void> {
		this.state.buildLock = false;
		this.state.status = ListingStatus.READY;
		this.broadcast({ type: "listing_complete" });
		await this.persistState();
	}

	async releaseLock(): Promise<void> {
		this.state.buildLock = false;
		await this.persistState();
	}
}
