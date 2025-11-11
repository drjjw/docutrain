import React from 'react';
import { Toggle } from '@/components/UI/Toggle';
import type { DocumentWithOwner } from '@/types/admin';

interface StatusToggleProps {
  doc: DocumentWithOwner;
  isUpdating: boolean;
  onToggle: (doc: DocumentWithOwner, newActive: boolean) => void;
}

export function StatusToggle({ doc, isUpdating, onToggle }: StatusToggleProps) {
  const isActive = doc.active ?? false;
  
  return (
    <Toggle
      checked={isActive}
      onChange={(checked) => onToggle(doc, checked)}
      disabled={isUpdating}
      size="sm"
    />
  );
}





