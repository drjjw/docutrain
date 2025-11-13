import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { debugLog } from '@/utils/debug';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { Modal } from '@/components/UI/Modal';

interface Conversation {
  id: string;
  question: string;
  response: string;
  user_id?: string;
  ip_address?: string;
  created_at: string;
  model: string;
  session_id: string;
  document_ids?: string[];
  document_name?: string;
  country?: string;
  banned: boolean;
}

interface ConversationsLiveProps {
  isSuperAdmin: boolean;
  ownerIds?: string[];
}

export function ConversationsLive({ isSuperAdmin, ownerIds = [] }: ConversationsLiveProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentNames, setDocumentNames] = useState<Record<string, string>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const channelRef = useRef<any>(null);

  // Fetch conversations from API
  const fetchConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/conversations?limit=100', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch conversations' }));
        throw new Error(errorData.error || 'Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
      setError(null);

      // Fetch document names for document IDs
      if (data.conversations && data.conversations.length > 0) {
        const docIds = new Set<string>();
        data.conversations.forEach((conv: Conversation) => {
          if (conv.document_ids && Array.isArray(conv.document_ids)) {
            conv.document_ids.forEach(id => docIds.add(id));
          }
        });

        if (docIds.size > 0) {
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('id, title, slug')
            .in('id', Array.from(docIds));

          if (!docsError && docs) {
            const namesMap: Record<string, string> = {};
            docs.forEach(doc => {
              namesMap[doc.id] = doc.title || doc.slug;
            });
            setDocumentNames(namesMap);
          }
        }
      }
    } catch (err) {
      debugLog('[ConversationsLive] Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get document name(s) for a conversation
  const getDocumentNames = (conv: Conversation): string => {
    if (conv.document_ids && Array.isArray(conv.document_ids) && conv.document_ids.length > 0) {
      const names = conv.document_ids
        .map(id => documentNames[id])
        .filter(Boolean);
      if (names.length > 0) {
        return names.length === 1 ? names[0] : `${names.length} documents`;
      }
    }
    return conv.document_name || 'Unknown document';
  };

  // Format response text (preserve line breaks - CSS whitespace-pre-wrap handles this)
  const formatResponse = (response: string): string => {
    return response || '';
  };

  // Helper function to fetch document names
  const fetchDocumentNames = React.useCallback((docIds: string[]) => {
    const missingIds = docIds.filter(id => !documentNames[id]);
    if (missingIds.length > 0) {
      supabase
        .from('documents')
        .select('id, title, slug')
        .in('id', missingIds)
        .then(({ data: newDocs }) => {
          if (newDocs) {
            setDocumentNames(prev => {
              const updated = { ...prev };
              newDocs.forEach(doc => {
                updated[doc.id] = doc.title || doc.slug;
              });
              return updated;
            });
          }
        });
    }
  }, [documentNames]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [isSuperAdmin, ownerIds]);

  // Set up real-time subscription
  useEffect(() => {
    if (loading) return;

    debugLog('[ConversationsLive] Setting up realtime subscription');

    // Pre-fetch allowed document IDs for owner admins to avoid repeated queries
    let allowedDocIds: Set<string> | null = null;
    if (!isSuperAdmin && ownerIds.length > 0) {
      supabase
        .from('documents')
        .select('id')
        .in('owner_id', ownerIds)
        .then(({ data: docs }) => {
          if (docs) {
            allowedDocIds = new Set(docs.map(doc => doc.id));
          }
        });
    }

    const channel = supabase
      .channel('conversations_live', {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
        },
        (payload) => {
          debugLog('[ConversationsLive] New conversation received:', payload);
          
          const newConv = payload.new as Conversation;
          
          // Skip banned conversations or those without questions
          if (newConv.banned || !newConv.question) {
            return;
          }

          // Filter by permissions
          if (!isSuperAdmin && ownerIds.length > 0) {
            // For owner admins, check if conversation's documents belong to their owner groups
            if (newConv.document_ids && Array.isArray(newConv.document_ids) && newConv.document_ids.length > 0) {
              // Check if any document belongs to owner groups
              const hasAccess = newConv.document_ids.some(docId => {
                if (allowedDocIds) {
                  return allowedDocIds.has(docId);
                }
                // Fallback: check document ownership
                return false;
              });

              if (!hasAccess) {
                // Double-check by querying documents
                supabase
                  .from('documents')
                  .select('id, owner_id')
                  .in('id', newConv.document_ids)
                  .in('owner_id', ownerIds)
                  .then(({ data: docs }) => {
                    if (docs && docs.length > 0) {
                      // Update allowed doc IDs cache
                      if (!allowedDocIds) {
                        allowedDocIds = new Set();
                      }
                      docs.forEach(doc => allowedDocIds!.add(doc.id));
                      
                      // Add conversation to list
                      setConversations(prev => [newConv, ...prev].slice(0, 100));
                      fetchDocumentNames(newConv.document_ids);
                    }
                  });
                return;
              }
            } else {
              // No document_ids, skip for owner admins
              return;
            }
          }

          // Add conversation to list (super admin or owner admin with access)
          setConversations(prev => [newConv, ...prev].slice(0, 100));
          
          // Fetch document names if needed
          if (newConv.document_ids && Array.isArray(newConv.document_ids) && newConv.document_ids.length > 0) {
            fetchDocumentNames(newConv.document_ids);
          }
        }
      )
      .subscribe((status) => {
        debugLog('[ConversationsLive] Realtime subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      debugLog('[ConversationsLive] Cleaning up realtime subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loading, isSuperAdmin, ownerIds, fetchDocumentNames]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <p>{error}</p>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Live Conversations
        </h3>
        <button
          onClick={fetchConversations}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No conversations yet.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConversation(conv)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-500">
                      {getDocumentNames(conv)}
                    </span>
                    {conv.country && (
                      <span className="text-xs text-gray-400">
                        {conv.country}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatTime(conv.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {conv.question}
                  </p>
                  {conv.model && (
                    <span className="text-xs text-gray-400">
                      Model: {conv.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Response Modal */}
      <Modal
        isOpen={!!selectedConversation}
        onClose={() => setSelectedConversation(null)}
        title={selectedConversation ? selectedConversation.question : ''}
        size="lg"
      >
        {selectedConversation && (
          <div className="space-y-4">
            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Document:</span>
                <span className="text-xs text-gray-700">{getDocumentNames(selectedConversation)}</span>
              </div>
              {selectedConversation.model && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Model:</span>
                  <span className="text-xs text-gray-700">{selectedConversation.model}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Time:</span>
                <span className="text-xs text-gray-700">{formatTime(selectedConversation.created_at)}</span>
              </div>
              {selectedConversation.country && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Country:</span>
                  <span className="text-xs text-gray-700">{selectedConversation.country}</span>
                </div>
              )}
            </div>

            {/* Question */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Question:</h3>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                {selectedConversation.question}
              </p>
            </div>

            {/* Response */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">AI Response:</h3>
              <div className="text-sm text-gray-800 bg-white border border-gray-200 p-4 rounded-lg whitespace-pre-wrap">
                {formatResponse(selectedConversation.response)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

