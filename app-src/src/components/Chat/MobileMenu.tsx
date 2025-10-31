import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { DocumentSelector } from './DocumentSelector';

interface MobileMenuProps {
  documentOwner?: string | null;
  onDocumentChange?: (document: string | string[]) => void;
}

export function MobileMenu({ documentOwner, onDocumentChange }: MobileMenuProps) {
  const navigate = useNavigate();
  // Always call hooks (React requirement) but handle gracefully
  const { user, signOut } = useAuth();
  const { permissions } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [showDocumentSection, setShowDocumentSection] = useState(false);

  useEffect(() => {
    // Check if document selector should be shown
    setShowDocumentSection(documentOwner !== null || permissions?.ownerGroups?.length > 0);
  }, [documentOwner, permissions]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
      setIsOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 998,
          }}
        />
      )}

      {/* Menu Toggle Button */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
        }}
      >
        <span style={{ width: '24px', height: '2px', background: '#333', transition: 'all 0.3s', transform: isOpen ? 'rotate(45deg) translateY(8px)' : 'none' }}></span>
        <span style={{ width: '24px', height: '2px', background: '#333', transition: 'all 0.3s', opacity: isOpen ? 0 : 1 }}></span>
        <span style={{ width: '24px', height: '2px', background: '#333', transition: 'all 0.3s', transform: isOpen ? 'rotate(-45deg) translateY(-8px)' : 'none' }}></span>
      </button>

      {/* Menu Panel */}
      <div
        className="mobile-menu-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '300px',
          maxWidth: '85vw',
          height: '100vh',
          background: 'white',
          boxShadow: '-2px 0 12px rgba(0, 0, 0, 0.15)',
          zIndex: 999,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Menu</h2>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {showDocumentSection && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Documents</h3>
              </div>
              <DocumentSelector onDocumentChange={onDocumentChange} />
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Account</h3>
            </div>
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
              <div style={{ fontSize: '14px', color: '#666' }}>{user.email}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <a
                href="/app/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/dashboard');
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  textDecoration: 'none',
                  color: '#333',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Dashboard
              </a>
              <a
                href="/app/profile"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/profile');
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  textDecoration: 'none',
                  color: '#333',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Profile
              </a>
              <div style={{ height: '1px', background: '#eee', margin: '8px 0' }}></div>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#333',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

