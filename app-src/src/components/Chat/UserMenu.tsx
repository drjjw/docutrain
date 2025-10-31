import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getAPIUrl } from '@/services/documentApi';

interface UserMenuProps {
  documentOwner?: string | null;
}

export function UserMenu({ documentOwner }: UserMenuProps) {
  const navigate = useNavigate();
  // Always call hooks (React requirement) but handle gracefully
  const { user, signOut } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Load user avatar based on permissions
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user || !permissions) return;

      try {
        const { isSuperAdmin, ownerGroups } = permissions;

        if (isSuperAdmin) {
          // Super admin uses default icon
          setAvatarUrl(null);
          return;
        }

        // Get first owner group's logo
        if (ownerGroups && ownerGroups.length > 0) {
          const primaryOwner = ownerGroups[0];
          
          // Fetch accessible owners to get logo_url
          const token = localStorage.getItem('sb-mlxctdgnojvkgfqldaob-auth-token');
          if (token) {
            const session = JSON.parse(token);
            const response = await fetch(`${getAPIUrl()}/api/permissions/accessible-owners`, {
              headers: {
                'Authorization': `Bearer ${session?.access_token}`
              }
            });

            if (response.ok) {
              const owners = await response.json();
              const ownerData = owners.find((o: any) => o.owner_id === primaryOwner.owner_id);
              
              if (ownerData?.logo_url) {
                setAvatarUrl(ownerData.logo_url);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };

    if (!permissionsLoading && permissions) {
      loadAvatar();
    }
  }, [user, permissions, permissionsLoading]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="header-user-menu" ref={menuRef} style={{ position: 'relative' }}>
      <button
        className="user-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          borderRadius: '6px',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e0e0' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="User avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px', color: '#666' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          )}
        </div>
        <svg className="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div
          className="user-menu-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            minWidth: '200px',
            zIndex: 1000,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
            <span className="user-email" style={{ fontSize: '14px', color: '#333', fontWeight: 500 }}>
              {user.email}
            </span>
          </div>
          <div style={{ padding: '8px 0' }}>
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
                padding: '10px 16px',
                textDecoration: 'none',
                color: '#333',
                fontSize: '14px',
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
                padding: '10px 16px',
                textDecoration: 'none',
                color: '#333',
                fontSize: '14px',
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
              className="sign-out-btn"
              onClick={handleSignOut}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#333',
                fontSize: '14px',
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
      )}
    </div>
  );
}

