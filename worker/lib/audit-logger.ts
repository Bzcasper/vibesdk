/**
 * Audit Logger — Production Security Logging
 * Logs all token operations, API calls, and state changes
 */

import { D1Database } from "@cloudflare/workers-types";

export interface AuditEvent {
	storeId: string;
	userId?: string;
	workspaceId?: string;
	platform: string;
	action: string;
	details?: any;
	ipAddress?: string;
	userAgent?: string;
	success: boolean;
	errorMessage?: string;
}

export class AuditLogger {
	constructor(private db: D1Database) {}

	/**
	 * Log token operation
	 */
	async logTokenOperation(event: AuditEvent): Promise<boolean> {
		try {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();

			const result = await this.db.prepare(`
				INSERT INTO token_audit_log 
				(id, store_id, user_id, workspace_id, platform, action, details, ip_address, user_agent, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				id,
				event.storeId,
				event.userId || null,
				event.workspaceId || null,
				event.platform,
				event.action,
				JSON.stringify(event.details || {}),
				event.ipAddress || null,
				event.userAgent || null,
				now
			).run();

			return result.success;
		} catch (error) {
			console.error("[AuditLogger] Failed to log token operation:", error);
			return false;
		}
	}

	/**
	 * Log token rotation
	 */
	async logTokenRotation(
		storeId: string,
		userId: string,
		platform: string,
		oldTokenHash: string,
		newTokenHash: string,
		reason: "auto_refresh" | "manual_request" | "expiry"
	): Promise<boolean> {
		try {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();

			const result = await this.db.prepare(`
				INSERT INTO token_rotation_history
				(id, store_id, user_id, platform, old_token_hash, new_token_hash, rotation_reason, rotated_at, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				id,
				storeId,
				userId,
				platform,
				oldTokenHash,
				newTokenHash,
				reason,
				now,
				now
			).run();

			return result.success;
		} catch (error) {
			console.error("[AuditLogger] Failed to log token rotation:", error);
			return false;
		}
	}

	/**
	 * Log token usage metrics
	 */
	async logUsageMetric(
		storeId: string,
		userId: string,
		platform: string,
		action: string,
		success: boolean,
		durationMs: number,
		errorMessage?: string
	): Promise<boolean> {
		try {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();

			const result = await this.db.prepare(`
				INSERT INTO token_usage_metrics
				(id, store_id, user_id, platform, action, success, duration_ms, error_message, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				id,
				storeId,
				userId,
				platform,
				action,
				success ? 1 : 0,
				durationMs,
				errorMessage || null,
				now
			).run();

			return result.success;
		} catch (error) {
			console.error("[AuditLogger] Failed to log usage metric:", error);
			return false;
		}
	}

	/**
	 * Get audit trail for a store
	 */
	async getAuditTrail(
		storeId: string,
		limit: number = 100
	): Promise<any[]> {
		try {
			const result = await this.db.prepare(`
				SELECT * FROM token_audit_log
				WHERE store_id = ?
				ORDER BY created_at DESC
				LIMIT ?
			`).bind(storeId, limit).all() as any;

			return result?.results || [];
		} catch (error) {
			console.error("[AuditLogger] Failed to get audit trail:", error);
			return [];
		}
	}

	/**
	 * Log compliance checkpoint
	 */
	async logComplianceCheckpoint(
		storeId: string,
		checkpointType: string,
		status: "passed" | "failed" | "warning",
		details?: any
	): Promise<boolean> {
		try {
			const id = crypto.randomUUID();
			const now = new Date().toISOString();

			const result = await this.db.prepare(`
				INSERT INTO compliance_checkpoints
				(id, store_id, checkpoint_type, status, details, checked_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).bind(
				id,
				storeId,
				checkpointType,
				status,
				JSON.stringify(details || {}),
				now
			).run();

			return result.success;
		} catch (error) {
			console.error("[AuditLogger] Failed to log compliance checkpoint:", error);
			return false;
		}
	}
}
