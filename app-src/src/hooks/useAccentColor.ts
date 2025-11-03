/**
 * useAccentColor - Hook for managing accent color CSS variables
 * Sets accent color CSS variables based on document owner
 * Ported from ChatPage.tsx
 */

import { useEffect } from 'react';
import { setAccentColorVariables, setDefaultAccentColors } from '@/utils/accentColor';

export function useAccentColor(accentColor?: string) {
  useEffect(() => {
    // Set default colors first to prevent flashing
    setDefaultAccentColors();

    // Update accent colors if owner logo config has accent color
    if (accentColor) {
      setAccentColorVariables(accentColor);
    }
  }, [accentColor]);
}



