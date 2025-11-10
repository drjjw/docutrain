import React, { useState, useRef, useEffect } from 'react';
import { VisibilityBadge } from './VisibilityBadge';
import type { DocumentAccessLevel } from '@/types/admin';

interface InlineEditableVisibilityProps {
  accessLevel: DocumentAccessLevel | string;
  isUpdating: boolean;
  onUpdate: (newAccessLevel: DocumentAccessLevel) => Promise<void>;
}

const VISIBILITY_OPTIONS: { value: DocumentAccessLevel; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'passcode', label: 'Passcode' },
  { value: 'registered', label: 'Registered' },
  { value: 'owner_restricted', label: 'Owner' },
  { value: 'owner_admin_only', label: 'Owner Admins Only' },
];

export function InlineEditableVisibility({
  accessLevel,
  isUpdating,
  onUpdate,
}: InlineEditableVisibilityProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUpdating && !isSaving) {
      setIsEditing(true);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value as DocumentAccessLevel;
    if (newValue !== accessLevel) {
      setIsSaving(true);
      try {
        await onUpdate(newValue);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to update visibility:', error);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <select
        ref={selectRef}
        value={accessLevel}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border-2 border-docutrain-light focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 bg-white cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        autoFocus
      >
        {VISIBILITY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer transition-opacity w-full max-w-full ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
      title="Click to edit"
    >
      <div className="w-full max-w-full flex justify-center">
        <VisibilityBadge accessLevel={accessLevel} />
      </div>
    </div>
  );
}

