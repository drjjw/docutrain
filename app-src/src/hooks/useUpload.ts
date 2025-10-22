import { useState } from 'react';
import { uploadFile } from '@/lib/supabase/storage';
import { createDocument } from '@/lib/supabase/database';
import { getFileValidationError } from '@/lib/utils/validation';
import { getUploadErrorMessage } from '@/lib/utils/errors';
import { useAuth } from './useAuth';

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

