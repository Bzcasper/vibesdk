/**
 * InventoryLock Durable Object
 * 
 * Global singleton that manages the sold/available registry.
 * Prevents cross-platform oversell by enforcing atomic sell-lock.
 * 
 * There is only ONE instance of this DO (named 'global').
 * All platform webhooks query this before processing sales.
 */

import type { Env, Platform } from '../env';

interface LockState {
  listingId: string;
  status: 'available' | 'reserved' | 'sold';
  soldOn: Platform | null;
  soldAt: string | null;
  reservedBy: Platform | null;
  reservedAt: string | null;
  endedPlatforms: Platform[];
  version: number;
}

interface PendingEnd {
  listingId: string;
  platform: Platform;
  scheduledAt: string;
  attempts: number;
}

export class InventoryLock {
  private state: DurableObjectState;
  private env: Env;
  private locks: Map<string, LockState> = new Map();
  private pendingEnds: PendingEnd[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Load persisted locks from storage
    this.state.blockConcurrencyWhile(async () => {
      const locks = await this.state.storage.get<Map<string, LockState>>('locks');
      if (locks) {
        this.locks = locks;
      }
      const pending = await this.state.storage.get<PendingEnd[]>('pendingEnds');
      if (pending) {
        this.pendingEnds = pending;
      }
    });
  }

  // ============================================================
  // HTTP FETCH HANDLER
  // ============================================================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // POST /acquire — Try to acquire a reservation for publishing
    if (request.method === 'POST' && path === '/acquire') {
      const { listingId, platform } = await request.json();
      return this.acquireReservation(listingId, platform);
    }

    // POST /release — Release a reservation
    if (request.method === 'POST' && path === '/release') {
      const { listingId, platform } = await request.json();
      return this.releaseReservation(listingId, platform);
    }

    // POST /sell — Mark as sold, trigger cross-platform end
    if (request.method === 'POST' && path === '/sell') {
      const { listingId, platform, externalOrderId } = await request.json();
      return this.markSold(listingId, platform, externalOrderId);
    }

    // POST /end — Mark a platform listing as ended
    if (request.method === 'POST' && path === '/end') {
      const { listingId, platform } = await request.json();
      return this.markEnded(listingId, platform);
    }

    // GET /status/:listingId — Get lock status
    if (request.method === 'GET' && path.startsWith('/status/')) {
      const listingId = path.replace('/status/', '');
      return this.getStatus(listingId);
    }

    // GET /pending-ends — Get pending end operations
    if (request.method === 'GET' && path === '/pending-ends') {
      return Response.json({ pendingEnds: this.pendingEnds });
    }

    // POST /retry-ends — Retry failed end operations
    if (request.method === 'POST' && path === '/retry-ends') {
      return this.retryPendingEnds();
    }

    // POST /init — Initialize lock for a new listing
    if (request.method === 'POST' && path === '/init') {
      const { listingId } = await request.json();
      return this.initLock(listingId);
    }

    // DELETE /:listingId — Remove lock (for cleanup)
    if (request.method === 'DELETE' && path.startsWith('/')) {
      const listingId = path.replace('/', '');
      return this.removeLock(listingId);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // ============================================================
  // STATE PERSISTENCE
  // ============================================================

  private async persist(): Promise<void> {
    await this.state.storage.put('locks', this.locks);
    await this.state.storage.put('pendingEnds', this.pendingEnds);
  }

  // ============================================================
  // LOCK INITIALIZATION
  // ============================================================

  private async initLock(listingId: string): Promise<Response> {
    if (this.locks.has(listingId)) {
      return Response.json({
        success: true,
        status: this.locks.get(listingId),
      });
    }

    const lockState: LockState = {
      listingId,
      status: 'available',
      soldOn: null,
      soldAt: null,
      reservedBy: null,
      reservedAt: null,
      endedPlatforms: [],
      version: 1,
    };

    this.locks.set(listingId, lockState);
    await this.persist();

    return Response.json({ success: true, status: lockState });
  }

  // ============================================================
  // RESERVATION (Pre-publish lock)
  // ============================================================

  private async acquireReservation(
    listingId: string,
    platform: Platform
  ): Promise<Response> {
    let lock = this.locks.get(listingId);

    // Initialize if doesn't exist
    if (!lock) {
      lock = {
        listingId,
        status: 'available',
        soldOn: null,
        soldAt: null,
        reservedBy: null,
        reservedAt: null,
        endedPlatforms: [],
        version: 1,
      };
      this.locks.set(listingId, lock);
    }

    // Already sold
    if (lock.status === 'sold') {
      return Response.json(
        {
          success: false,
          error: 'Item already sold',
          soldOn: lock.soldOn,
          soldAt: lock.soldAt,
        },
        { status: 409 }
      );
    }

    // Already reserved by another platform
    if (lock.status === 'reserved' && lock.reservedBy !== platform) {
      return Response.json(
        {
          success: false,
          error: 'Item reserved by another platform',
          reservedBy: lock.reservedBy,
        },
        { status: 409 }
      );
    }

    // Already ended on this platform
    if (lock.endedPlatforms.includes(platform)) {
      return Response.json(
        {
          success: false,
          error: 'Listing already ended on this platform',
        },
        { status: 409 }
      );
    }

    // Acquire reservation
    lock.status = 'reserved';
    lock.reservedBy = platform;
    lock.reservedAt = new Date().toISOString();
    lock.version++;

    await this.persist();

    return Response.json({
      success: true,
      status: lock,
      message: `Reservation acquired for ${platform}`,
    });
  }

  // ============================================================
  // RELEASE RESERVATION
  // ============================================================

  private async releaseReservation(
    listingId: string,
    platform: Platform
  ): Promise<Response> {
    const lock = this.locks.get(listingId);

    if (!lock) {
      return Response.json({ success: true, message: 'No lock found' });
    }

    if (lock.reservedBy === platform) {
      lock.status = 'available';
      lock.reservedBy = null;
      lock.reservedAt = null;
      lock.version++;
      await this.persist();
    }

    return Response.json({ success: true, status: lock });
  }

  // ============================================================
  // MARK SOLD (The critical operation)
  // ============================================================

  private async markSold(
    listingId: string,
    platform: Platform,
    externalOrderId?: string
  ): Promise<Response> {
    let lock = this.locks.get(listingId);

    // Initialize if doesn't exist (shouldn't happen but be safe)
    if (!lock) {
      lock = {
        listingId,
        status: 'available',
        soldOn: null,
        soldAt: null,
        reservedBy: null,
        reservedAt: null,
        endedPlatforms: [],
        version: 1,
      };
      this.locks.set(listingId, lock);
    }

    // Idempotency check — already marked sold on this platform
    if (lock.status === 'sold' && lock.soldOn === platform) {
      return Response.json({
        success: true,
        message: 'Already marked sold',
        idempotent: true,
        soldAt: lock.soldAt,
      });
    }

    // Already sold on different platform — log but don't error
    if (lock.status === 'sold' && lock.soldOn !== platform) {
      console.log(
        `Duplicate sale detected: ${listingId} sold on ${lock.soldOn}, webhook from ${platform}`
      );
      return Response.json({
        success: true,
        message: 'Already sold on another platform',
        soldOn: lock.soldOn,
        soldAt: lock.soldAt,
      });
    }

    // Mark as sold
    lock.status = 'sold';
    lock.soldOn = platform;
    lock.soldAt = new Date().toISOString();
    lock.version++;

    // Get all platforms that need to end
    const platformsToEnd = await this.getPlatformsForListing(listingId, platform);

    // Queue end operations for all other platforms
    for (const otherPlatform of platformsToEnd) {
      if (!lock.endedPlatforms.includes(otherPlatform)) {
        this.pendingEnds.push({
          listingId,
          platform: otherPlatform,
          scheduledAt: new Date().toISOString(),
          attempts: 0,
        });

        // Also queue via Queue for retry reliability
        await this.env.DISPATCH_QUEUE.send({
          type: 'platform_end',
          listingId,
          platform: otherPlatform,
        });
      }
    }

    await this.persist();

    // Update D1 listing status
    await this.env.DB.prepare(`
      UPDATE listings 
      SET status = 'sold', sold_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(listingId).run();

    // Log the sale
    await this.env.DB.prepare(`
      INSERT INTO dispatch_log (id, listing_id, platform, action, status, created_at)
      VALUES (?, ?, ?, 'sell', 'success', datetime('now'))
    `).bind(crypto.randomUUID(), listingId, platform).run();

    return Response.json({
      success: true,
      message: 'Marked sold, cross-platform end queued',
      soldOn: platform,
      soldAt: lock.soldAt,
      platformsEnding: platformsToEnd,
    });
  }

  // ============================================================
  // MARK ENDED
  // ============================================================

  private async markEnded(listingId: string, platform: Platform): Promise<Response> {
    const lock = this.locks.get(listingId);

    if (!lock) {
      return Response.json({ success: true, message: 'No lock found' });
    }

    if (!lock.endedPlatforms.includes(platform)) {
      lock.endedPlatforms.push(platform);
      lock.version++;
      await this.persist();
    }

    // Remove from pending ends
    this.pendingEnds = this.pendingEnds.filter(
      (p) => !(p.listingId === listingId && p.platform === platform)
    );
    await this.persist();

    return Response.json({
      success: true,
      status: lock,
    });
  }

  // ============================================================
  // GET STATUS
  // ============================================================

  private async getStatus(listingId: string): Promise<Response> {
    const lock = this.locks.get(listingId);

    if (!lock) {
      return Response.json({
        listingId,
        status: 'uninitialized',
      });
    }

    return Response.json({
      listingId,
      status: lock.status,
      soldOn: lock.soldOn,
      soldAt: lock.soldAt,
      reservedBy: lock.reservedBy,
      endedPlatforms: lock.endedPlatforms,
      version: lock.version,
    });
  }

  // ============================================================
  // RETRY PENDING ENDS
  // ============================================================

  private async retryPendingEnds(): Promise<Response> {
    const retried: PendingEnd[] = [];
    const expired: PendingEnd[] = [];

    for (const pending of this.pendingEnds) {
      // Increment attempt count
      pending.attempts++;

      // Max 10 attempts
      if (pending.attempts > 10) {
        expired.push(pending);
        continue;
      }

      // Re-queue the end operation
      await this.env.DISPATCH_QUEUE.send({
        type: 'platform_end',
        listingId: pending.listingId,
        platform: pending.platform,
      });

      retried.push(pending);
    }

    // Remove expired
    this.pendingEnds = this.pendingEnds.filter(
      (p) => !expired.some((e) => e.listingId === p.listingId && e.platform === p.platform)
    );

    await this.persist();

    return Response.json({
      success: true,
      retried: retried.length,
      expired: expired.length,
    });
  }

  // ============================================================
  // REMOVE LOCK
  // ============================================================

  private async removeLock(listingId: string): Promise<Response> {
    this.locks.delete(listingId);
    this.pendingEnds = this.pendingEnds.filter((p) => p.listingId !== listingId);
    await this.persist();

    return Response.json({ success: true });
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async getPlatformsForListing(
    listingId: string,
    excludePlatform: Platform
  ): Promise<Platform[]> {
    // Query D1 for all active platforms for this listing
    const result = await this.env.DB.prepare(`
      SELECT platform FROM listing_platforms
      WHERE listing_id = ? AND status = 'listed' AND platform != ?
    `).bind(listingId, excludePlatform).all();

    return result.results.map((r) => r.platform as Platform);
  }
}
