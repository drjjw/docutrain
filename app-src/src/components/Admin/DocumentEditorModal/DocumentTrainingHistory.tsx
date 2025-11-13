import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface TrainingHistoryEntry {
  id: string;
  action_type: 'train' | 'retrain_replace' | 'retrain_add';
  status: 'started' | 'completed' | 'failed';
  upload_type: 'pdf' | 'text' | null;
  retrain_mode: 'replace' | 'add' | null;
  file_name: string | null;
  file_size: number | null;
  chunk_count: number | null;
  existing_chunk_count: number | null;
  processing_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

interface DocumentTrainingHistoryProps {
  documentSlug: string;
}

export function DocumentTrainingHistory({ documentSlug }: DocumentTrainingHistoryProps) {
  const [history, setHistory] = useState<TrainingHistoryEntry[]>([]);
  const [documentCreation, setDocumentCreation] = useState<any>(null);
  const [oldestTrainingId, setOldestTrainingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentSlug) return;
    loadHistory();
  }, [documentSlug]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch training history
      const { data: historyData, error: fetchError } = await supabase
        .from('document_training_history')
        .select('*')
        .eq('document_slug', documentSlug)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Find the oldest completed training entry (this is the true initial training)
      const oldestCompletedTraining = historyData && historyData.length > 0
        ? [...historyData]
            .filter(entry => entry.action_type === 'train' && entry.status === 'completed')
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        : null;
      
      // If no training entry exists but document was created before any retraining,
      // infer that document creation was the initial training
      const oldestRetraining = historyData && historyData.length > 0
        ? [...historyData]
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
        : null;

      // Fetch document creation details from documents table
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('created_at, metadata, pdf_filename')
        .eq('slug', documentSlug)
        .single();

      if (docError) {
        console.error('Error loading document details:', docError);
        // Don't throw - we can still show history without document details
      } else {
        // Try to find the original user_documents record that created this document
        // Look for all user_documents that might be related to this document
        // by checking training history entries for user_document_ids
        let originalUserDoc = null;
        
        if (docData?.metadata?.user_document_id) {
          // First try the user_document_id from metadata
          const { data: userDocFromMeta } = await supabase
            .from('user_documents')
            .select('id, mime_type, created_at, metadata, file_path, file_size')
            .eq('id', docData.metadata.user_document_id)
            .single();
          
          if (userDocFromMeta) {
            originalUserDoc = userDocFromMeta;
          }
        }
        
        // Also check training history entries for user_document_ids to find the original
        if (!originalUserDoc && historyData && historyData.length > 0) {
          // Get all unique user_document_ids from training history
          const userDocIds = [...new Set(historyData
            .map(entry => entry.user_document_id)
            .filter(id => id !== null))];
          
          if (userDocIds.length > 0) {
            // Fetch all user_documents and find the oldest one
            const { data: allUserDocs } = await supabase
              .from('user_documents')
              .select('id, mime_type, created_at, metadata, file_path, file_size')
              .in('id', userDocIds)
              .order('created_at', { ascending: true })
              .limit(1);
            
            if (allUserDocs && allUserDocs.length > 0) {
              originalUserDoc = allUserDocs[0];
            }
          }
        }
        
        // Determine the original upload type
        let originalUploadType = null;
        let originalFileName = null;
        let originalFileSize = null;
        let originalCreatedAt = docData?.created_at;
        
        // If no training entry exists but document was created before retraining,
        // infer that document creation was the initial training
        const shouldInferInitialTraining = !oldestCompletedTraining && 
                                          oldestRetraining && 
                                          docData?.created_at &&
                                          new Date(docData.created_at) < new Date(oldestRetraining.created_at);
        
        // PRIORITY: Use training history entry if available (it's the source of truth)
        if (oldestCompletedTraining) {
          // Use training history entry - this is the most accurate
          originalUploadType = oldestCompletedTraining.upload_type;
          originalFileName = oldestCompletedTraining.file_name === null && 
                            (oldestCompletedTraining.upload_type === 'text' || oldestCompletedTraining.upload_type === 'text_retrain')
            ? 'Text Input'
            : oldestCompletedTraining.file_name;
          originalFileSize = oldestCompletedTraining.file_size;
          originalCreatedAt = oldestCompletedTraining.created_at;
        } else if (originalUserDoc) {
          // Fallback to user_documents if no training history entry exists
          originalUploadType = originalUserDoc.metadata?.upload_type || 
            (originalUserDoc.mime_type?.startsWith('audio/') ? 'audio' :
             originalUserDoc.mime_type === 'application/pdf' ? 'pdf' :
             originalUserDoc.mime_type === 'text/plain' ? 'text' : null);
          originalFileName = originalUserDoc.file_path === 'text-upload' || originalUserDoc.file_path === 'text-retrain'
            ? 'Text Input'
            : originalUserDoc.file_path;
          originalFileSize = originalUserDoc.file_size;
          originalCreatedAt = originalUserDoc.created_at;
        } else if (shouldInferInitialTraining) {
          // Infer initial training from document creation (missing training history entry)
          // If oldest retraining has existing_chunk_count, there was definitely an initial training
          const hasExistingChunks = oldestRetraining?.existing_chunk_count && oldestRetraining.existing_chunk_count > 0;
          
          if (hasExistingChunks) {
            // Check processing logs to determine original upload type
            // Query processing logs for the initial processing (before first retraining)
            const { data: processingLogs } = await supabase
              .from('document_processing_logs')
              .select('stage, message, metadata, created_at')
              .eq('document_slug', documentSlug)
              .lt('created_at', oldestRetraining.created_at)
              .order('created_at', { ascending: true })
              .limit(10);
            
            // Check if initial processing had PDF download/extraction (indicates PDF upload)
            const hadPdfProcessing = processingLogs?.some(log => 
              log.message?.toLowerCase().includes('downloading pdf') ||
              log.message?.toLowerCase().includes('pdf downloaded') ||
              log.message?.toLowerCase().includes('extracting text from pdf')
            );
            
            if (!hadPdfProcessing && processingLogs && processingLogs.length > 0) {
              // No PDF processing = likely text upload
              originalUploadType = 'text';
              originalFileName = 'Text Input';
              // Try to get file size from processing logs or use a default
              const chunksLog = processingLogs.find(log => log.stage === 'complete' && log.metadata?.chunks);
              originalFileSize = chunksLog?.metadata?.chunks ? chunksLog.metadata.chunks * 500 : null; // Rough estimate
            } else {
              // Had PDF processing or can't determine
              originalUploadType = 'pdf';
              originalFileName = docData?.pdf_filename || 'Unknown';
            }
          } else {
            // No existing chunks mentioned - check file_path heuristics
            if (docData?.pdf_filename === 'text-content.txt' || 
                docData?.pdf_filename === 'text-upload' || 
                docData?.pdf_filename === 'text-retrain') {
              originalUploadType = 'text';
              originalFileName = 'Text Input';
            } else {
              originalUploadType = docData?.metadata?.upload_type || 'pdf';
              originalFileName = docData?.pdf_filename;
            }
          }
          originalFileSize = docData?.metadata?.file_size;
        } else {
          // Last fallback to document metadata
          originalUploadType = docData?.metadata?.upload_type;
          originalFileName = docData?.pdf_filename;
          originalFileSize = docData?.metadata?.file_size;
        }
        
        // Set document creation with original data
        setDocumentCreation({
          created_at: originalCreatedAt || docData?.created_at,
          metadata: {
            upload_type: originalUploadType,
            file_size: originalFileSize
          },
          pdf_filename: originalFileName
        });
        
        // Store the oldest training ID if we're using it
        if (oldestCompletedTraining) {
          setOldestTrainingId(oldestCompletedTraining.id);
        } else {
          setOldestTrainingId(null);
        }
      }

      // Filter out the oldest training entry AND its corresponding "started" entry from history list
      // (both are shown as Initial Training)
      const filteredHistory = oldestCompletedTraining
        ? (historyData || []).filter(entry => {
            // Filter out the completed entry
            if (entry.id === oldestCompletedTraining.id) return false;
            
            // Also filter out the corresponding "started" entry for the same training
            // Match by same user_document_id, same action_type, and status === 'started'
            if (entry.action_type === 'train' && 
                entry.status === 'started' &&
                entry.user_document_id === oldestCompletedTraining.user_document_id) {
              return false;
            }
            
            return true;
          })
        : (historyData || []);
      
      setHistory(filteredHistory);
    } catch (err: any) {
      console.error('Error loading training history:', err);
      setError(err.message || 'Failed to load training history');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDuration = (ms: number | null): string => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatUploadType = (uploadType: string | null): string => {
    if (!uploadType) return 'N/A';
    
    // Convert snake_case to Title Case and handle special cases
    switch (uploadType.toLowerCase()) {
      case 'pdf':
        return 'PDF';
      case 'text':
        return 'Text';
      case 'text_retrain':
        return 'Text';
      case 'audio':
        return 'Audio';
      default:
        // Convert snake_case to Title Case
        return uploadType
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
    }
  };

  const extractFileName = (filePath: string | null): string | null => {
    if (!filePath) return null;
    // Handle text uploads
    if (filePath === 'text-upload' || filePath === 'text-retrain' || filePath === 'text-content.txt') {
      return 'Text Input';
    }
    // Extract filename from path (remove directory prefix)
    // Path format: "user-id/timestamp-filename.pdf" -> "timestamp-filename.pdf"
    const parts = filePath.split('/');
    return parts.length > 0 ? parts[parts.length - 1] : filePath;
  };

  const getActionLabel = (actionType: string, retrainMode: string | null, isFirstTraining: boolean = false): string => {
    // If this is the very first training entry and there's no document creation record, show as Initial Training
    if (actionType === 'train' && isFirstTraining) return 'Initial Training';
    // Otherwise, all training activities after document creation are retraining
    if (actionType === 'train') return 'Retraining';
    if (actionType === 'retrain_replace') return 'Retraining (Replace)';
    if (actionType === 'retrain_add') return 'Retraining (Add)';
    return actionType;
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    switch (status) {
      case 'completed':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            ✓ Completed
          </span>
        );
      case 'failed':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-800`}>
            ✗ Failed
          </span>
        );
      case 'started':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            ⏳ Started
          </span>
        );
      default:
        return <span className={baseClasses}>{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading training history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // Check if we should show document creation entry
  const showDocumentCreation = documentCreation && documentCreation.created_at;
  const hasAnyHistory = showDocumentCreation || history.length > 0;

  if (!hasAnyHistory) {
    return (
      <div className="p-8 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No training history found for this document.</p>
        <p className="text-xs mt-2">Training and retraining activities will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Training History</h3>
        <button
          onClick={loadHistory}
          className="text-sm text-amber-600 hover:text-amber-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {/* Show document creation as the first "Initial Training" entry */}
        {showDocumentCreation && (
          <div
            className="bg-white border-2 border-amber-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Initial Training (Document Creation)
                  </h4>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    ✓ Completed
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDate(documentCreation.created_at)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <div className="text-xs text-gray-500 mb-1">Upload Type</div>
                <div className="text-sm font-medium text-gray-900">
                  {formatUploadType(documentCreation.metadata?.upload_type || 'pdf')}
                </div>
              </div>

              {documentCreation.pdf_filename && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {documentCreation.metadata?.upload_type === 'text' || documentCreation.metadata?.upload_type === 'text_retrain' ? 'Source' : 'File Name'}
                  </div>
                  <div className="text-sm font-medium text-gray-900 truncate" title={extractFileName(documentCreation.pdf_filename) || ''}>
                    {extractFileName(documentCreation.pdf_filename)}
                  </div>
                </div>
              )}

              {documentCreation.metadata?.file_size && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">File Size</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatFileSize(documentCreation.metadata.file_size)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-amber-100 bg-amber-50 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="text-xs text-amber-800">
                    This is the original document creation. All subsequent entries are retraining activities.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show all training history entries as retraining */}
        {history.map((entry, index) => {
          // Only the first entry should be "Initial Training" if there's no document creation record
          const isFirstTraining = !showDocumentCreation && index === history.length - 1;
          
          return (
            <div
              key={entry.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {getActionLabel(entry.action_type, entry.retrain_mode, isFirstTraining)}
                    </h4>
                    {getStatusBadge(entry.status)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(entry.created_at)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Upload Type</div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatUploadType(entry.upload_type)}
                  </div>
                </div>

                {entry.file_name && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">
                      {entry.upload_type === 'text' || entry.upload_type === 'text_retrain' ? 'Source' : 'File Name'}
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate" title={extractFileName(entry.file_name) || ''}>
                      {extractFileName(entry.file_name)}
                    </div>
                  </div>
                )}

                {entry.file_size && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">File Size</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatFileSize(entry.file_size)}
                    </div>
                  </div>
                )}

                {entry.chunk_count !== null && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Chunks</div>
                    <div className="text-sm font-medium text-gray-900">
                      {entry.chunk_count}
                      {entry.existing_chunk_count !== null && (
                        <span className="text-gray-500 ml-1">
                          (+{entry.existing_chunk_count} existing)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {entry.processing_time_ms !== null && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Processing Time</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDuration(entry.processing_time_ms)}
                    </div>
                  </div>
                )}
              </div>

              {entry.error_message && (
                <div className="mt-4 pt-4 border-t border-red-100">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-red-800 mb-1">Error</div>
                      <div className="text-xs text-red-700">{entry.error_message}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}








