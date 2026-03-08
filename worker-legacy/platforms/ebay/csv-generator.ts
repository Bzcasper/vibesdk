/**
 * eBay CSV Generator
 * 
 * Generates File Exchange compatible CSV for bulk listing uploads.
 */

import type { Env, Platform } from '../../env';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface EbayCsvRow {
  // Required fields
  Action: 'Add' | 'Revise' | 'End' | 'Relist';
  Title: string;
  Format: 'FixedPrice' | 'Auction';
  Duration: 'GTC' | 'Days_1' | 'Days_3' | 'Days_5' | 'Days_7' | 'Days_10' | 'Days_30';
  StartPrice: string;
  BuyItNowPrice?: string;
  Quantity: number;
  ConditionID: number;
  Category: string;
  PictureURL: string;
  Description: string;
  
  // Recommended fields
  PayPalEmailAddress?: string;
  Location?: string;
  DispatchTimeMax?: number;
  
  // Shipping
  ShippingType?: string;
  ShippingServiceCost?: string;
  ShippingServiceAdditionalCost?: string;
  
  // Returns
  ReturnPolicy?: string;
  ReturnsAcceptedOption?: string;
  ReturnsWithinOption?: string;
  RefundOption?: string;
  ShippingCostPaidByOption?: string;
  
  // Item specifics (dynamic)
  [key: string]: string | number | undefined;
}

export interface CsvGenerationResult {
  success: boolean;
  csv: string;
  rowCount: number;
  errors?: string[];
  warnings?: string[];
}

// ============================================================
// CSV HEADER
// ============================================================

// eBay File Exchange header row (required format)
const CSV_HEADER = `*Action(SiteID=US|Country=US|Currency=USD|Version=1193),*Title,*Format,*Duration,*StartPrice,*BuyItNowPrice,*Quantity,*ConditionID,*Category,*PictureURL,*Description,*PayPalEmailAddress,*Location,*DispatchTimeMax,ReturnPolicy,ShippingType,ShippingServiceCost,ShippingServiceAdditionalCost`;

// ============================================================
// CSV GENERATION
// ============================================================

/**
 * Generate a CSV file for eBay bulk upload from listing data.
 */
export async function generateEbayCsv(
  listingIds: string[],
  env: Env
): Promise<CsvGenerationResult> {
  const rows: string[] = [CSV_HEADER];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const listingId of listingIds) {
    try {
      const row = await generateCsvRow(listingId, env);
      if (row) {
        rows.push(row);
      }
    } catch (error) {
      errors.push(`Listing ${listingId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: errors.length === 0,
    csv: rows.join('\n'),
    rowCount: rows.length - 1, // Exclude header
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Generate a single CSV row for a listing.
 */
async function generateCsvRow(listingId: string, env: Env): Promise<string | null> {
  // Get listing data
  const listing = await env.DB.prepare(`
    SELECT l.*, 
      GROUP_CONCAT(DISTINCT ma.r2_key) as image_keys
    FROM listings l
    LEFT JOIN media_assets ma ON l.id = ma.listing_id AND ma.processing_status = 'ready'
    WHERE l.id = ?
    GROUP BY l.id
  `).bind(listingId).first();
  
  if (!listing) {
    throw new Error('Listing not found');
  }
  
  // Get eBay-specific fields
  const ebayFields = await env.DB.prepare(`
    SELECT field_name, field_value FROM listing_fields
    WHERE listing_id = ? AND platform = 'ebay'
  `).bind(listingId).all();
  
  const fields: Record<string, unknown> = {};
  for (const f of ebayFields.results) {
    fields[f.field_name as string] = JSON.parse(f.field_value as string);
  }
  
  // Build CSV row
  const row: EbayCsvRow = {
    Action: 'Add',
    Title: sanitizeCsvField(fields.title as string || listing.title || 'Untitled Item'),
    Format: 'FixedPrice',
    Duration: 'GTC',
    StartPrice: ((listing.price_cents as number) / 100).toFixed(2),
    Quantity: 1,
    ConditionID: (listing.condition_id as number) || 3000,
    Category: fields.ebayCategoryId as string || '',
    PictureURL: await buildPictureUrls(listing.image_keys as string, env),
    Description: sanitizeCsvField(fields.description as string || ''),
    Location: 'US',
    DispatchTimeMax: 2,
    ShippingType: 'Flat',
    ShippingServiceCost: '0.00',
    ReturnPolicy: 'ReturnsAccepted',
    ReturnsAcceptedOption: 'ReturnsAccepted',
    ReturnsWithinOption: 'Days_30',
    RefundOption: 'MoneyBack',
    ShippingCostPaidByOption: 'Buyer',
  };
  
  // Convert to CSV format
  return rowToCsv(row);
}

/**
 * Build picture URLs from R2 keys.
 */
async function buildPictureUrls(r2Keys: string | null, env: Env): Promise<string> {
  if (!r2Keys) return '';
  
  const keys = r2Keys.split(',').filter(Boolean);
  const urls: string[] = [];
  
  for (const key of keys.slice(0, 24)) { // eBay max 24 images
    // Generate public R2 URL or signed URL
    // For now, assume R2 has public access configured
    const url = `https://media.caspers-jewelry.com/${key}`;
    urls.push(url);
  }
  
  return urls.join('|');
}

/**
 * Sanitize a field for CSV output.
 */
function sanitizeCsvField(value: string): string {
  if (!value) return '';
  
  // Escape double quotes by doubling them
  let sanitized = value.replace(/"/g, '""');
  
  // If contains comma, newline, or quote, wrap in quotes
  if (sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('"')) {
    sanitized = `"${sanitized}"`;
  }
  
  return sanitized;
}

/**
 * Convert a row object to CSV string.
 */
function rowToCsv(row: EbayCsvRow): string {
  const values = [
    row.Action,
    sanitizeCsvField(row.Title),
    row.Format,
    row.Duration,
    row.StartPrice,
    row.BuyItNowPrice || '',
    row.Quantity.toString(),
    row.ConditionID.toString(),
    row.Category,
    sanitizeCsvField(row.PictureURL),
    sanitizeCsvField(row.Description),
    row.PayPalEmailAddress || '',
    row.Location || '',
    row.DispatchTimeMax?.toString() || '',
    row.ReturnPolicy || '',
    row.ShippingType || '',
    row.ShippingServiceCost || '',
    row.ShippingServiceAdditionalCost || '',
  ];
  
  return values.join(',');
}

// ============================================================
// CSV PARSING (for import)
// ============================================================

/**
 * Parse eBay File Exchange results CSV.
 */
export function parseEbayResultsCsv(csvContent: string): {
  success: boolean;
  results: Array<{
    itemId?: string;
    title?: string;
    status: 'success' | 'error';
    message?: string;
  }>;
} {
  const lines = csvContent.split('\n');
  const results: Array<{
    itemId?: string;
    title?: string;
    status: 'success' | 'error';
    message?: string;
  }> = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line
    const parts = parseCsvLine(line);
    
    if (parts.length >= 2) {
      const itemId = parts[0];
      const status = parts[1]?.toLowerCase();
      
      results.push({
        itemId: itemId || undefined,
        status: status === 'success' ? 'success' : 'error',
        message: parts.slice(2).join(', ') || undefined,
      });
    }
  }
  
  return {
    success: results.every((r) => r.status === 'success'),
    results,
  };
}

/**
 * Parse a single CSV line handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current);
  
  return result;
}

// ============================================================
// BATCH CREATION
// ============================================================

/**
 * Create a CSV batch from selected listings.
 */
export async function createCsvBatch(
  listingIds: string[],
  name: string | undefined,
  env: Env
): Promise<{ batchId: string; csv: string }> {
  const batchId = crypto.randomUUID();
  
  // Generate CSV
  const result = await generateEbayCsv(listingIds, env);
  
  if (!result.success && result.errors) {
    throw new Error(`CSV generation failed: ${result.errors.join('; ')}`);
  }
  
  // Store in R2
  const r2Key = `csv-batches/${batchId}/ebay_upload.csv`;
  await env.MEDIA_BUCKET.put(r2Key, result.csv, {
    httpMetadata: {
      contentType: 'text/csv; charset=utf-8',
    },
    customMetadata: {
      batchId,
      listingCount: result.rowCount.toString(),
    },
  });
  
  // Create batch record
  await env.DB.prepare(`
    INSERT INTO csv_batches (id, name, status, listing_count, listings, r2_key, created_at, updated_at)
    VALUES (?, ?, 'ready', ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    batchId,
    name || `eBay Upload ${new Date().toLocaleDateString()}`,
    result.rowCount,
    JSON.stringify(listingIds),
    r2Key
  ).run();
  
  return {
    batchId,
    csv: result.csv,
  };
}
