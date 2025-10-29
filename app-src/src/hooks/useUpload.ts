import { useState } from 'react';
import { uploadFile } from '@/lib/supabase/storage';
import { createDocument } from '@/lib/supabase/database';
import { getFileValidationError } from '@/lib/utils/validation';
import { getUploadErrorMessage } from '@/lib/utils/errors';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase/client';

export function useUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, title?: string) => {
    if (!user) {
      setError('You must be logged in to upload files');
      return null;
    }

    // Validate file
    const validationError = getFileValidationError(file);
    if (validationError) {
      setError(validationError);
      return null;
    }

    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      // Upload to storage
      setProgress(30);
      const uploadResult = await uploadFile(user.id, file);
      
      setProgress(70);

      // Create database record
      const documentTitle = title || file.name.replace('.pdf', '');
      const document = await createDocument({
        user_id: user.id,
        title: documentTitle,
        file_path: uploadResult.path,
        file_size: file.size,
        mime_type: file.type,
      });

      setProgress(85);

      // Trigger processing
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const response = await fetch('/api/process-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              user_document_id: document.id,
            }),
          });

          if (!response.ok) {
            console.error('Failed to trigger processing:', await response.text());
            // Don't fail the upload if processing trigger fails
            // User can manually retry later
          }
        }
      } catch (processingError) {
        console.error('Error triggering processing:', processingError);
        // Don't fail the upload if processing trigger fails
      }

      setProgress(100);
      
      return document;
    } catch (err) {
      const errorMessage = getUploadErrorMessage(err instanceof Error ? err : String(err));
      setError(errorMessage);
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const reset = () => {
    setError(null);
    setProgress(0);
  };

  return {
    upload,
    uploading,
    progress,
    error,
    reset,
  };
}

