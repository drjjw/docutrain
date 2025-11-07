import React, { useState, useEffect } from 'react';
import { Toggle } from '@/components/UI/Toggle';
import { AlertTriangle } from 'lucide-react';
import type { DocumentDisclaimerCardProps } from './types';

const DEFAULT_DISCLAIMER_TEXT = 'This content is provided for informational purposes only. Please review and verify all information before use.';
const MAX_DISCLAIMER_LENGTH = 10000;

export function DocumentDisclaimerCard({
  showDisclaimer,
  disclaimerText,
  onFieldChange
}: DocumentDisclaimerCardProps) {
  const [localText, setLocalText] = useState(disclaimerText || '');
  const [isInitialized, setIsInitialized] = useState(false);

  // Update local text when prop changes (e.g., when document loads)
  useEffect(() => {
    console.log('DocumentDisclaimerCard: disclaimerText prop changed:', disclaimerText);
    setLocalText(disclaimerText || '');
  }, [disclaimerText]);

  useEffect(() => {
    console.log('DocumentDisclaimerCard: showDisclaimer prop:', showDisclaimer);
    // Mark as initialized after first render to prevent accidental clearing
    if (!isInitialized) {
      setIsInitialized(true);
    }
  }, [showDisclaimer, isInitialized]);

  const handleTextChange = (value: string) => {
    if (value.length <= MAX_DISCLAIMER_LENGTH) {
      setLocalText(value);
      // Pass null if empty string, otherwise pass the text
      onFieldChange('disclaimer_text', value.trim() === '' ? null : value);
    }
  };

  const handleToggle = (checked: boolean) => {
    console.log('DocumentDisclaimerCard: Toggle changed to:', checked, 'isInitialized:', isInitialized);
    // Only allow clearing text if we're intentionally disabling (not during initialization)
    if (!checked && isInitialized) {
      setLocalText('');
      onFieldChange('disclaimer_text', null);
    }
    onFieldChange('show_disclaimer', checked);
  };

  const characterCount = localText.length;
  const isNearLimit = characterCount > MAX_DISCLAIMER_LENGTH * 0.9;

  // Preview text - use local text if provided, otherwise default
  const previewText = localText.trim() || DEFAULT_DISCLAIMER_TEXT;
  const previewParagraphs = previewText.split('\n').filter(p => p.trim().length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Disclaimer Configuration</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-6">
        <Toggle
          checked={showDisclaimer || false}
          onChange={handleToggle}
          label="Show Disclaimer Modal"
          description="When enabled, users must accept a disclaimer before accessing this document"
          size="md"
        />

        {showDisclaimer && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Disclaimer Text
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({characterCount} / {MAX_DISCLAIMER_LENGTH} characters)
              </span>
            </label>
            <div className="text-xs text-gray-500 mb-2">
              Custom disclaimer text to display in the modal. Leave empty to use the generic default disclaimer.
            </div>
            <textarea
              value={localText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={DEFAULT_DISCLAIMER_TEXT}
              rows={6}
              maxLength={MAX_DISCLAIMER_LENGTH}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 ${
                isNearLimit ? 'border-yellow-300 bg-yellow-50' : 'border-gray-300'
              }`}
            />
            {characterCount === MAX_DISCLAIMER_LENGTH && (
              <p className="mt-2 text-sm text-red-600">Maximum character limit reached</p>
            )}
            {localText.trim() === '' && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <strong>Using default disclaimer:</strong> When left empty, the following generic disclaimer will be shown:
                    <div className="mt-2 p-2 bg-white border border-blue-200 rounded text-gray-700 italic">
                      {DEFAULT_DISCLAIMER_TEXT}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Section */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Preview
              </label>
              <div className="border border-gray-300 rounded-lg bg-white shadow-sm overflow-hidden">
                {/* Modal Header Preview */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="text-yellow-600" size={24} />
                    <span className="text-xl font-semibold text-gray-900">Important Disclaimer</span>
                  </div>
                </div>

                {/* Modal Content Preview */}
                <div className="p-6">
                  <div className="flex flex-col" style={{ maxHeight: '300px' }}>
                    {/* Scrollable content area */}
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
                      <div className="text-left space-y-4 text-gray-700">
                        {previewParagraphs.length > 1 ? (
                          previewParagraphs.map((paragraph, index) => (
                            <p key={index} dangerouslySetInnerHTML={{ __html: paragraph }} />
                          ))
                        ) : (
                          <p dangerouslySetInnerHTML={{ __html: previewText }} />
                        )}
                        <p className="text-sm text-gray-600 pt-2 border-t">
                          By using this service, you also agree to our{' '}
                          <a 
                            href="/app/terms" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Terms of Service
                          </a>
                          .
                        </p>
                      </div>
                    </div>

                    {/* Fixed footer with buttons */}
                    <div className="flex justify-end space-x-3 pt-4 mt-4 border-t flex-shrink-0">
                      <button
                        disabled
                        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg bg-white hover:bg-red-50 opacity-50 cursor-not-allowed"
                      >
                        I Decline
                      </button>
                      <button
                        disabled
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 opacity-50 cursor-not-allowed"
                      >
                        I Agree
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                This is a preview of how the disclaimer modal will appear to users. The content area is scrollable if the text is long.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

