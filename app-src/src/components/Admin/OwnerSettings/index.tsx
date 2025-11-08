import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { LogoUploader } from '@/components/Admin/LogoUploader';
import { CoverImageUploader } from '@/components/Admin/CoverImageUploader';
import { WysiwygEditor } from '@/components/UI/WysiwygEditor';
import { useOwnerSettings } from './hooks/useOwnerSettings';
import type { Owner } from '@/types/admin';

interface OwnerSettingsProps {
  ownerId: string;
}

export function OwnerSettings({ ownerId }: OwnerSettingsProps) {
  const { owner, loading, error, saving, updateSettings } = useOwnerSettings(ownerId);
  
  // Form state
  const [logoUrl, setLogoUrl] = useState('');
  const [introMessage, setIntroMessage] = useState('');
  const [defaultCover, setDefaultCover] = useState('');
  const [accentColor, setAccentColor] = useState('#3399ff');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize form state when owner data loads
  useEffect(() => {
    if (owner) {
      setLogoUrl(owner.logo_url || '');
      setIntroMessage(owner.intro_message || '');
      setDefaultCover(owner.default_cover || '');
      const metadata = owner.metadata as Record<string, any> | null;
      setAccentColor(metadata?.accent_color || '#3399ff');
    }
  }, [owner]);

  const handleSave = async () => {
    try {
      setSaveError(null);
      setSaveSuccess(false);

      await updateSettings({
        logo_url: logoUrl || null,
        intro_message: introMessage || null,
        default_cover: defaultCover || null,
        metadata: {
          accent_color: accentColor || undefined,
        },
      });

      setSaveSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!owner) {
    return (
      <Alert variant="error">
        Owner not found or you don't have permission to access it.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Owner Settings</h2>
        <p className="text-sm text-gray-600">
          Manage your owner group's branding and configuration settings.
        </p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <Alert variant="success">
          Settings saved successfully!
        </Alert>
      )}

      {/* Error Messages */}
      {(error || saveError) && (
        <Alert variant="error">
          {error || saveError}
        </Alert>
      )}

      {/* Logo Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Logo
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Upload your owner group's logo. This will be displayed in the dashboard and chat interface.
          </p>
        </div>
        <div className="p-6">
          <LogoUploader
            logoUrl={logoUrl}
            onChange={setLogoUrl}
            ownerId={ownerId}
          />
        </div>
      </div>

      {/* Default Cover Image Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Default Cover Image
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Set a default cover image that will be used for documents in this owner group when no specific cover is set.
          </p>
        </div>
        <div className="p-6">
          <CoverImageUploader
            coverUrl={defaultCover}
            onChange={setDefaultCover}
            ownerId={ownerId}
          />
        </div>
      </div>

      {/* Intro Message Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Default HTML Intro Message for Documents
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            HTML formatted introduction message that will be used as the default for all documents in this owner group.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs text-gray-500 mb-2">
            Supports: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;a&gt;
          </div>
          <WysiwygEditor
            value={introMessage}
            onChange={setIntroMessage}
            placeholder="Enter default HTML intro message for documents..."
            className="w-full"
          />
          {introMessage && (
            <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </div>
              <div className="prose prose-sm max-w-none text-gray-800 wysiwyg-preview" dangerouslySetInnerHTML={{ __html: introMessage }} />
            </div>
          )}
        </div>
      </div>

      {/* Accent Color Section */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Accent Color
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Choose an accent color for your owner group's UI elements (buttons, highlights, etc.).
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor || '#3399ff'}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-16 h-10 border border-gray-300 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                placeholder="#3399ff"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            <p className="text-xs text-gray-500">
              Hex color code used for UI accents (e.g., buttons, highlights). Default: #3399ff
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

