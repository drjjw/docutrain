/**
 * Default Category Options - Fallback Constants
 * 
 * DO NOT REMOVE - These serve as a permanent fallback when database is unavailable
 * or when system_config table doesn't have default_categories configured.
 * 
 * These values are used as the last resort when:
 * 1. Database query fails
 * 2. system_config table doesn't exist
 * 3. default_categories key is missing from system_config
 */

export const DEFAULT_CATEGORY_OPTIONS = [
  'Guidelines',
  'Maker',
  'Manuals',
  'Presentation',
  'Recipes',
  'Reviews',
  'Slides',
  'Training',
] as const;

/**
 * Version identifier for tracking changes to default categories
 * Increment this when the default categories list changes
 */
export const CATEGORY_CONSTANTS_VERSION = 1;





