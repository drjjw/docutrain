import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchDocuments, DocumentInfo } from '@/services/documentApi';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';

interface DocumentSelectorProps {
  onDocumentChange?: (document: string | string[]) => void;
}

export function DocumentSelector({ onDocumentChange }: DocumentSelectorProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<DocumentInfo | null>(null);

  const docParam = searchParams.get('doc');
  const ownerParam = searchParams.get('owner');
  const passcodeParam = searchParams.get('passcode');
  const showSelectorParam = searchParams.get('document_selector');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchDocuments({
        doc: docParam || undefined,
        owner: ownerParam || undefined,
        passcode: passcodeParam || undefined,
      });

      let docs = response.documents;

      // Check if selector should be shown
      let showSelector = false;
      if (showSelectorParam !== null) {
        showSelector = showSelectorParam === 'true';
      } else if (ownerParam) {
        showSelector = true;
      } else if (docParam && docs.length > 0) {
        const currentDoc = docs.find(d => d.slug === docParam);
        showSelector = currentDoc?.showDocumentSelector || false;
        
        // If should expand to owner documents
        if (showSelector && currentDoc?.ownerInfo && docs.length === 1) {
          const ownerResponse = await fetchDocuments({
            owner: currentDoc.ownerInfo.slug,
            passcode: passcodeParam || undefined,
          });
          docs = ownerResponse.documents;
        }
      }

      setDocuments(docs);

      // Set current document
      if (docParam && docs.length > 0) {
        const found = docs.find(d => d.slug === docParam);
        setCurrentDoc(found || null);
      } else if (ownerParam && docs.length > 0) {
        // Owner mode - no specific document selected
        setCurrentDoc(null);
      }

      // Auto-open if in owner mode
      if (ownerParam || showSelector) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }, [docParam, ownerParam, passcodeParam, showSelectorParam]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDocumentSelect = (doc: DocumentInfo) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('doc', doc.slug);
    newParams.delete('owner');
    
    setSearchParams(newParams);
    setIsOpen(false);
    setCurrentDoc(doc);
    
    if (onDocumentChange) {
      onDocumentChange(doc.slug);
    }
    
    // Navigate to chat page with new document
    navigate(`/chat?${newParams.toString()}`);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCurrentDocName = () => {
    if (currentDoc) {
      return currentDoc.title;
    }
    if (ownerParam && documents.length > 0) {
      const owner = documents[0].ownerInfo;
      if (owner) {
        if (owner.slug === 'ukidney') {
          return 'UKidney Medical Documents';
        }
        return `${owner.name || owner.slug} Documents`;
      }
    }
    return 'Select Document';
  };

  // Don't render if no documents and not in owner mode (unless explicitly requested)
  if (!ownerParam && !showSelectorParam && documents.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="document-selector-container" style={{ position: 'relative' }}>
      <button
        className="document-selector-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          background: 'white',
          cursor: 'pointer',
        }}
      >
        <svg className="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span className="current-doc-name" style={{ flex: 1, textAlign: 'left' }}>
          {loading ? 'Loading...' : getCurrentDocName()}
        </span>
        <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
          <polyline points={isOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="document-selector-overlay"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999,
            }}
          />
          <div
            className="document-selector-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              minWidth: '300px',
              maxWidth: '400px',
              maxHeight: '500px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Available Documents</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div
              className="document-list"
              style={{
                overflowY: 'auto',
                maxHeight: '350px',
                padding: '8px',
              }}
            >
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading...</div>
              ) : filteredDocuments.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No documents found</div>
              ) : (
                filteredDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentSelect(doc)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      border: 'none',
                      background: doc.slug === docParam ? '#f0f7ff' : 'transparent',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (doc.slug !== docParam) {
                        e.currentTarget.style.background = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (doc.slug !== docParam) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{doc.title}</div>
                    {doc.subtitle && (
                      <div style={{ fontSize: '0.85em', color: '#666' }}>{doc.subtitle}</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

