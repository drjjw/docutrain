import { DEFAULT_CATEGORY_OPTIONS } from '@/constants/categories';
import { getCategoriesForOwner } from '@/lib/supabase/admin';
import type { Owner } from '@/types/admin';

/**
 * Cache key for default categories
 */
export const DEFAULT_CATEGORIES_CACHE_KEY = 'default_categories';

/**
 * Cache entry structure
 */
interface CacheEntry {
  categories: string[];
  timestamp: number;
}

/**
 * In-memory cache for default categories
 * Cache expires after 5 minutes (300000 ms)
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let categoryCache: CacheEntry | null = null;

/**
 * Get default categories from database with caching and fallback
 * 
 * Strategy:
 * 1. Check memory cache first (if fresh, return immediately)
 * 2. Fetch from categories table (system defaults: owner_id IS NULL)
 * 3. Fallback to constants if database fails
 * 
 * @returns Promise<string[]> Array of default category names
 */
export async function getDefaultCategories(): Promise<string[]> {
  // Check cache first
  if (categoryCache) {
    const age = Date.now() - categoryCache.timestamp;
    if (age < CACHE_TTL) {
      return categoryCache.categories;
    }
  }

  try {
    // Fetch system default categories (owner_id IS NULL)
    const categories = await getCategoriesForOwner(null);
    
    if (categories && categories.length > 0) {
      const categoryNames = categories
        .filter(cat => cat.owner_id === null)
        .map(cat => cat.name);
      
      if (categoryNames.length > 0) {
        // Update cache
        categoryCache = {
          categories: categoryNames,
          timestamp: Date.now(),
        };
        return categoryNames;
      }
    }
  } catch (error) {
    // Log error but don't throw - fallback to constants
    console.warn('Failed to fetch default categories from database, using constants fallback:', error);
  }

  // Fallback to constants
  return [...DEFAULT_CATEGORY_OPTIONS];
}

/**
 * Get category options for an owner
 * Returns owner-specific categories if set, otherwise defaults
 * Deduplicates categories by name (in case same category exists as system default and owner-specific)
 * 
 * @param owner - Owner object with id
 * @returns Promise<string[]> Array of unique category names
 */
export async function getCategoryOptions(owner?: Owner | null): Promise<string[]> {
  try {
    // Fetch categories for this owner (system defaults + owner-specific)
    const categories = await getCategoriesForOwner(owner?.id);
    
    if (categories && categories.length > 0) {
      // Return unique category names (deduplicate by name)
      const uniqueNames = Array.from(new Set(categories.map(cat => cat.name)));
      return uniqueNames;
    }
  } catch (error) {
    console.warn('Failed to fetch categories for owner, using defaults:', error);
  }
  
  // Fallback to defaults
  return getDefaultCategories();
}

/**
 * Invalidate the category cache
 * Call this after updating categories in the database
 */
export function invalidateCategoryCache(): void {
  categoryCache = null;
}

