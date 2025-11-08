import type { UserWithRoles } from '@/types/admin';
import { formatDate, getRoleBadge, userNeedsApproval, isProtectedSuperAdmin, getOwnerName } from '../utils';
import { UserActionsModal } from '../modals/UserActionsModal';
import { useState } from 'react';

interface UsersTableRowProps {
  user: UserWithRoles;
  isSuperAdmin: boolean;
  selectedUserIds: Set<string>;
  saving: boolean;
  resendingInvitationId: string | null;
  deletingInvitationId: string | null;
  onToggleSelection: (userId: string) => void;
  onEditPermissions: (user: UserWithRoles) => void;
  onViewStats: (userId: string) => void;
  onResetPassword: (email: string) => void;
  onSetPassword: (userId: string) => void;
  onUnban: (userId: string) => void;
  onDelete: (userId: string) => void;
}

export function UsersTableRow({
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
}: UsersTableRowProps) {
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
    <tr 
      className={`hover:bg-gray-50 transition-colors ${
        needsApproval ? 'bg-amber-50/50' : ''
      } ${isSelected ? 'bg-docutrain-light/10' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        {canSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(user.id)}
            className="w-4 h-4 text-docutrain-light border-gray-300 rounded focus:ring-docutrain-light"
          />
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {displayName}
            </div>
            <div className="flex items-center gap-2 mt-1">
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
      </td>
      <td className="px-6 py-4">
        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${roleBadge.color}`}>
          {roleBadge.label}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {ownerName || '—'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {user.email_confirmed_at ? (
          <span className="inline-flex items-center">
            <svg className="w-4 h-4 text-green-500 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Email Verified
          </span>
        ) : (
          <span className="inline-flex items-center text-amber-600">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Unverified
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(user.last_sign_in_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(user.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
        <div className="flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActionsModal(true);
            }}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Actions"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        </div>
      </td>
      
      <UserActionsModal
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        user={user}
        saving={saving}
        isProtected={isProtected}
        onEdit={() => onEditPermissions(user)}
        onViewStats={() => onViewStats(user.id)}
        onResetPassword={() => onResetPassword(user.email)}
        onSetPassword={() => onSetPassword(user.id)}
        onUnban={user.banned_until && new Date(user.banned_until) > new Date() ? () => onUnban(user.id) : undefined}
        onDelete={() => onDelete(user.id)}
      />
    </tr>
  );
}

