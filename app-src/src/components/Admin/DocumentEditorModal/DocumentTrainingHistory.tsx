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

      const { data, error: fetchError } = await supabase
        .from('document_training_history')
        .select('*')
        .eq('document_slug', documentSlug)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setHistory(data || []);
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

  const getActionLabel = (actionType: string, retrainMode: string | null): string => {
    if (actionType === 'train') return 'Initial Training';
    if (actionType === 'retrain_replace') return 'Retrain (Replace)';
    if (actionType === 'retrain_add') return 'Retrain (Add)';
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

  if (history.length === 0) {
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
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {getActionLabel(entry.action_type, entry.retrain_mode)}
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
                  {entry.upload_type ? entry.upload_type.toUpperCase() : 'N/A'}
                </div>
              </div>

              {entry.file_name && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">File Name</div>
                  <div className="text-sm font-medium text-gray-900 truncate" title={entry.file_name}>
                    {entry.file_name}
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
        ))}
      </div>
    </div>
  );
}

