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
  const [success, setSuccess] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ id: string; title: string } | null>(null);

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
      setSuccess(false);
      setUploadedDocument(null);
      setProgress(0);

      // Upload to storage
      setProgress(30);
      const uploadResult = await uploadFile(user.id, file);
      
      setProgress(70);

      // Create database record
      const documentTitle = title || file.name.replace('.pdf', '');
      console.log('📝 Creating database record for:', documentTitle);
      console.log('   user_id:', user.id);
      console.log('   file_path:', uploadResult.path);
      
      const document = await createDocument({
        user_id: user.id,
        title: documentTitle,
        file_path: uploadResult.path,
        file_size: file.size,
        mime_type: file.type,
      });
      
      console.log('✅ Database record created successfully!');
      console.log('   document.id:', document.id);
      console.log('   document.user_id:', document.user_id);

      setProgress(85);

      // Wait a moment for database replication/commit
      console.log('⏳ Waiting 500ms for database commit...');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ Wait complete, triggering processing...');

      // Trigger processing
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

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Failed to trigger processing:', errorText);
            console.warn('⚠️ Document uploaded but processing failed to start. User can retry manually.');
          } else {
            processingTriggered = true;
            console.log('✅ Processing triggered successfully for document:', document.id);
          }
        }
      } catch (processingError) {
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
    setSuccess(false);
    setUploadedDocument(null);
  };

  return {
    upload,
    uploading,
    progress,
    error,
    success,
    uploadedDocument,
    reset,
  };
}

