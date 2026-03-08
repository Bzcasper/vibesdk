/**
 * eBay Condition IDs
 * 
 * Mapping of condition names to eBay condition IDs.
 * Different categories have different valid condition IDs.
 */

// ============================================================
// CONDITION ID MAPPINGS
// ============================================================

// General jewelry conditions
export const JEWELRY_CONDITIONS = {
  1000: { name: 'New', description: 'Brand new, unused, unopened, undamaged item' },
  1500: { name: 'New without tags', description: 'New without original tags or packaging' },
  2000: { name: 'New with defects', description: 'New but with minor defects' },
  2500: { name: 'Like New', description: 'Like new, very good condition' },
  2750: { name: 'Very Good', description: 'Very good condition, minor signs of wear' },
  3000: { name: 'Good', description: 'Good condition, moderate signs of wear' },
  4000: { name: 'Acceptable', description: 'Acceptable condition, visible wear' },
  5000: { name: 'For parts or not working', description: 'Not fully functional or for parts' },
  7000: { name: 'For parts or not working', description: 'Not working, suitable for parts' },
} as const;

// Watch-specific conditions
export const WATCH_CONDITIONS = {
  1000: { name: 'New', description: 'Brand new with box and papers' },
  1500: { name: 'New without tags', description: 'New without original box or papers' },
  2000: { name: 'Pre-owned', description: 'Excellent pre-owned condition' },
  2500: { name: 'Pre-owned', description: 'Very good pre-owned condition' },
  3000: { name: 'Pre-owned', description: 'Good pre-owned condition' },
  4000: { name: 'Pre-owned', description: 'Fair pre-owned condition' },
  5000: { name: 'For parts or not working', description: 'Watch not working' },
  6000: { name: 'For parts or not working', description: 'Watch for repair or parts' },
} as const;

// Vintage/Antique conditions
export const VINTAGE_CONDITIONS = {
  2000: { name: 'Vintage', description: 'Excellent vintage condition' },
  2500: { name: 'Vintage', description: 'Very good vintage condition' },
  3000: { name: 'Vintage', description: 'Good vintage condition' },
  4000: { name: 'Vintage', description: 'Fair vintage condition, shows age' },
} as const;

// ============================================================
// CONDITION LOOKUP FUNCTIONS
// ============================================================

export type ConditionId = keyof typeof JEWELRY_CONDITIONS;

export interface ConditionInfo {
  id: ConditionId;
  name: string;
  description: string;
}

/**
 * Get condition info by ID.
 */
export function getConditionById(id: number): ConditionInfo | null {
  const condition = JEWELRY_CONDITIONS[id as ConditionId];
  if (!condition) return null;
  
  return {
    id: id as ConditionId,
    name: condition.name,
    description: condition.description,
  };
}

/**
 * Find condition ID by name.
 */
export function findConditionByName(name: string): ConditionInfo | null {
  const normalizedName = name.toLowerCase().trim();
  
  for (const [id, info] of Object.entries(JEWELRY_CONDITIONS)) {
    if (info.name.toLowerCase() === normalizedName) {
      return {
        id: parseInt(id) as ConditionId,
        name: info.name,
        description: info.description,
      };
    }
  }
  
  // Try partial matches
  if (normalizedName.includes('new') && normalizedName.includes('tag')) {
    return getConditionById(1000);
  }
  if (normalizedName.includes('new') && normalizedName.includes('defect')) {
    return getConditionById(2000);
  }
  if (normalizedName.includes('excellent') || normalizedName.includes('like new')) {
    return getConditionById(2500);
  }
  if (normalizedName.includes('very good')) {
    return getConditionById(2750);
  }
  if (normalizedName.includes('good') || normalizedName.includes('pre-owned')) {
    return getConditionById(3000);
  }
  if (normalizedName.includes('acceptable') || normalizedName.includes('fair')) {
    return getConditionById(4000);
  }
  if (normalizedName.includes('parts') || normalizedName.includes('not working')) {
    return getConditionById(7000);
  }
  
  // Default to "Good"
  return getConditionById(3000);
}

/**
 * Get valid condition IDs for a category.
 */
export function getValidConditionsForCategory(category: string): ConditionInfo[] {
  const upperCategory = category.toUpperCase();
  
  if (upperCategory === 'WTC') {
    // Watches have different conditions
    return Object.entries(WATCH_CONDITIONS).map(([id, info]) => ({
      id: parseInt(id) as ConditionId,
      name: info.name,
      description: info.description,
    }));
  }
  
  // Default to jewelry conditions
  return Object.entries(JEWELRY_CONDITIONS).map(([id, info]) => ({
    id: parseInt(id) as ConditionId,
    name: info.name,
    description: info.description,
  }));
}

/**
 * Format condition for display.
 */
export function formatCondition(id: number): string {
  const condition = getConditionById(id);
  return condition ? `${condition.name} - ${condition.description}` : 'Unknown';
}
