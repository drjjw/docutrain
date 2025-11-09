import { useState, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { supabase } from '@/lib/supabase/client';
import { debugLog } from '@/utils/debug';

interface TextUploadZoneProps {
  onUploadSuccess?: () => void;
  suppressSuccessMessage?: boolean;
  hideButton?: boolean; // If true, button is not rendered (for external rendering)
  onButtonStateChange?: (state: { uploading: boolean; canUpload: boolean }) => void; // Callback for button state changes
}

export interface TextUploadZoneRef {
  handleUpload: () => Promise<void>;
  uploading: boolean;
  canUpload: boolean;
}

export const TextUploadZone = forwardRef<TextUploadZoneRef, TextUploadZoneProps>(
  ({ onUploadSuccess, suppressSuccessMessage = false, hideButton = false, onButtonStateChange }, ref) => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: string; title: string } | null>(null);

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!content.trim()) {
      setError('Please enter text content');
      return;
    }

    if (content.trim().length < 10) {
      setError('Text content must be at least 10 characters long');
      return;
    }

    if (content.length > 5000000) {
      setError('Text content exceeds maximum length of 5,000,000 characters');
      return;
    }

    const words = content.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length < 5) {
      setError('Text content must contain at least 5 words');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(false);
      setUploadedDocument(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/upload-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      debugLog('✅ Text upload successful:', result);

      setSuccess(true);
      setUploadedDocument({
        id: result.user_document_id,
        title: title.trim()
      });

      // Clear form on success
      setContent('');
      setTitle('');

      // Call the success callback to refresh the documents list
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload text';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setUploadedDocument(null);
  };

  const canUpload = title.trim() && content.trim() && content.length <= 5000000;

  // Expose upload handler and state via ref
  useImperativeHandle(ref, () => ({
    handleUpload,
    uploading,
    canUpload: !!canUpload
  }));

  // Notify parent of button state changes
  useEffect(() => {
    if (onButtonStateChange) {
      onButtonStateChange({ uploading, canUpload: !!canUpload });
    }
  }, [uploading, canUpload, onButtonStateChange]);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onDismiss={reset}>
          {error}
        </Alert>
      )}

      {success && uploadedDocument && !suppressSuccessMessage && (
        <Alert variant="success" onDismiss={reset}>
          <div className="space-y-1">
            <p className="font-medium">Text uploaded successfully!</p>
            <p className="text-sm">
              <strong>{uploadedDocument.title}</strong> has been uploaded and processing will begin shortly.
            </p>
            <p className="text-sm text-green-700">
              Check "Your Uploaded Documents" below to track the processing status.
            </p>
          </div>
        </Alert>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="text-title" className="block text-sm font-medium text-gray-700">
            Document Title *
          </label>
          <input
            id="text-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., My Research Notes, Article Summary, etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={uploading}
            maxLength={200}
          />
          <p className="text-xs text-gray-500">
            Enter a descriptive title for your text content
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="text-content" className="block text-sm font-medium text-gray-700">
            Text Content *
          </label>
          <textarea
            id="text-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your text content here... You can paste articles, notes, research papers, or any text you want to train the AI on."
            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono resize-vertical"
            disabled={uploading}
            maxLength={5000000}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              Characters: {content.length.toLocaleString()} / 5,000,000
            </span>
            <span>
              Words: {content.trim().split(/\s+/).filter(word => word.length > 0).length}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Paste any text content you want to train the AI on. The system will automatically process and chunk the text for optimal retrieval.
          </p>
        </div>

        {!hideButton && (
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              loading={uploading}
              disabled={!canUpload}
              className="min-w-[120px]"
            >
              {uploading ? 'Uploading...' : 'Upload Text'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
