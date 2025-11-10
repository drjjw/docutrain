import React, { useState, useRef, useEffect } from 'react';
import type { Owner } from '@/types/admin';

interface InlineEditableOwnerProps {
  owner: Owner | null;
  owners: Owner[];
  isUpdating: boolean;
  onUpdate: (newOwnerId: string | null) => Promise<void>;
}

export function InlineEditableOwner({
  owner,
  owners,
  isUpdating,
  onUpdate,
}: InlineEditableOwnerProps) {
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
    const newValue = e.target.value;
    const newOwnerId = newValue === '__none__' ? null : newValue;
    if (newOwnerId !== (owner?.id || null)) {
      setIsSaving(true);
      try {
        await onUpdate(newOwnerId);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to update owner:', error);
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
      <div className="relative w-full min-w-0">
        <select
          ref={selectRef}
          value={owner?.id || '__none__'}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border-2 border-docutrain-light focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 bg-white cursor-pointer overflow-hidden text-ellipsis"
          onClick={(e) => e.stopPropagation()}
          autoFocus
        >
          <option value="__none__">(None)</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (!owner) {
    return (
      <div
        onClick={handleClick}
        className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200/50 shadow-sm overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer transition-opacity max-w-full mx-auto ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
        title="Click to set owner"
      >
        <span className="truncate">(None)</span>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`inline-flex items-center justify-center cursor-pointer transition-opacity max-w-full mx-auto ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
      title="Click to edit"
    >
      <span className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-docutrain-light/10 text-docutrain-dark border border-docutrain-light/30 shadow-sm overflow-hidden text-ellipsis whitespace-nowrap">
        <span className="truncate">{owner.name}</span>
      </span>
    </div>
  );
}

