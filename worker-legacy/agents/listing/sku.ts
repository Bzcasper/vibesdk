/**
 * SKU Generation
 * 
 * Generates hierarchical SKUs: CJP-{CATEGORY}-{YYMM}-{SEQ}
 */

import type { Env, SkuCategory } from '../../env';
import { SKU_CATEGORIES } from '../../env';

// ============================================================
// SKU GENERATION
// ============================================================

export interface SkuGenerationResult {
  sku: string;
  prefix: string;
  category: SkuCategory;
  dateCode: string;
  sequence: number;
}

/**
 * Generate a new unique SKU for a listing.
 * Format: CJP-{CATEGORY}-{YYMM}-{SEQ}
 * 
 * Example: CJP-RNG-2603-0042
 * - CJP: Caspers Jewelry Product
 * - RNG: Ring category
 * - 2603: March 2026
 * - 0042: 42nd ring listed that day
 */
export async function generateSku(
  category: SkuCategory,
  env: Env
): Promise<SkuGenerationResult> {
  const now = new Date();
  
  // Build date code: YYMM
  const yearCode = now.getFullYear().toString().slice(-2);
  const monthCode = String(now.getMonth() + 1).padStart(2, '0');
  const dateCode = `${yearCode}${monthCode}`;
  
  // Build prefix: CJP-{CATEGORY}-{YYMM}
  const prefix = `CJP-${category}-${dateCode}`;
  
  // Get next sequence number for this prefix
  const result = await env.DB.prepare(`
    SELECT MAX(sequence) as max_seq 
    FROM sku_registry 
    WHERE sku_prefix = ?
  `).bind(prefix).first();
  
  const nextSeq = (result?.max_seq as number ?? 0) + 1;
  
  // Build full SKU
  const sku = `${prefix}-${String(nextSeq).padStart(4, '0')}`;
  
  // Register in database (atomic insert)
  try {
    await env.DB.prepare(`
      INSERT INTO sku_registry (sku, sku_prefix, category, date_code, sequence, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(sku, prefix, category, dateCode, nextSeq).run();
  } catch (error) {
    // Handle race condition - retry with new sequence
    // This can happen if two requests generate SKU simultaneously
    const retryResult = await env.DB.prepare(`
      SELECT MAX(sequence) as max_seq 
      FROM sku_registry 
      WHERE sku_prefix = ?
    `).bind(prefix).first();
    
    const retrySeq = (retryResult?.max_seq as number ?? 0) + 1;
    const retrySku = `${prefix}-${String(retrySeq).padStart(4, '0')}`;
    
    await env.DB.prepare(`
      INSERT INTO sku_registry (sku, sku_prefix, category, date_code, sequence, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).bind(retrySku, prefix, category, dateCode, retrySeq).run();
    
    return {
      sku: retrySku,
      prefix,
      category,
      dateCode,
      sequence: retrySeq,
    };
  }
  
  return {
    sku,
    prefix,
    category,
    dateCode,
    sequence: nextSeq,
  };
}

/**
 * Parse an existing SKU to extract its components.
 */
export function parseSku(sku: string): {
  valid: boolean;
  prefix?: string;
  category?: SkuCategory;
  categoryName?: string;
  dateCode?: string;
  sequence?: number;
  year?: number;
  month?: number;
} {
  // Match pattern: CJP-{CATEGORY}-{YYMM}-{SEQ}
  const match = sku.match(/^CJP-([A-Z]{3})-(\d{4})-(\d{4})$/);
  
  if (!match) {
    return { valid: false };
  }
  
  const [, categoryCode, dateCode, seqStr] = match;
  const category = categoryCode as SkuCategory;
  const sequence = parseInt(seqStr, 10);
  const year = parseInt(dateCode.slice(0, 2), 10) + 2000;
  const month = parseInt(dateCode.slice(2, 4), 10);
  
  // Validate category
  if (!(category in SKU_CATEGORIES)) {
    return { valid: false };
  }
  
  return {
    valid: true,
    prefix: `CJP-${category}-${dateCode}`,
    category,
    categoryName: SKU_CATEGORIES[category],
    dateCode,
    sequence,
    year,
    month,
  };
}

/**
 * Check if a SKU already exists.
 */
export async function skuExists(sku: string, env: Env): Promise<boolean> {
  const result = await env.DB.prepare(`
    SELECT 1 FROM sku_registry WHERE sku = ?
  `).bind(sku).first();
  
  return !!result;
}

/**
 * Get SKU statistics for a date range.
 */
export async function getSkuStats(
  env: Env,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number;
  byCategory: Record<SkuCategory, number>;
  byMonth: Record<string, number>;
}> {
  let sql = 'SELECT category, date_code, COUNT(*) as count FROM sku_registry';
  const params: unknown[] = [];
  
  if (startDate || endDate) {
    sql += ' WHERE';
    const conditions: string[] = [];
    
    if (startDate) {
      const startDateCode = formatDateCode(startDate);
      conditions.push('date_code >= ?');
      params.push(startDateCode);
    }
    
    if (endDate) {
      const endDateCode = formatDateCode(endDate);
      conditions.push('date_code <= ?');
      params.push(endDateCode);
    }
    
    sql += ' ' + conditions.join(' AND ');
  }
  
  sql += ' GROUP BY category, date_code';
  
  const result = await env.DB.prepare(sql).bind(...params).all();
  
  const stats = {
    total: 0,
    byCategory: {} as Record<SkuCategory, number>,
    byMonth: {} as Record<string, number>,
  };
  
  // Initialize categories
  for (const cat of Object.keys(SKU_CATEGORIES) as SkuCategory[]) {
    stats.byCategory[cat] = 0;
  }
  
  for (const row of result.results) {
    const category = row.category as SkuCategory;
    const dateCode = row.date_code as string;
    const count = row.count as number;
    
    stats.total += count;
    
    if (category in stats.byCategory) {
      stats.byCategory[category] += count;
    }
    
    stats.byMonth[dateCode] = (stats.byMonth[dateCode] || 0) + count;
  }
  
  return stats;
}

// ============================================================
// HELPERS
// ============================================================

function formatDateCode(date: Date): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}
