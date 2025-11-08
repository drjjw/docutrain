import type { UserWithRoles } from '@/types/admin';
import { formatDate, getRoleBadge, userNeedsApproval, isProtectedSuperAdmin, getOwnerName } from '../utils';
import { UserActionsModal } from '../modals/UserActionsModal';
import { useState } from 'react';

interface UsersTableCardProps {
  user: UserWithRoles;
  isSuperAdmin: boolean;
  selectedUserIds: Set<string>;
  saving: boolean;
  onToggleSelection: (userId: string) => void;
  onEditPermissions: (user: UserWithRoles) => void;
  onViewStats?: (userId: string) => void;
  onResetPassword: (email: string) => void;
  onSetPassword: (userId: string) => void;
  onUnban?: (userId: string) => void;
  onDelete: (userId: string) => void;
}

export function UsersTableCard({
  user,
  isSuperAdmin,
  selectedUserIds,
  saving,
  onToggleSelection,
  onEditPermissions,
  onViewStats,
  onResetPassword,
  onSetPassword,
  onUnban,
  onDelete,
}: UsersTableCardProps) {
  const needsApproval = userNeedsApproval(user);
  const isProtected = isProtectedSuperAdmin(user);
  const roleBadge = getRoleBadge(user, isSuperAdmin);
  const ownerName = getOwnerName(user);
  const isSelected = selectedUserIds.has(user.id);
  const canSelect = !isProtected;
  const [showActionsModal, setShowActionsModal] = useState(false);
  
  // Get display name: use first_name + last_name if available, otherwise use email
  const displayName = (user.first_name || user.last_name)
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
    : user.email;
  
  // Get initial for avatar: use first letter of display name
  const avatarInitial = displayName.charAt(0).toUpperCase();
  
  return (
    <div 
      className={`bg-white rounded-lg shadow-sm border ${
        needsApproval ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'
      } overflow-hidden`}
    >
      {/* Card Header */}
      <div className={`px-4 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 ${isSelected ? 'bg-docutrain-light/10' : ''}`}>
        <div className="flex items-center gap-3">
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection(user.id)}
              className="w-4 h-4 text-docutrain-light border-gray-300 rounded focus:ring-docutrain-light flex-shrink-0"
            />
          )}
          <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
            {avatarInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{displayName}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {needsApproval && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  Pending Approval
                </span>
              )}
              {isProtected && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Protected
                </span>
              )}
              {user.email_confirmed_at && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 py-4 space-y-4">
        {/* Role Section */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Role & Permissions
          </div>
          <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${roleBadge.color}`}>
            {roleBadge.label}
          </div>
        </div>

        {/* Owner Section */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Owner
          </div>
          <div className="text-sm font-medium text-gray-900">
            {ownerName || '—'}
          </div>
        </div>

        {/* Dates Grid */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
          <div>
            <div className="text-xs text-gray-500 mb-1">Last Sign In</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDate(user.last_sign_in_at)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Created</div>
            <div className="text-sm font-medium text-gray-900">
              {formatDate(user.created_at)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={() => setShowActionsModal(true)}
              disabled={saving}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Actions"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <UserActionsModal
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        user={user}
        saving={saving}
        isProtected={isProtected}
        onEdit={() => onEditPermissions(user)}
        onViewStats={onViewStats ? () => onViewStats(user.id) : () => {}}
        onResetPassword={() => onResetPassword(user.email)}
        onSetPassword={() => onSetPassword(user.id)}
        onUnban={user.banned_until && new Date(user.banned_until) > new Date() && onUnban ? () => onUnban(user.id) : undefined}
        onDelete={() => onDelete(user.id)}
      />
    </div>
  );
}

