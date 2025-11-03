import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { retrainDocument, getRetrainingStatus } from '@/lib/supabase/admin';

interface DocumentRetrainerProps {
  documentId: string;
  documentSlug: string;
  onRetrainStart?: () => void;
  onRetrainSuccess?: () => void;
  onRetrainError?: (error: string) => void;
}

export function DocumentRetrainer({
  documentId,
  documentSlug,
  onRetrainStart,
  onRetrainSuccess,
  onRetrainError
}: DocumentRetrainerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userDocumentId, setUserDocumentId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Poll processing status
  useEffect(() => {
    if (!userDocumentId || !retraining) return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await getRetrainingStatus(userDocumentId);
        
        if (status.document.status === 'ready') {
          setSuccess(true);
          setRetraining(false);
          setProgress(100);
          setProcessingStatus('Complete!');
          clearInterval(pollInterval);
          
          if (onRetrainSuccess) {
            onRetrainSuccess();
          }
        } else if (status.document.status === 'error') {
          setError(status.document.error_message || 'Processing failed');
          setRetraining(false);
          clearInterval(pollInterval);
          
          if (onRetrainError) {
            onRetrainError(status.document.error_message || 'Processing failed');
          }
        } else if (status.document.status === 'processing') {
          // Update progress based on logs
          const logs = status.logs || [];
          const stages = ['download', 'extract', 'chunk', 'embed', 'store'];
          const completedStages = logs.filter(log => 
            log.status === 'completed' && stages.includes(log.stage)
          ).length;
          const progressPercent = Math.min(90, (completedStages / stages.length) * 100);
          setProgress(progressPercent);
          
          // Get latest stage message
          const latestLog = logs[logs.length - 1];
          if (latestLog) {
            setProcessingStatus(latestLog.message || 'Processing...');
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [userDocumentId, retraining, onRetrainSuccess, onRetrainError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleRetrain = async () => {
    if (!selectedFile) return;

    try {
      setRetraining(true);
      setError(null);
      setSuccess(false);
      setProgress(10);
      setProcessingStatus('Uploading PDF...');

      if (onRetrainStart) {
        onRetrainStart();
      }

      const result = await retrainDocument(documentId, selectedFile, false);
      
      setUserDocumentId(result.user_document_id);
      setProgress(20);
      setProcessingStatus('Processing started...');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start retraining';
      setError(errorMessage);
      setRetraining(false);
      
      if (onRetrainError) {
        onRetrainError(errorMessage);
      }
    }
  };

  const reset = () => {
    setError(null);
    setSuccess(false);
    setProgress(0);
    setProcessingStatus('');
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onDismiss={reset}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onDismiss={reset}>
          <div className="space-y-1">
            <p className="font-medium">Retraining complete!</p>
            <p className="text-sm">
              Document <strong>{documentSlug}</strong> has been successfully retrained with the new PDF content.
            </p>
          </div>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            disabled={retraining}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2.5 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-gradient-to-r file:from-amber-600 file:to-orange-600
              file:text-white
              hover:file:from-amber-700 hover:file:to-orange-700
              file:cursor-pointer cursor-pointer
              file:transition-all file:duration-200
              file:shadow-sm hover:file:shadow-md
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Warning: This will replace all existing training data for this document
          </p>
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetrain}
              loading={retraining}
              size="sm"
              className="ml-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
            >
              {retraining ? 'Retraining...' : 'Start Retraining'}
            </Button>
          </div>
        )}

        {retraining && progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-700">{processingStatus}</span>
              <span className="text-amber-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-600 to-orange-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              This may take several minutes depending on document size...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

