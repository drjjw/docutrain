import React from 'react';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import type { DocumentWithOwner } from '@/types/admin';
import type { BulkDeleteProgress } from '../types';

interface BulkDeleteModalProps {
  isOpen: boolean;
  docs: DocumentWithOwner[];
  saving: boolean;
  progress: BulkDeleteProgress | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function BulkDeleteModal({
  isOpen,
  docs,
  saving,
  progress,
  onClose,
  onConfirm,
}: BulkDeleteModalProps) {
  if (!isOpen || docs.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title={progress ? "Deleting Documents..." : "Delete Multiple Documents"}
      size="lg"
    >
      <div className="space-y-4">
        {!progress ? (
          <>
            {/* Warning Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>

            {/* Body */}
            <p className="text-sm text-gray-700">
              Are you sure you want to delete <span className="font-medium text-gray-900">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>?
            </p>

            {/* Document List */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-gray-700 font-medium truncate">{doc.title || doc.slug}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    This will permanently remove all selected documents and their associated data from the system.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={onConfirm}
                disabled={saving}
                loading={saving}
                className="w-full sm:w-auto"
              >
                {saving ? 'Deleting...' : `Delete ${docs.length} Document${docs.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Progress View */}
            <div className="space-y-4">
              {/* Progress Summary */}
              <div className="bg-docutrain-light/10 border border-docutrain-light/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-docutrain-dark">Progress</span>
                  <span className="text-sm font-semibold text-docutrain-medium">
                    {progress.completed.length + progress.failed.length} / {progress.total}
                  </span>
                </div>
                <div className="w-full bg-docutrain-light/20 rounded-full h-2 mb-2">
                  <div
                    className="bg-docutrain-light h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((progress.completed.length + progress.failed.length) / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-docutrain-dark">
                  {progress.completed.length} deleted
                  {progress.failed.length > 0 && `, ${progress.failed.length} failed`}
                </p>
              </div>

              {/* Document List with Status */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {docs.map((doc) => {
                    const isCurrent = progress.current === doc.id;
                    const isCompleted = progress.completed.includes(doc.id);
                    const failedItem = progress.failed.find(f => f.id === doc.id);
                    
                    return (
                      <div key={doc.id} className="flex items-start gap-2 text-sm">
                        {isCurrent ? (
                          <div className="w-4 h-4 mt-0.5 flex-shrink-0">
                            <Spinner size="sm" />
                          </div>
                        ) : isCompleted ? (
                          <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : failedItem ? (
                          <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className={`font-medium truncate block ${
                            isCurrent ? 'text-docutrain-light' :
                            isCompleted ? 'text-green-700' :
                            failedItem ? 'text-red-700' :
                            'text-gray-700'
                          }`}>
                            {doc.title || doc.slug}
                          </span>
                          {failedItem && (
                            <span className="text-xs text-red-600 block mt-0.5">{failedItem.error}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Completion Message */}
              {progress.completed.length + progress.failed.length === progress.total && (
                <div className={`rounded-lg p-4 ${
                  progress.failed.length === 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="flex gap-3">
                    {progress.failed.length === 0 ? (
                      <>
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-medium text-green-800">All documents deleted successfully</h4>
                          <p className="text-sm text-green-700 mt-1">
                            {progress.completed.length} document{progress.completed.length !== 1 ? 's' : ''} have been permanently removed.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-medium text-yellow-800">Deletion completed with errors</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            {progress.completed.length} document{progress.completed.length !== 1 ? 's' : ''} deleted successfully, 
                            but {progress.failed.length} deletion{progress.failed.length !== 1 ? 's' : ''} failed.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Footer - Only show close button when complete */}
              {progress.completed.length + progress.failed.length === progress.total && (
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

