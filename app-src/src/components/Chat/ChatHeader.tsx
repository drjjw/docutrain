import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DocumentInfo } from '@/services/documentApi';
import { DocumentSelector } from './DocumentSelector';
import { UserMenu } from './UserMenu';
import { MobileMenu } from './MobileMenu';

interface ChatHeaderProps {
  document: DocumentInfo | null;
  onDocumentChange?: (document: string | string[]) => void;
}

export function ChatHeader({ document, onDocumentChange }: ChatHeaderProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ownerLogo = document?.ownerInfo?.logo_url;
  const ownerSlug = document?.ownerInfo?.slug;
  const ownerLinkDisabled = searchParams.get('owner_link') === 'false';

  // Debug logging (remove in production)
  useEffect(() => {
    if (document) {
      console.log('🏷️ ChatHeader - Document debug:', {
        hasDocument: !!document,
        slug: document.slug,
        hasOwnerInfo: !!document.ownerInfo,
        ownerInfo: document.ownerInfo,
        logoUrl: document.ownerInfo?.logo_url,
        willRenderLogo: !!(document.ownerInfo?.logo_url)
      });
      if (document.ownerInfo && !document.ownerInfo.logo_url) {
        console.warn('⚠️ ChatHeader - OwnerInfo exists but logo_url is missing:', document.ownerInfo);
      }
    } else {
      console.log('🏷️ ChatHeader - No document loaded yet');
    }
  }, [document]);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (ownerLinkDisabled) {
      e.preventDefault();
    } else if (ownerSlug) {
      e.preventDefault();
      navigate(`/chat?owner=${encodeURIComponent(ownerSlug)}`);
    }
  };

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: 'white', 
      borderBottom: '1px solid #e0e0e0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
      gap: '16px',
      width: '100%',
      boxSizing: 'border-box' as const,
    }}>
      {/* Owner Logo - Top Left */}
      {ownerLogo && (
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexShrink: 0,
        }}>
          <a
            href={ownerLinkDisabled ? '#' : `/chat?owner=${encodeURIComponent(ownerSlug!)}`}
            onClick={handleLogoClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textDecoration: 'none',
              transition: 'opacity 0.3s ease',
              cursor: ownerLinkDisabled ? 'default' : 'pointer',
            }}
            title={ownerLinkDisabled 
              ? `${document?.ownerInfo?.name || 'Owner'} logo`
              : `View all documents for ${document?.ownerInfo?.name || ownerSlug}`
            }
          >
            <img
              src={ownerLogo}
              alt={document?.ownerInfo?.name || `${ownerSlug} logo`}
              style={{
                height: '52px',
                width: 'auto',
                maxWidth: '200px',
                objectFit: 'contain',
                transition: 'all 0.3s ease',
              }}
            />
          </a>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: isMobile ? '20px' : '24px', 
          fontWeight: 400, 
          fontFamily: "'Archivo Narrow', sans-serif",
          color: '#1a1a1a',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {document ? document.title : 'AI Document Assistant'}
        </h1>
        {document?.subtitle && !isMobile && (
          <p style={{ 
            margin: '4px 0 0 0', 
            fontSize: '14px', 
            color: '#777',
            fontWeight: 400,
            letterSpacing: '0.2px',
          }}>
            {document.subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {isMobile ? (
          <MobileMenu 
            documentOwner={document?.ownerInfo?.slug} 
            onDocumentChange={onDocumentChange}
          />
        ) : (
          <>
            <DocumentSelector onDocumentChange={onDocumentChange} />
            <UserMenu documentOwner={document?.ownerInfo?.slug} />
          </>
        )}
      </div>
    </div>
  );
}

