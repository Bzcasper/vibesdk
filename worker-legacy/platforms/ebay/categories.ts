/**
 * eBay Category Intelligence
 * 
 * Category lookup and suggestion for eBay listings.
 */

import type { Env } from '../../env';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface EbayCategory {
  categoryId: number;
  name: string;
  level: number;
  parentId?: number;
  leaf: boolean;
  aspects: EbayAspect[];
}

export interface EbayAspect {
  name: string;
  localized: string;
  required: boolean;
  values: string[];
}

export interface CategorySuggestion {
  categoryId: number;
  name: string;
  confidence: number;
  path: string[];
}

// ============================================================
// JEWELRY CATEGORIES (Primary)
// ============================================================

// Top-level jewelry categories for eBay US
export const JEWELRY_CATEGORIES: Record<string, EbayCategory> = {
  '110679': {
    categoryId: 110679,
    name: 'Rings',
    level: 2,
    parentId: 281,
    leaf: false,
    aspects: [
      { name: 'Metal', localized: 'Metal', required: true, values: ['Gold', 'Silver', 'Platinum', 'Titanium', 'Stainless Steel'] },
      { name: 'Ring Size', localized: 'Ring Size', required: true, values: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13'] },
      { name: 'Main Stone', localized: 'Main Stone', required: false, values: ['Diamond', 'Sapphire', 'Ruby', 'Emerald', 'Pearl'] },
      { name: 'Style', localized: 'Style', required: false, values: ['Engagement', 'Wedding Band', 'Fashion', 'Signet'] },
    ],
  },
  '155101': {
    categoryId: 155101,
    name: 'Necklaces & Pendants',
    level: 2,
    parentId: 281,
    leaf: false,
    aspects: [
      { name: 'Metal', localized: 'Metal', required: true, values: ['Gold', 'Silver', 'Platinum'] },
      { name: 'Chain Length', localized: 'Chain Length', required: false, values: ['16"', '18"', '20"', '24"', '30"'] },
      { name: 'Main Stone', localized: 'Main Stone', required: false, values: ['Diamond', 'Pearl', 'Gemstone'] },
    ],
  },
  '110680': {
    categoryId: 110680,
    name: 'Bracelets',
    level: 2,
    parentId: 281,
    leaf: false,
    aspects: [
      { name: 'Metal', localized: 'Metal', required: true, values: ['Gold', 'Silver', 'Platinum'] },
      { name: 'Bracelet Length', localized: 'Bracelet Length', required: false, values: ['7"', '7.5"', '8"'] },
      { name: 'Style', localized: 'Style', required: false, values: ['Tennis', 'Bangle', 'Cuff', 'Charm'] },
    ],
  },
  '110681': {
    categoryId: 110681,
    name: 'Earrings',
    level: 2,
    parentId: 281,
    leaf: false,
    aspects: [
      { name: 'Metal', localized: 'Metal', required: true, values: ['Gold', 'Silver', 'Platinum'] },
      { name: 'Style', localized: 'Style', required: false, values: ['Stud', 'Hoop', 'Drop', 'Chandelier'] },
      { name: 'Main Stone', localized: 'Main Stone', required: false, values: ['Diamond', 'Pearl', 'Gemstone'] },
    ],
  },
  '110683': {
    categoryId: 110683,
    name: 'Pendants & Charms',
    level: 2,
    parentId: 281,
    leaf: false,
    aspects: [
      { name: 'Metal', localized: 'Metal', required: true, values: ['Gold', 'Silver', 'Platinum'] },
      { name: 'Main Stone', localized: 'Main Stone', required: false, values: ['Diamond', 'Pearl', 'Gemstone'] },
      { name: 'Theme', localized: 'Theme', required: false, values: ['Religious', 'Heart', 'Initial', 'Animal'] },
    ],
  },
  '31387': {
    categoryId: 31387,
    name: 'Watches',
    level: 1,
    leaf: false,
    aspects: [
      { name: 'Brand', localized: 'Brand', required: true, values: ['Rolex', 'Omega', 'Seiko', 'Citizen', 'Casio'] },
      { name: 'Movement', localized: 'Movement', required: false, values: ['Automatic', 'Quartz', 'Mechanical'] },
      { name: 'Display', localized: 'Display', required: false, values: ['Analog', 'Digital', 'Analog-Digital'] },
    ],
  },
};

// ============================================================
// CATEGORY SUGGESTION
// ============================================================

// Keywords to category mapping
const KEYWORD_TO_CATEGORY: Record<string, number[]> = {
  // Rings
  'ring': [110679],
  'engagement': [110679],
  'wedding band': [110679],
  'signet': [110679],
  'solitaire': [110679],
  
  // Necklaces
  'necklace': [155101],
  'chain': [155101],
  'choker': [155101],
  'pendant': [110683, 155101],
  'charm': [110683],
  
  // Bracelets
  'bracelet': [110680],
  'bangle': [110680],
  'cuff': [110680],
  'tennis bracelet': [110680],
  
  // Earrings
  'earring': [110681],
  'hoop': [110681],
  'stud': [110681],
  'drop': [110681],
  
  // Watches
  'watch': [31387],
  'timepiece': [31387],
  'wristwatch': [31387],
  
  // Sets
  'set': [281],
  'lot': [281],
  'bundle': [281],
};

/**
 * Suggest categories based on item description.
 */
export async function suggestCategories(
  description: string,
  env: Env
): Promise<CategorySuggestion[]> {
  const suggestions: Map<number, CategorySuggestion> = new Map();
  const lowerDesc = description.toLowerCase();
  
  // Score each potential category based on keyword matches
  for (const [keyword, categoryIds] of Object.entries(KEYWORD_TO_CATEGORY)) {
    if (lowerDesc.includes(keyword)) {
      for (const categoryId of categoryIds) {
        const existing = suggestions.get(categoryId);
        const category = JEWELRY_CATEGORIES[categoryId.toString()];
        
        if (category) {
          if (existing) {
            existing.confidence += 0.1;
          } else {
            suggestions.set(categoryId, {
              categoryId,
              name: category.name,
              confidence: 0.5,
              path: ['Jewelry & Watches', category.name],
            });
          }
        }
      }
    }
  }
  
  // Sort by confidence
  const sorted = Array.from(suggestions.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  
  // Normalize confidence scores
  if (sorted.length > 0) {
    const maxConfidence = sorted[0].confidence;
    for (const s of sorted) {
      s.confidence = Math.min(s.confidence / maxConfidence, 1);
    }
  }
  
  return sorted;
}

/**
 * Get category details by ID.
 */
export async function getCategoryById(
  categoryId: number,
  env: Env
): Promise<EbayCategory | null> {
  // Check local cache first
  const cached = JEWELRY_CATEGORIES[categoryId.toString()];
  if (cached) return cached;
  
  // Check KV cache
  const kvKey = `ebay_category:${categoryId}`;
  const cachedJson = await env.CONFIG.get(kvKey);
  
  if (cachedJson) {
    return JSON.parse(cachedJson) as EbayCategory;
  }
  
  // In production, this would call the eBay Taxonomy API
  // For now, return null for unknown categories
  return null;
}

/**
 * Get required aspects for a category.
 */
export async function getCategoryAspects(
  categoryId: number,
  env: Env
): Promise<EbayAspect[]> {
  const category = await getCategoryById(categoryId, env);
  return category?.aspects || [];
}

/**
 * Validate item specifics against category requirements.
 */
export async function validateItemSpecifics(
  categoryId: number,
  specifics: Record<string, string>,
  env: Env
): Promise<{ valid: boolean; missing: string[]; errors: string[] }> {
  const aspects = await getCategoryAspects(categoryId, env);
  const missing: string[] = [];
  const errors: string[] = [];
  
  for (const aspect of aspects) {
    if (aspect.required && !specifics[aspect.name]) {
      missing.push(aspect.localized);
    }
    
    // Validate value is in allowed list if applicable
    if (specifics[aspect.name] && aspect.values.length > 0) {
      if (!aspect.values.includes(specifics[aspect.name])) {
        // Allow partial matches or similar values
        // This is a soft validation
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    errors,
  };
}

/**
 * Map internal category code to eBay category ID.
 */
export function mapCategoryCodeToEbay(code: string): number | null {
  const mapping: Record<string, number> = {
    'RNG': 110679,  // Rings
    'NKL': 155101,  // Necklaces
    'BRD': 110680,  // Bracelets
    'ERG': 110681,  // Earrings
    'WTC': 31387,   // Watches
    'PND': 110683,  // Pendants
    'SET': 281,     // Jewelry Sets (parent category)
    'OTH': 281,     // Other (parent category)
  };
  
  return mapping[code] || null;
}

/**
 * Get default item specifics for a category.
 */
export function getDefaultSpecifics(categoryId: number): Record<string, string> {
  const category = JEWELRY_CATEGORIES[categoryId.toString()];
  if (!category) return {};
  
  const specifics: Record<string, string> = {};
  
  for (const aspect of category.aspects) {
    // Set first value as default for required aspects
    if (aspect.required && aspect.values.length > 0) {
      specifics[aspect.name] = aspect.values[0];
    }
  }
  
  return specifics;
}
