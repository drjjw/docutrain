import React, { useState, useRef, useEffect } from 'react';
import type { Owner } from '@/types/admin';
import { getCategoryOptions } from '@/utils/categories';
import { DEFAULT_CATEGORY_OPTIONS } from '@/constants/categories';

interface InlineEditableCategoryProps {
  categoryObj?: { id: number; name: string } | null; // Category object from join
  isUpdating: boolean;
  onUpdate: (newCategory: string | null) => Promise<void>;
  owner?: Owner | null;
}

export function InlineEditableCategory({
  categoryObj,
  isUpdating,
  onUpdate,
  owner,
}: InlineEditableCategoryProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Use category_obj.name
  const displayCategory = categoryObj?.name || null;
  const [inputValue, setInputValue] = useState(displayCategory || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const [useInput, setUseInput] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);
  const [loadingCategories, setLoadingCategories] = useState(true);
  
  // Update input value when category changes
  useEffect(() => {
    setInputValue(displayCategory || '');
  }, [displayCategory]);
  
  // Fetch category options on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const options = await getCategoryOptions(owner);
        setCategoryOptions(options);
      } catch (error) {
        console.error('Failed to load category options:', error);
        // Fallback to constants already set
      } finally {
        setLoadingCategories(false);
      }
    };
    
    fetchCategories();
  }, [owner]);

  useEffect(() => {
    if (isEditing) {
      if (useInput && inputRef.current) {
        inputRef.current.focus();
      } else if (!useInput && selectRef.current) {
        selectRef.current.focus();
      }
    }
  }, [isEditing, useInput]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isUpdating && !isSaving) {
      setIsEditing(true);
      setInputValue(displayCategory || '');
      setUseInput(false);
    }
  };

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === '__custom__') {
      setUseInput(true);
      return;
    }
    
    const finalValue = newValue === '__none__' ? null : newValue;
    if (finalValue !== displayCategory) {
      setIsSaving(true);
      try {
        await onUpdate(finalValue);
        setIsEditing(false);
      } catch (error) {
        console.error('Failed to update category:', error);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const finalValue = inputValue.trim() || null;
      if (finalValue !== displayCategory) {
        setIsSaving(true);
        try {
          await onUpdate(finalValue);
          setIsEditing(false);
        } catch (error) {
          console.error('Failed to update category:', error);
        } finally {
          setIsSaving(false);
        }
      } else {
        setIsEditing(false);
      }
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(displayCategory || '');
    }
  };

  const handleInputBlur = async () => {
    const finalValue = inputValue.trim() || null;
    if (finalValue !== displayCategory) {
      setIsSaving(true);
      try {
        await onUpdate(finalValue);
      } catch (error) {
        console.error('Failed to update category:', error);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  if (isEditing) {
    if (useInput) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border-2 border-docutrain-light focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 bg-white"
          onClick={(e) => e.stopPropagation()}
          placeholder="Enter category"
          autoFocus
        />
      );
    }

    return (
      <select
        ref={selectRef}
        value={displayCategory || '__none__'}
        onChange={handleSelectChange}
        onBlur={() => !useInput && setIsEditing(false)}
        className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border-2 border-docutrain-light focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 bg-white cursor-pointer"
        onClick={(e) => e.stopPropagation()}
        autoFocus
      >
        <option value="__none__">(None)</option>
        {categoryOptions.map((opt, index) => (
          <option key={`${opt}-${index}`} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__custom__">+ Custom...</option>
      </select>
    );
  }

  if (!displayCategory) {
    return (
      <div
        onClick={handleClick}
        className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-400 border border-gray-200/50 shadow-sm cursor-pointer transition-opacity max-w-full mx-auto ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
        title="Click to add category"
      >
        <span className="truncate">(None)</span>
      </div>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`inline-flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm cursor-pointer transition-opacity max-w-full mx-auto ${isUpdating || isSaving ? 'opacity-50' : 'hover:opacity-80'}`}
      title="Click to edit"
    >
      <span className="truncate">{displayCategory}</span>
    </span>
  );
}

