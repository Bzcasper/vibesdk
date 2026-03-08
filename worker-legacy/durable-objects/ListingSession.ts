/**
 * ListingSession Durable Object
 *
 * Manages per-listing state, WebSocket connections for live updates,
 * and serves as the "build lock" to prevent concurrent pipeline execution.
 */

import { DurableObject } from "cloudflare:workers";
import { Env, ListingStatus } from "../types/env";

export interface ListingSessionState {
	listingId: string;
	status: ListingStatus;
	currentStep: string | null;
	fields: Record<string, unknown>;
	error: string | null;
	createdAt: string;
	updatedAt: string;
}

export class ListingSession extends DurableObject<Env> {
	private sessionState: ListingSessionState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.sessionState = {
			listingId: "",
			status: ListingStatus.DRAFT,
			currentStep: null,
			fields: {},
			error: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Initialize state
		this.ctx.blockConcurrencyWhile(async () => {
			const stored =
				await this.ctx.storage.get<ListingSessionState>("state");
			if (stored) {
				this.sessionState = stored;
			}
		});
	}

	async fetch(request: Request): Promise<Response> {
		return new Response(JSON.stringify(this.sessionState), {
			headers: { "Content-Type": "application/json" },
		});
	}
}
