/**
 * API Routes Setup
 * Registers all API routes with the Hono app
 */

import type { Hono } from 'hono';
import type { AppEnv } from '../types/appenv';

/**
 * Setup all API routes
 * This is a placeholder implementation - routes are handled by honoAdapter
 */
export function setupRoutes(_app: Hono<AppEnv>): void {
  // Routes are handled by honoAdapter which mounts controllers directly
  // This function exists for compatibility with the app.ts import
}
