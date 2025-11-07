import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';

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
  onSave,
}: EditOwnerModalProps) {
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Default number of chunks to retrieve for this owner's documents (1-200)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo URL
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => onLogoUrlChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="https://example.com/logo.png"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Intro Message
          </label>
          <textarea
            value={introMessage}
            onChange={(e) => onIntroMessageChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Default HTML intro message for documents"
            rows={3}
          />
          <p className="mt-1 text-xs text-gray-500">
            Supports basic HTML tags
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Cover Image URL
          </label>
          <input
            type="url"
            value={defaultCover}
            onChange={(e) => onDefaultCoverChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="https://example.com/cover.jpg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Domain
          </label>
          <input
            type="text"
            value={customDomain}
            onChange={(e) => onCustomDomainChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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

