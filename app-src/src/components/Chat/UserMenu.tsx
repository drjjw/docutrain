/**
 * UserMenu - User dropdown menu with avatar, email, and navigation links
 * Ported from vanilla JS user-auth.js
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyProfile } from '@/lib/supabase/database';

interface UserMenuProps {
  inline?: boolean; // If true, renders content only (no button/dropdown) for inline use
  onItemClick?: () => void; // Callback when menu item is clicked (useful for closing mobile menu)
}

export function UserMenu({ inline = false, onItemClick }: UserMenuProps = {}) {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, isOwnerAdmin } = usePermissions();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [userAvatar, setUserAvatar] = useState<{ type: 'default' | 'owner'; src?: string; alt?: string }>({ type: 'default' });
  const [userName, setUserName] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Load user profile (name)
  useEffect(() => {
    async function loadUserProfile() {
      if (!user) {
        setUserName(null);
        return;
      }

      try {
        const profile = await getMyProfile();
        if (profile.first_name || profile.last_name) {
          const firstName = profile.first_name || '';
          const lastName = profile.last_name || '';
          setUserName(`${firstName} ${lastName}`.trim());
        } else {
          // Fallback to email if no name is available
          setUserName(null);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
        setUserName(null);
      }
    }

    loadUserProfile();
  }, [user]);

  // Load user avatar (owner logo for owner users, default icon for super admins)
  useEffect(() => {
    async function loadAvatar() {
      if (!user) {
        setUserAvatar({ type: 'default' });
        return;
      }

      try {
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);
        
        if (!sessionData) {
          return;
        }

        const session = JSON.parse(sessionData);
        const token = session?.access_token;

        if (!token) {
          return;
        }

        // Fetch user permissions
        const response = await fetch('/api/permissions', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const isSuperAdmin = data.is_super_admin;
        const ownerGroups = data.owner_groups || [];

        if (isSuperAdmin) {
          // Super admin: use default icon
          setUserAvatar({ type: 'default' });
          return;
        }

        // For users with owner groups: use first owner group's logo
        if (ownerGroups.length > 0) {
          const primaryOwner = ownerGroups[0];
          
          // Fetch accessible owners to get logo_url
          const ownerResponse = await fetch('/api/permissions/accessible-owners', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (ownerResponse.ok) {
            const owners = await ownerResponse.json();
            const ownerData = owners.find((o: any) => o.owner_id === primaryOwner.owner_id);
            
            if (ownerData && ownerData.logo_url) {
              setUserAvatar({
                type: 'owner',
                src: ownerData.logo_url,
                alt: ownerData.owner_name
              });
            }
          }
        }
      } catch (error) {
        console.error('Error loading user avatar:', error);
        setUserAvatar({ type: 'default' });
      }
    }

    loadAvatar();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  const hasAdminAccess = isSuperAdmin || isOwnerAdmin;

  // Define handleSignOut function before inline check so it's accessible
  const handleSignOut = async () => {
    try {
      // Clear all Supabase auth keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear session storage
      sessionStorage.clear();

      // Sign out via auth context
      await signOut();

      // Redirect to login
      window.location.href = '/app/login?logout=true';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/app/login?logout=true';
    }
  };

  // If inline mode, render just the menu content without button/dropdown wrapper
  if (inline) {
    const handleItemClick = () => {
      if (onItemClick) {
        onItemClick();
      }
    };

    const handleSignOutInline = async () => {
      handleItemClick();
      await handleSignOut();
    };

    return (
      <div className="w-full">
        {/* User Info Header */}
        <div className="px-4 py-3 border-b border-gray-200 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {userAvatar.type === 'owner' && userAvatar.src ? (
                <img
                  src={userAvatar.src}
                  alt={userAvatar.alt || 'User avatar'}
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-gray-600"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {userName || user.email}
              </div>
              {userName && (
                <div className="text-xs text-gray-500">{user.email}</div>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          {hasAdminAccess && (
            <a
              href="/app/dashboard"
              onClick={(e) => {
                e.preventDefault();
                navigate('/dashboard');
                handleItemClick();
              }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </a>
          )}

          <a
            href="/app/profile"
            onClick={(e) => {
              e.preventDefault();
              navigate('/profile');
              handleItemClick();
            }}
            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </a>

          <div className="my-1 border-t border-gray-200" />

          <button
            onClick={handleSignOutInline}
            className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Regular dropdown mode - render button and dropdown
  return (
    <div className="relative flex items-center flex-shrink-0 ml-auto mr-4">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isOpen
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`}
        title="User Menu"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
          {userAvatar.type === 'owner' && userAvatar.src ? (
            <img
              src={userAvatar.src}
              alt={userAvatar.alt || 'User avatar'}
              className="w-full h-full object-contain"
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-gray-600"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-900">
              {userName || user.email}
            </span>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {hasAdminAccess && (
              <a
                href="/app/dashboard"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/dashboard');
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Dashboard
              </a>
            )}

            <a
              href="/app/profile"
              onClick={(e) => {
                e.preventDefault();
                navigate('/profile');
                setIsOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Profile
            </a>

            <div className="my-1 border-t border-gray-200" />

            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
