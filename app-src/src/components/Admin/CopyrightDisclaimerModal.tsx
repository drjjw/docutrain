/**
 * CopyrightDisclaimerModal - Copyright and Liability Disclaimer
 * 
 * Shows a disclaimer modal when users upload attachments or add manual URLs
 * to ensure they acknowledge they have rights to distribute the content and
 * absolve DocuTrain of liability.
 */

import { useState } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';

interface CopyrightDisclaimerModalProps {
  /** Whether the modal should be shown */
  isOpen: boolean;
  /** Callback when user accepts the disclaimer */
  onAccept: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional file name being uploaded */
  fileName?: string;
}

export function CopyrightDisclaimerModal({
  isOpen,
  onAccept,
  onCancel,
  fileName,
}: CopyrightDisclaimerModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAccept = () => {
    if (!acknowledged) return;
    setAcknowledged(false); // Reset for next use
    onAccept();
  };

  const handleCancel = () => {
    setAcknowledged(false); // Reset for next use
    onCancel();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Copyright & Distribution Rights Acknowledgment"
      size="lg"
      allowClose={true}
    >
      <div className="space-y-6">
        {/* Header with icon */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-gray-600">
            Please read and acknowledge the following terms before proceeding
          </p>
        </div>
        {/* File info if provided */}
        {fileName && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                File: <span className="font-mono">{fileName}</span>
              </span>
            </div>
          </div>
        )}

        {/* Disclaimer text */}
        <div className="text-left space-y-4 text-gray-700">
          <p className="text-base font-medium text-gray-900">
            Before uploading or adding this attachment, please confirm the following:
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-yellow-900">
                  Copyright & Distribution Rights
                </p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside ml-2">
                  <li>You confirm that the content you are uploading is not copyrighted material, OR</li>
                  <li>You have obtained all necessary rights and permissions to distribute this content</li>
                  <li>You have the legal authority to make this content available for download</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-900">
                  Liability Release
                </p>
                <p className="text-sm text-red-800">
                  By proceeding, you acknowledge that DocuTrain (and its operators) are not responsible 
                  for any copyright infringement, legal issues, or liability arising from the content you upload. 
                  You assume full responsibility for ensuring you have the right to distribute this content.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Important:</strong> Uploading copyrighted material without proper authorization may result 
              in legal consequences. Please ensure you have the necessary rights before proceeding.
            </p>
          </div>
        </div>

        {/* Checkbox for acknowledgment */}
        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900 block">
                I acknowledge and agree to the above terms
              </span>
              <span className="text-xs text-gray-600 mt-1 block">
                I confirm that I have the rights to distribute this content and release DocuTrain from all liability
              </span>
            </div>
          </label>
        </div>

        {/* Footer buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAccept}
            disabled={!acknowledged}
            className="w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I Agree & Continue
          </Button>
        </div>
      </div>
    </Modal>
  );
}

