/**
 * Utility functions for accent color manipulation
 * Ported from vanilla JS ui-utils.js
 */

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Darken each component
  const newR = Math.max(0, Math.floor(r * (1 - percent)));
  const newG = Math.max(0, Math.floor(g * (1 - percent)));
  const newB = Math.max(0, Math.floor(b * (1 - percent)));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex color to rgba string
 */
export function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Calculate relative luminance of a color (WCAG formula)
 * Returns a value between 0 (dark) and 1 (light)
 */
function getLuminance(hex: string): number {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Convert to relative luminance (WCAG formula)
  // Normalize RGB values to 0-1 range
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  // Calculate relative luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Determine if a color is light (should use dark text) or dark (should use light text)
 * Uses WCAG relative luminance threshold of 0.5
 */
export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

/**
 * Set CSS accent color variables based on owner accent color
 */
export function setAccentColorVariables(accentColor: string) {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  
  // Set base accent color
  root.style.setProperty('--accent-color', accentColor);
  
  // Generate RGB values for use in rgba() functions
  const hex = accentColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  root.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`);
  
  // Generate hover color (darker version)
  const hoverColor = darkenColor(accentColor, 0.15);
  root.style.setProperty('--accent-color-hover', hoverColor);
  
  // Generate active color (even darker version)
  const activeColor = darkenColor(accentColor, 0.25);
  root.style.setProperty('--accent-color-active', activeColor);
  
  // Generate shadow color (semi-transparent version)
  const shadowColor = hexToRgba(accentColor, 0.2);
  root.style.setProperty('--accent-color-shadow', shadowColor);
  
  // Determine text color based on luminance
  // Light colors (high luminance) need dark text, dark colors need light text
  const isLight = isLightColor(accentColor);
  root.style.setProperty('--accent-color-text', isLight ? '#000000' : '#ffffff');
  
  // Also set text color for hover state (based on hover color luminance)
  const hoverIsLight = isLightColor(hoverColor);
  root.style.setProperty('--accent-color-hover-text', hoverIsLight ? '#000000' : '#ffffff');
  
  // Active state is always darker, so use white text unless it's still very light
  const activeIsLight = isLightColor(activeColor);
  root.style.setProperty('--accent-color-active-text', activeIsLight ? '#000000' : '#ffffff');
}

/**
 * Set default accent colors to prevent flashing
 */
export function setDefaultAccentColors() {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  // Set blue as default (will be overridden by owner-specific colors)
  root.style.setProperty('--accent-color', '#34a2ff');
  root.style.setProperty('--accent-color-rgb', '52, 162, 255');
  root.style.setProperty('--accent-color-hover', '#2c89d8');
  root.style.setProperty('--accent-color-active', '#1f6bb0');
  root.style.setProperty('--accent-color-shadow', 'rgba(52, 162, 255, 0.2)');
  // Default blue is dark enough to use white text
  root.style.setProperty('--accent-color-text', '#ffffff');
  root.style.setProperty('--accent-color-hover-text', '#ffffff');
  root.style.setProperty('--accent-color-active-text', '#ffffff');
}




