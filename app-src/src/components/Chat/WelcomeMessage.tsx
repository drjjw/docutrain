import { DocumentInfo } from '@/services/documentApi';

interface WelcomeMessageProps {
  document: DocumentInfo | null;
  documents?: DocumentInfo[];
}

export function WelcomeMessage({ document, documents }: WelcomeMessageProps) {
  if (!document) return null;

  const displayDocs = documents && documents.length > 1 ? documents : [document];
  const isMultiDoc = displayDocs.length > 1;
  
  const welcomeText = isMultiDoc
    ? displayDocs.map(d => d.welcomeMessage || d.title).join(' and ')
    : document.welcomeMessage || document.title;

  const hasValidCover = document.cover && typeof document.cover === 'string' && document.cover.trim().length > 0;
  const introMessage = document.introMessage || null;

  // For single document with cover, show cover + welcome layout
  if (hasValidCover && !isMultiDoc) {
    return (
      <div className="document-cover-and-welcome">
        {/* Cover Image Section */}
        <div className="document-cover-section">
          <img
            src={document.cover}
            alt={document.title}
            className="document-cover-image"
            loading="lazy"
          />
          <div className="document-cover-overlay">
            <div className="document-cover-title">{document.title}</div>
            {document.subtitle && (
              <div className="document-cover-meta">{document.subtitle}</div>
            )}
          </div>
        </div>

        {/* Welcome Message Section */}
        <div className="welcome-message-section">
          <div className="message assistant">
            <div className="message-content">
              <strong style={{ fontSize: '1.2em', display: 'block', marginBottom: '12px' }}>
                {welcomeText}
              </strong>
              {introMessage && (
                <div 
                  dangerouslySetInnerHTML={{ __html: introMessage }}
                  style={{ marginTop: '12px' }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For multi-doc or no cover - show regular welcome message
  return (
    <div className="message assistant" style={{ marginBottom: '20px' }}>
      <div className="message-content">
        {isMultiDoc ? (
          <>
            <strong style={{ fontSize: '1.2em', display: 'block', marginBottom: '12px' }}>
              {displayDocs.map(d => d.title).join(' + ')}
            </strong>
            <div>{welcomeText}</div>
            <div style={{ marginTop: '12px', fontSize: '0.9em', color: '#666' }}>
              Multi-document search across {displayDocs.length} documents
            </div>
          </>
        ) : (
          <>
            <strong style={{ fontSize: '1.2em', display: 'block', marginBottom: '12px' }}>
              {document.title}
            </strong>
            <div>{welcomeText}</div>
            {introMessage && (
              <div 
                dangerouslySetInnerHTML={{ __html: introMessage }}
                style={{ marginTop: '12px' }}
              />
            )}
            {document.subtitle && (
              <div style={{ marginTop: '12px', fontSize: '0.9em', color: '#666' }}>
                {document.subtitle}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

