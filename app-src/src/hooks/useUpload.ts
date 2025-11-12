import { useState } from 'react';
import { uploadFile } from '@/lib/supabase/storage';
import { createDocument } from '@/lib/supabase/database';
import { getFileValidationError } from '@/lib/utils/validation';
import { getUploadErrorMessage } from '@/lib/utils/errors';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';
import { supabase } from '@/lib/supabase/client';
import { debugLog } from '@/utils/debug';

export function useUpload() {
  const { user } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: string; title: string } | null>(null);
  const [retryingProcessing, setRetryingProcessing] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  /**
   * Retry processing with exponential backoff
   * Automatically retries when server is busy (503)
   */
  const retryProcessing = async (
    documentId: string,
    attempt: number = 1,
    maxAttempts: number = 4
  ): Promise<boolean> => {
    if (attempt > maxAttempts) {
      console.error('❌ Max retry attempts reached');
      setRetryMessage('Server is busy. Please try again later.');
      setRetryingProcessing(false);
      return false;
    }

    // Exponential backoff: 30s, 60s, 120s, 240s
    const delay = Math.min(30000 * Math.pow(2, attempt - 1), 240000);
    const delaySeconds = Math.round(delay / 1000);

    setRetryingProcessing(true);
    setRetryMessage(`Server busy. Retrying in ${delaySeconds} seconds... (attempt ${attempt}/${maxAttempts})`);
    
    debugLog(`⏳ Waiting ${delaySeconds}s before retry attempt ${attempt}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ Session expired during retry');
        setRetryMessage('Session expired. Please refresh and try again.');
        setRetryingProcessing(false);
        return false;
      }

      setRetryMessage(`Attempting to start processing... (attempt ${attempt}/${maxAttempts})`);
      
      const timestamp = Date.now();
      const response = await fetch(`/api/process-document?t=${timestamp}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify({
          user_document_id: documentId,
        }),
      });

      if (response.ok) {
        debugLog(`✅ Processing started successfully on attempt ${attempt}`);
        setRetryMessage(null);
        setRetryingProcessing(false);
        return true;
      }

      // Check if it's a 503 (server busy) - retry
      if (response.status === 503) {
        console.warn(`⚠️  Server still busy (503) on attempt ${attempt}`);
        return retryProcessing(documentId, attempt + 1, maxAttempts);
      }

      // Other errors - don't retry
      const errorData = await response.json().catch(() => ({}));
      console.error(`❌ Processing failed with status ${response.status}:`, errorData);
      setRetryMessage(`Failed to start processing: ${errorData.error || 'Unknown error'}`);
      setRetryingProcessing(false);
      return false;

    } catch (error) {
      console.error(`❌ Error during retry attempt ${attempt}:`, error);
      
      // Network errors - retry
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('⚠️  Network error, will retry...');
        return retryProcessing(documentId, attempt + 1, maxAttempts);
      }

      // Other errors - don't retry
      setRetryMessage('Failed to start processing. Please try manually.');
      setRetryingProcessing(false);
      return false;
    }
  };

  const uploadText = async (textContent: string, title: string) => {
    if (!user) {
      setError('You must be logged in to upload');
      return null;
    }

    if (!title.trim()) {
      setError('Title is required');
      return null;
    }

    if (!textContent.trim()) {
      setError('Text content is required');
      return null;
    }

    if (textContent.trim().length < 10) {
      setError('Text content must be at least 10 characters long');
      return null;
    }

    if (textContent.length > 5000000) {
      setError('Text content exceeds maximum length of 5,000,000 characters');
      return null;
    }

    const words = textContent.trim().split(/\s+/).filter(word => word.length > 0);
    if (words.length < 5) {
      setError('Text content must contain at least 5 words');
      return null;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(false);
      setUploadedDocument(null);
      setProgress(0);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      setProgress(30);

      // Upload text directly to backend
      const response = await fetch('/api/upload-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          content: textContent.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      debugLog('✅ Text upload successful:', result);

      setProgress(100);
      setSuccess(true);
      setUploadedDocument({
        id: result.user_document_id,
        title: title.trim()
      });

      return { id: result.user_document_id, title: title.trim() };
    } catch (err) {
      const errorMessage = getUploadErrorMessage(err instanceof Error ? err : String(err));
      setError(errorMessage);
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const upload = async (file: File, title?: string) => {
    if (!user) {
      setError('You must be logged in to upload files');
      return null;
    }

    // Validate file
    const validationError = getFileValidationError(file, isSuperAdmin);
    if (validationError) {
      setError(validationError);
      return null;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccess(false);
      setUploadedDocument(null);
      setProgress(0);

      // Extract title from filename, removing common extensions
      const documentTitle = title || file.name.replace(/\.(pdf|mp3|wav|m4a|ogg|flac|aac)$/i, '');
      const FIFTY_MB = 50 * 1024 * 1024;
      
      // Check if this is an audio file (Supabase Storage bucket restricts MIME types, so audio must go through backend)
      const isAudioFile = file.type.startsWith('audio/') || 
                         /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name);

      // For files > 50MB OR audio files, use backend upload endpoint
      // Audio files must use backend because Supabase Storage bucket has MIME type restrictions
      if (file.size > FIFTY_MB || isAudioFile) {
        if (isAudioFile) {
          debugLog(`📤 Audio file detected (${(file.size / 1024 / 1024).toFixed(2)}MB), using backend upload (bypasses Storage MIME restrictions)...`);
        } else {
          debugLog(`📤 Large file detected (${(file.size / 1024 / 1024).toFixed(2)}MB), using backend upload...`);
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Authentication required');
        }

        setProgress(20);

        // Upload via backend (handles storage + database + processing)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', documentTitle);

        // For large files, bypass Vite proxy and go directly to backend
        // In production, this will use the same origin, but in dev we need to specify port
        const isDev = import.meta.env.DEV;
        const uploadUrl = isDev 
          ? 'http://localhost:3458/api/upload-document'  // Direct to backend in dev
          : '/api/upload-document';  // Use proxy/same-origin in production

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();
        debugLog('✅ Backend upload successful:', result);

        setProgress(100);
        setSuccess(true);
        setUploadedDocument({
          id: result.user_document_id,
          title: documentTitle
        });

        return { id: result.user_document_id, title: documentTitle };
      }

      // Standard flow for files <= 50MB
      setProgress(30);
      const uploadResult = await uploadFile(user.id, file);
      
      setProgress(70);

      // Create database record
      debugLog('📝 Creating database record for:', documentTitle);
      debugLog('   user_id:', user.id);
      debugLog('   file_path:', uploadResult.path);
      
      const document = await createDocument({
        user_id: user.id,
        title: documentTitle,
        file_path: uploadResult.path,
        file_size: file.size,
        mime_type: file.type,
      });
      
      debugLog('✅ Database record created successfully!');
      debugLog('   document.id:', document.id);
      debugLog('   document.user_id:', document.user_id);

      setProgress(85);

      // Wait a moment for database replication/commit
      debugLog('⏳ Waiting 500ms for database commit...');
      await new Promise(resolve => setTimeout(resolve, 500));
      debugLog('✅ Wait complete, triggering processing...');

      // Trigger processing with automatic retry on 503
      let processingTriggered = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Add timestamp to bust any cached 404 responses
          const timestamp = Date.now();
          const response = await fetch(`/api/process-document?t=${timestamp}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            },
            cache: 'no-store',
            body: JSON.stringify({
              user_document_id: document.id,
            }),
          });

          if (response.ok) {
            processingTriggered = true;
            debugLog('✅ Processing triggered successfully for document:', document.id);
          } else if (response.status === 503) {
            // Server busy - start automatic retry in background
            console.warn('⚠️  Server busy (503), starting automatic retry...');
            setRetryMessage('Server is busy. Will retry automatically...');
            
            // Start retry process asynchronously (don't wait for it)
            retryProcessing(document.id).then(success => {
              if (success) {
                debugLog('✅ Processing started after automatic retry');
              } else {
                console.warn('⚠️  Automatic retry failed. User can retry manually.');
              }
            });
          } else {
            const errorText = await response.text();
            console.error('❌ Failed to trigger processing:', errorText);
            console.warn('⚠️ Document uploaded but processing failed to start. User can retry manually.');
          }
        }
      } catch (processingError) {
        console.error('[useUpload] Processing error:', processingError);
        console.error('❌ Error triggering processing:', processingError);
        console.warn('⚠️ Document uploaded but processing failed to start. User can retry manually.');
      }

      setProgress(100);
      setSuccess(true);
      setUploadedDocument({
        id: document.id,
        title: documentTitle
      });
      
      return document;
    } catch (err) {
      console.error('[useUpload] Upload error caught:', err);
      console.error('[useUpload] Error details:', {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : typeof err,
        stack: err instanceof Error ? err.stack : undefined
      });
      const errorMessage = getUploadErrorMessage(err instanceof Error ? err : String(err));
      console.error('[useUpload] Transformed error message:', errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const reset = () => {
    // Log operation cancellation if there was an active upload
    if (uploadedDocument?.id) {
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            await fetch('/api/log-operation-deletion', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                user_document_id: uploadedDocument.id,
                operation_type: 'upload_reset',
                reason: 'Upload operation cancelled/reset by user'
              }),
            }).catch(err => {
              // Don't fail reset if logging fails
              console.warn('Failed to log upload reset:', err);
            });
          }
        } catch (logError) {
          // Don't fail reset if logging fails
          console.warn('Error logging upload reset:', logError);
        }
      })();
    }
    
    setError(null);
    setProgress(0);
    setSuccess(false);
    setUploadedDocument(null);
    setRetryingProcessing(false);
    setRetryMessage(null);
  };

  return {
    upload,
    uploadText,
    uploading,
    progress,
    error,
    success,
    uploadedDocument,
    retryingProcessing,
    retryMessage,
    reset,
  };
}

