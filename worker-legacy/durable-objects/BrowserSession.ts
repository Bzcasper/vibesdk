/**
 * BrowserSession Durable Object
 *
 * Holds one Puppeteer browser instance for the duration of one CSV upload job.
 */

import { DurableObject } from "cloudflare:workers";
import { Env, UploadJobStatus } from "../types/env";

export interface BrowserSessionState {
	jobId: string | null;
	status: UploadJobStatus;
	currentStep: string;
	error: string | null;
	startedAt: string | null;
	completedAt: string | null;
}

export class BrowserSession extends DurableObject<Env> {
	private sessionState: BrowserSessionState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.sessionState = {
			jobId: null,
			status: UploadJobStatus.PENDING,
			currentStep: "idle",
			error: null,
			startedAt: null,
			completedAt: null,
		};
	}

	async fetch(request: Request): Promise<Response> {
		return new Response(JSON.stringify(this.sessionState), {
			headers: { "Content-Type": "application/json" },
		});
	}
}
