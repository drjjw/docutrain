import React, { useState } from 'react';
import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import { LogoUploader } from '@/components/Admin/LogoUploader';
import { CoverImageUploader } from '@/components/Admin/CoverImageUploader';
import { getCategoriesForOwner, createCategory, deleteCategory } from '@/lib/supabase/admin';
import { invalidateCategoryCache } from '@/utils/categories';
import type { Owner, Category } from '@/types/admin';

interface EditOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: Owner | null;
  name: string;
  slug: string;
  description: string;
  chunkLimit: number;
  logoUrl: string;
  introMessage: string;
  defaultCover: string;
  customDomain: string;
  forcedGrokModel: string | null;
  accentColor: string;
  categories: string[]; // Category names (for display)
  loadingCategories: boolean;
  saving: boolean;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onDescriptionChange: (description: string) => void;
  onChunkLimitChange: (limit: number) => void;
  onLogoUrlChange: (url: string) => void;
  onIntroMessageChange: (message: string) => void;
  onDefaultCoverChange: (cover: string) => void;
  onCustomDomainChange: (domain: string) => void;
  onForcedGrokModelChange: (model: string | null) => void;
  onAccentColorChange: (color: string) => void;
  onCategoriesChange: (categories: string[]) => void;
  onSave: () => void;
}

export function EditOwnerModal({
  isOpen,
  onClose,
  owner,
  name,
  slug,
  description,
  chunkLimit,
  logoUrl,
  introMessage,
  defaultCover,
  customDomain,
  forcedGrokModel,
  accentColor,
  categories,
  loadingCategories,
  saving,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
  onChunkLimitChange,
  onLogoUrlChange,
  onIntroMessageChange,
  onDefaultCoverChange,
  onCustomDomainChange,
  onForcedGrokModelChange,
  onAccentColorChange,
  onCategoriesChange,
  onSave,
}: EditOwnerModalProps) {
  const [newCategory, setNewCategory] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || !owner?.id) return;
    
    // Check if category already exists in owner's list
    if (categories.some(cat => cat.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryError('This category already exists');
      return;
    }

    // Check if it conflicts with system defaults
    try {
      const systemDefaults = await getCategoriesForOwner(null);
      const systemDefaultNames = systemDefaults
        .filter(cat => cat.owner_id === null)
        .map(cat => cat.name.toLowerCase());
      
      if (systemDefaultNames.includes(trimmed.toLowerCase())) {
        setCategoryError('This category already exists as a system default. Please use the existing category instead.');
        return;
      }
    } catch (err) {
      console.warn('Failed to check system defaults:', err);
      // Continue anyway - better to allow than block
    }

    try {
      setSavingCategory(true);
      setCategoryError(null);
      
      await createCategory({
        name: trimmed,
        is_custom: true,
        owner_id: owner.id,
      });
      
      // Reload categories from database to get the full Category objects
      const ownerCategories = await getCategoriesForOwner(owner.id);
      const customCategories = ownerCategories.filter(cat => cat.owner_id === owner.id);
      onCategoriesChange(customCategories.map(cat => cat.name));
      
      setNewCategory('');
      invalidateCategoryCache();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleRemoveCategory = async (categoryName: string) => {
    if (!owner?.id) return;
    
    if (!window.confirm('Are you sure you want to remove this category? Documents using this category will have their category_id set to NULL.')) {
      return;
    }

    try {
      setSavingCategory(true);
      setCategoryError(null);
      
      // Find the category ID
      const ownerCategories = await getCategoriesForOwner(owner.id);
      const categoryToDelete = ownerCategories.find(cat => cat.name === categoryName && cat.owner_id === owner.id);
      
      if (categoryToDelete) {
        await deleteCategory(categoryToDelete.id);
        
        // Reload categories from database
        const updatedCategories = await getCategoriesForOwner(owner.id);
        const customCategories = updatedCategories.filter(cat => cat.owner_id === owner.id);
        onCategoriesChange(customCategories.map(cat => cat.name));
        
        invalidateCategoryCache();
      }
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Owner"
      size="lg"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            placeholder="Owner Name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Slug <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            placeholder="owner-slug"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            URL-friendly identifier (lowercase, hyphens only)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            placeholder="Owner description"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Chunk Limit <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={chunkLimit}
            onChange={(e) => onChunkLimitChange(parseInt(e.target.value) || 50)}
            min={1}
            max={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Default number of chunks to retrieve for this owner's documents (1-200)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo
          </label>
          {owner ? (
            <LogoUploader
              logoUrl={logoUrl}
              onChange={onLogoUrlChange}
              ownerId={owner.id}
            />
          ) : (
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => onLogoUrlChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
              placeholder="https://example.com/logo.png"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Intro Message
          </label>
          <textarea
            value={introMessage}
            onChange={(e) => onIntroMessageChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            placeholder="Default HTML intro message for documents"
            rows={3}
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports basic HTML tags
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Cover Image
          </label>
          {owner ? (
            <CoverImageUploader
              coverUrl={defaultCover}
              onChange={onDefaultCoverChange}
              ownerId={owner.id}
            />
          ) : (
            <input
              type="url"
              value={defaultCover}
              onChange={(e) => onDefaultCoverChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
              placeholder="https://example.com/cover.jpg"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Domain
          </label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => onCustomDomainChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            placeholder="nephrology.ukidney.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            Custom domain that routes to this owner (must be unique)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Forced Grok Model
          </label>
          <select
            value={forcedGrokModel || ''}
            onChange={(e) => onForcedGrokModelChange(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
          >
            <option value="">None (use user selection)</option>
            <option value="grok">Grok</option>
            <option value="grok-reasoning">Grok Reasoning</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Overrides user model selection for this owner's documents
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor || '#3399ff'}
              onChange={(e) => onAccentColorChange(e.target.value)}
              className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => onAccentColorChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
              placeholder="#3399ff"
              pattern="^#[0-9A-Fa-f]{6}$"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Hex color code used for UI accents (e.g., buttons, highlights). Default: #3399ff
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Categories
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Define custom category options for documents in this owner group. If no categories are set, system default categories will be used (configurable by super admin).
          </p>
          
          {/* Current Categories */}
          {categories.length > 0 && (
            <div className="mb-3">
              {categoryError && (
                <div className="mb-2 text-sm text-red-600">{categoryError}</div>
              )}
              <div className="flex flex-wrap gap-2">
                {categories.map((category, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-docutrain-light/10 text-docutrain-dark rounded-lg border border-docutrain-light/30"
                  >
                    <span className="text-sm font-medium">{category}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(category)}
                      className="text-gray-500 hover:text-red-600 transition-colors"
                      title="Remove category"
                      disabled={savingCategory || loadingCategories}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Category */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={handleCategoryKeyDown}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
              placeholder="Enter category name (e.g., 'Guidelines', 'Training')"
              disabled={savingCategory || loadingCategories}
            />
            <Button
              type="button"
              onClick={handleAddCategory}
              disabled={!newCategory.trim() || categories.some(cat => cat.toLowerCase() === newCategory.trim().toLowerCase()) || savingCategory || loadingCategories}
              variant="secondary"
            >
              Add
            </Button>
          </div>
          {categories.length === 0 && (
            <p className="mt-2 text-xs text-gray-500">
              No custom categories set. Default categories will be used: Guidelines, Maker, Manuals, Presentation, Recipes, Reviews, Slides, Training
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !name.trim() || !slug.trim()}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

