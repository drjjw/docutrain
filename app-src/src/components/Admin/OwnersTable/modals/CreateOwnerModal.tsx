import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import { Input } from '@/components/UI/Input';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@/components/UI/Tabs';
import { LogoUploader } from '@/components/Admin/LogoUploader';
import { CoverImageUploader } from '@/components/Admin/CoverImageUploader';

interface CreateOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  planTier: 'free' | 'pro' | 'enterprise' | 'unlimited';
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
  onPlanTierChange: (tier: 'free' | 'pro' | 'enterprise' | 'unlimited') => void;
  onSave: () => void;
}

export function CreateOwnerModal({
  isOpen,
  onClose,
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
  planTier,
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
  onPlanTierChange,
  onSave,
}: CreateOwnerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Owner"
      size="xl"
    >
      <Tabs defaultIndex={0}>
        <TabList>
          <Tab index={0}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Basic Info
            </span>
          </Tab>
          <Tab index={1}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              Branding
            </span>
          </Tab>
          <Tab index={2}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configuration
            </span>
          </Tab>
          <Tab index={3}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Content
            </span>
          </Tab>
        </TabList>

        <TabPanels>
          {/* Basic Info Tab */}
          <TabPanel>
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 mb-1">Owner Information</h3>
                    <p className="text-sm text-blue-700">Provide the basic details for this owner group. The slug will be used in URLs.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Input
                    label={
                      <span>
                        Owner Name <span className="text-red-500">*</span>
                      </span>
                    }
                    value={name}
                    onChange={(e) => {
                      onNameChange(e.target.value);
                      // Auto-generate slug from name if slug is empty
                      if (!slug) {
                        onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                      }
                    }}
                    placeholder="e.g., Nephrology Guidelines"
                    helperText="The display name for this owner group"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Input
                    label={
                      <span>
                        Slug <span className="text-red-500">*</span>
                      </span>
                    }
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="nephrology-guidelines"
                    helperText="URL-friendly identifier (lowercase, hyphens only). Used in document URLs."
                    className="font-mono"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => onDescriptionChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    placeholder="Brief description of this owner group..."
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-gray-500">Optional description for internal use</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Tier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={planTier}
                    onChange={(e) => onPlanTierChange(e.target.value as 'free' | 'pro' | 'enterprise' | 'unlimited')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                    required
                  >
                    <option value="free">Free (1 document, no voice training)</option>
                    <option value="pro">Pro (5 documents, no voice training)</option>
                    <option value="enterprise">Enterprise (10 documents, voice training enabled)</option>
                    <option value="unlimited">Unlimited (no limits, voice training enabled)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Feature tier determines document limits and voice training availability</p>
                </div>

                <div>
                  <Input
                    label={
                      <span>
                        Default Chunk Limit <span className="text-red-500">*</span>
                      </span>
                    }
                    type="number"
                    value={chunkLimit}
                    onChange={(e) => onChunkLimitChange(parseInt(e.target.value) || 50)}
                    min={1}
                    max={200}
                    helperText="Default number of chunks to retrieve (1-200)"
                    required
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Branding Tab */}
          <TabPanel>
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-purple-900 mb-1">Visual Branding</h3>
                    <p className="text-sm text-purple-700">Customize the visual appearance of this owner's documents and interface.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Logo
                  </label>
                  <LogoUploader
                    logoUrl={logoUrl}
                    onChange={onLogoUrlChange}
                    allowManualUrl={true}
                  />
                  <p className="mt-2 text-xs text-gray-500">Logo displayed in the document interface header</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Default Cover Image
                  </label>
                  <CoverImageUploader
                    coverUrl={defaultCover}
                    onChange={onDefaultCoverChange}
                    allowManualUrl={true}
                  />
                  <p className="mt-2 text-xs text-gray-500">Default cover image for documents without a custom cover</p>
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
                      className="w-16 h-12 border-2 border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => onAccentColorChange(e.target.value)}
                      placeholder="#3399ff"
                      className="font-mono"
                      helperText="Hex color code for UI accents (buttons, highlights)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Configuration Tab */}
          <TabPanel>
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-green-900 mb-1">Advanced Configuration</h3>
                    <p className="text-sm text-green-700">Configure domain routing and model preferences for this owner.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Input
                    label="Custom Domain"
                    value={customDomain}
                    onChange={(e) => onCustomDomainChange(e.target.value)}
                    placeholder="nephrology.ukidney.com"
                    helperText="Custom domain that routes to this owner (must be unique). Leave empty to use default domain."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forced Grok Model
                  </label>
                  <select
                    value={forcedGrokModel || ''}
                    onChange={(e) => onForcedGrokModelChange(e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                  >
                    <option value="">None (use user selection)</option>
                    <option value="grok">Grok</option>
                    <option value="grok-reasoning">Grok Reasoning</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Overrides user model selection for this owner's documents. Leave as "None" to allow users to choose.</p>
                </div>
              </div>
            </div>
          </TabPanel>

          {/* Content Tab */}
          <TabPanel>
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900 mb-1">Content Settings</h3>
                    <p className="text-sm text-amber-700">Configure default content that appears in this owner's documents.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intro Message
                </label>
                <textarea
                  value={introMessage}
                  onChange={(e) => onIntroMessageChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                  placeholder="<p>Welcome to our document viewer...</p>"
                  rows={6}
                />
                <p className="mt-1 text-xs text-gray-500">Default HTML intro message displayed at the top of documents. Supports basic HTML tags.</p>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
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
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Owner
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

