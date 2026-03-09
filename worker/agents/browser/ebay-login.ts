/**
 * eBay Login Manager
 *
 * Manages eBay session cookies for browser automation.
 * Strategy: seller logs in manually once → we save the cookies → reuse them.
 * 
 * NOTE: This is a stub implementation for Cloudflare Workers.
 * In production, this would integrate with a browser automation service
 * like Browserbase, Browserless, or a dedicated browser DO.
 */

import { Env } from "../../types/env";

// ============================================================
// Error Classes
// ============================================================

export class LoginRequiredError extends Error {
	code = "LOGIN_REQUIRED" as const;
	constructor() {
		super("eBay session expired or missing. Re-authenticate via Settings > eBay Connection.");
		this.name = "LoginRequiredError";
	}
}

export class SessionExpiredError extends Error {
	code = "SESSION_EXPIRED" as const;
	constructor() {
		super("eBay session has expired. Please re-authenticate.");
		this.name = "SessionExpiredError";
	}
}

// ============================================================
// Cookie Storage Keys
// ============================================================

const COOKIE_KEY = "ebay_session_cookies";
const CAPTURED_AT_KEY = "ebay_session_captured_at";
const COOKIE_TTL = 72000; // 20 hours in seconds

// ============================================================
// Cookie Management Functions
// ============================================================

export interface EbayCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	secure: boolean;
	httpOnly?: boolean;
	expiry?: number;
}

/**
 * Save session cookies to KV storage
 */
export async function saveSessionCookies(cookies: EbayCookie[], env: Env): Promise<void> {
	if (!env.TOKENS) {
		throw new Error("TOKENS KV namespace not configured");
	}

	// Filter to .ebay.com domain only
	const ebayCookies = cookies.filter((c) => c.domain.includes("ebay.com"));

	// Store cookies
	await env.TOKENS.put(COOKIE_KEY, JSON.stringify(ebayCookies), {
		expirationTtl: COOKIE_TTL,
	});

	// Store capture timestamp
	await env.TOKENS.put(CAPTURED_AT_KEY, new Date().toISOString(), {
		expirationTtl: COOKIE_TTL,
	});
}

/**
 * Check if a valid session exists
 */
export async function isSessionValid(env: Env): Promise<boolean> {
	if (!env.TOKENS) {
		return false;
	}

	const cookies = await env.TOKENS.get(COOKIE_KEY);
	return cookies !== null;
}

/**
 * Get session capture timestamp
 */
export async function getSessionCapturedAt(env: Env): Promise<string | null> {
	if (!env.TOKENS) {
		return null;
	}

	return await env.TOKENS.get(CAPTURED_AT_KEY);
}

/**
 * Restore session cookies from KV storage
 */
export async function getSessionCookies(env: Env): Promise<EbayCookie[] | null> {
	if (!env.TOKENS) {
		return null;
	}

	const cookiesJson = await env.TOKENS.get(COOKIE_KEY);
	if (!cookiesJson) {
		return null;
	}

	try {
		return JSON.parse(cookiesJson) as EbayCookie[];
	} catch {
		return null;
	}
}

/**
 * Clear stored session cookies
 */
export async function clearSession(env: Env): Promise<void> {
	if (!env.TOKENS) {
		return;
	}

	await env.TOKENS.delete(COOKIE_KEY);
	await env.TOKENS.delete(CAPTURED_AT_KEY);
}

// ============================================================
// Browser Page Helper (Stub for Cloudflare Workers)
// ============================================================

/**
 * Get an authenticated page ready for eBay operations
 * 
 * NOTE: In Cloudflare Workers, actual browser automation requires
 * integration with an external service. This is a stub that would
 * be implemented with Browserbase, Browserless, or similar.
 */
export async function getReadyPage(
	_env: Env,
	_onStep?: (step: string) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
	// This is a stub implementation
	// In production, this would:
	// 1. Create a new browser page via browser automation service
	// 2. Restore session cookies
	// 3. Navigate to eBay Seller Hub
	// 4. Verify authentication state
	// 5. Return the authenticated page or throw LoginRequiredError

	return {
		success: false,
		error: "Browser automation requires external service integration (Browserbase, Browserless, etc.)",
	};
}

/**
 * Validate session by making a request to eBay
 */
export async function validateEbaySession(env: Env): Promise<{
	valid: boolean;
	lastCaptured?: string;
	error?: string;
}> {
	const isValid = await isSessionValid(env);
	if (!isValid) {
		return { valid: false, error: "No session cookies stored" };
	}

	const capturedAt = await getSessionCapturedAt(env);

	// In production, would make actual request to eBay to verify session
	// For now, just check if cookies exist
	return {
		valid: true,
		lastCaptured: capturedAt || undefined,
	};
}

// ============================================================
// OAuth Flow Helpers (for future implementation)
// ============================================================

export interface EbayOAuthConfig {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	scopes: string[];
}

/**
 * Generate eBay OAuth authorization URL
 */
export function getOAuthAuthorizationUrl(config: EbayOAuthConfig, state: string): string {
	const params = new URLSearchParams({
		client_id: config.clientId,
		redirect_uri: config.redirectUri,
		response_type: "code",
		scope: config.scopes.join(" "),
		state,
	});

	return `https://auth.ebay.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
	code: string,
	config: EbayOAuthConfig
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
	const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

	const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${credentials}`,
		},
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: config.redirectUri,
		}).toString(),
	});

	if (!response.ok) {
		throw new Error(`OAuth token exchange failed: ${response.status}`);
	}

	return await response.json();
}
