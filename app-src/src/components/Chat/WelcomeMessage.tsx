/**
 * WelcomeMessage - Displays welcome message and intro content with inline editing
 * Matches vanilla JS implementation from ui-document.js
 */

import { useCanEditDocument } from '@/hooks/useCanEditDocument';
import { InlineEditor } from './InlineEditor';
import { InlineWysiwygEditor } from './InlineWysiwygEditor';
import { useState, useCallback } from 'react';

interface WelcomeMessageProps {
  welcomeMessage: string;
  introMessage?: string | null;
  documentSlug: string;
}

/**
 * Save document field via API
 */
async function saveDocumentField(
  documentSlug: string,
  field: string,
  value: string
): Promise<boolean> {
  const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
  const sessionData = localStorage.getItem(sessionKey);
  if (!sessionData) {
    throw new Error('Not authenticated');
  }

  const session = JSON.parse(sessionData);
  const token = session?.access_token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`/api/documents/${documentSlug}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      [field]: value
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save');
  }

  // Clear document cache
  localStorage.removeItem('ukidney-documents-cache');

  return true;
}

export function WelcomeMessage({ welcomeMessage, introMessage, documentSlug }: WelcomeMessageProps) {
  const { canEdit } = useCanEditDocument(documentSlug);
  const [refreshKey, setRefreshKey] = useState(0);

  // Force refresh of document config after save
  const handleSave = useCallback(async (field: string, value: string) => {
    const success = await saveDocumentField(documentSlug, field, value);
    if (success) {
      // Force refresh by updating key
      setRefreshKey(prev => prev + 1);
      // Also trigger a manual cache clear and refetch
      window.dispatchEvent(new Event('document-updated'));
    }
    return success;
  }, [documentSlug]);

  return (
    <div className="welcome-message-section">
      <div className="message assistant" id="welcomeMessage">
        <div className="message-content">
          {canEdit ? (
            <InlineEditor
              id="welcomeTitle"
              value={welcomeMessage}
              field="welcome_message"
              documentSlug={documentSlug}
              onSave={(value) => handleSave('welcome_message', value)}
              className="loading-text"
              style={{ fontWeight: 'bold', display: 'block', marginBottom: introMessage ? '12px' : '0' }}
            />
          ) : (
            <strong id="welcomeTitle" className="loading-text">
              {welcomeMessage}
            </strong>
          )}
          {introMessage !== null && introMessage !== undefined && (
            canEdit ? (
              <InlineWysiwygEditor
                id="welcomeIntroContent"
                value={introMessage}
                field="intro_message"
                documentSlug={documentSlug}
                onSave={(value) => handleSave('intro_message', value)}
                className=""
              />
            ) : (
              <div 
                id="welcomeIntroContent"
                dangerouslySetInnerHTML={{ __html: introMessage }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

