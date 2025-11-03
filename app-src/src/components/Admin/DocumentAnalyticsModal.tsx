import { useState, useEffect } from 'react';
import { Modal } from '@/components/UI/Modal';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { getDocumentAnalytics } from '@/lib/supabase/admin';
import type { DocumentWithOwner, DocumentAnalytics } from '@/types/admin';

interface DocumentAnalyticsModalProps {
  document: DocumentWithOwner;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentAnalyticsModal({ document, isOpen, onClose }: DocumentAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<DocumentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination states
  const [conversationPage, setConversationPage] = useState(1);
  const [downloadPage, setDownloadPage] = useState(1);
  const itemsPerPage = 50; // Show 50 items per page

  useEffect(() => {
    if (isOpen && document) {
      loadAnalytics(0, 0); // Initial load with offset 0
    } else {
      // Reset state when modal closes
      setAnalytics(null);
      setError(null);
      setConversationPage(1);
      setDownloadPage(1);
    }
  }, [isOpen, document?.id]);

  const loadAnalytics = async (convOffset = 0, downloadOffset = 0) => {
    if (!document?.id) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Loading analytics for document:', document.id, document.slug);
      const data = await getDocumentAnalytics(document.id, convOffset, downloadOffset, itemsPerPage, itemsPerPage);
      console.log('Analytics data received:', data);
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };
  
  const handleConversationPageChange = (page: number) => {
    setConversationPage(page);
    const offset = (page - 1) * itemsPerPage;
    loadAnalytics(offset, (downloadPage - 1) * itemsPerPage);
  };
  
  const handleDownloadPageChange = (page: number) => {
    setDownloadPage(page);
    const offset = (page - 1) * itemsPerPage;
    loadAnalytics((conversationPage - 1) * itemsPerPage, offset);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Analytics: ${document.title}`} size="full" fullscreen>
      <div className="space-y-6">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
            <span className="ml-3 text-gray-600">Loading analytics...</span>
          </div>
        ) : analytics ? (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-700 mb-1">Conversations</div>
                <div className="text-2xl font-bold text-blue-900">{analytics.conversationStats?.total || 0}</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-700 mb-1">Unique Users</div>
                <div className="text-2xl font-bold text-purple-900">{analytics.conversationStats?.uniqueUsers || 0}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-700 mb-1">Downloads</div>
                <div className="text-2xl font-bold text-green-900">{analytics.downloadStats?.total || 0}</div>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="text-sm font-medium text-orange-700 mb-1">Unique IPs</div>
                <div className="text-2xl font-bold text-orange-900">
                  {Math.max(analytics.conversationStats?.uniqueIPs || 0, analytics.downloadStats?.uniqueIPs || 0)}
                </div>
              </div>
            </div>

            {/* Conversation History Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Conversation History ({analytics.conversationPagination?.total || analytics.conversations?.length || 0})
              </h3>
              
              {!analytics.conversations || analytics.conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No conversations found for this document.</p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Question</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Answer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analytics.conversations.map((conv) => (
                            <tr key={conv.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(conv.created_at)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {conv.user_email || conv.user_name || (
                                  <span className="text-gray-400 italic">Anonymous</span>
                                )}
                                {conv.user_name && conv.user_email && (
                                  <div className="text-xs text-gray-500">{conv.user_email}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                                {conv.ip_address || <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                                <div className="truncate" title={conv.question}>
                                  {truncateText(conv.question, 80)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                                <div className="truncate" title={conv.response}>
                                  {truncateText(conv.response, 80)}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  conv.model === 'gemini' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-purple-100 text-purple-800'
                                }`}>
                                  {conv.model}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Pagination Controls */}
                  {analytics.conversationPagination && analytics.conversationPagination.total > itemsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="text-sm text-gray-700">
                        Showing {((conversationPage - 1) * itemsPerPage) + 1} to {Math.min(conversationPage * itemsPerPage, analytics.conversationPagination.total)} of {analytics.conversationPagination.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleConversationPageChange(conversationPage - 1)}
                          disabled={conversationPage === 1}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {conversationPage} of {Math.ceil(analytics.conversationPagination.total / itemsPerPage)}
                        </span>
                        <button
                          onClick={() => handleConversationPageChange(conversationPage + 1)}
                          disabled={!analytics.conversationPagination.hasMore}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Download History Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download History ({analytics.downloadPagination?.total || analytics.downloads?.length || 0})
              </h3>
              
              {!analytics.downloads || analytics.downloads.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No downloads found for this document.</p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {analytics.downloads.map((download) => (
                            <tr key={download.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(download.downloaded_at)}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {download.user_email || download.user_name || (
                                  <span className="text-gray-400 italic">Anonymous</span>
                                )}
                                {download.user_name && download.user_email && (
                                  <div className="text-xs text-gray-500">{download.user_email}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono">
                                {download.ip_address || <span className="text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {download.attachment_url ? (
                                  <a
                                    href={download.attachment_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                  >
                                    {download.attachment_title}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-gray-900">{download.attachment_title}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Pagination Controls */}
                  {analytics.downloadPagination && analytics.downloadPagination.total > itemsPerPage && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                      <div className="text-sm text-gray-700">
                        Showing {((downloadPage - 1) * itemsPerPage) + 1} to {Math.min(downloadPage * itemsPerPage, analytics.downloadPagination.total)} of {analytics.downloadPagination.total}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownloadPageChange(downloadPage - 1)}
                          disabled={downloadPage === 1}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {downloadPage} of {Math.ceil(analytics.downloadPagination.total / itemsPerPage)}
                        </span>
                        <button
                          onClick={() => handleDownloadPageChange(downloadPage + 1)}
                          disabled={!analytics.downloadPagination.hasMore}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}

