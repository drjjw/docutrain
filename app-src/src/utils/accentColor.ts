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
  
  // Generate shadow color (semi-transparent version)
  const shadowColor = hexToRgba(accentColor, 0.2);
  root.style.setProperty('--accent-color-shadow', shadowColor);
}

/**
 * Set default accent colors to prevent flashing
 */
export function setDefaultAccentColors() {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  // Set neutral gray as default (will be overridden by owner-specific colors)
  root.style.setProperty('--accent-color', '#666666');
  root.style.setProperty('--accent-color-rgb', '102, 102, 102');
  root.style.setProperty('--accent-color-hover', '#555555');
  root.style.setProperty('--accent-color-shadow', 'rgba(102, 102, 102, 0.2)');
}


