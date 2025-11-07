import { Button } from '@/components/UI/Button';
import type { UserWithRoles } from '@/types/admin';
import { formatDate, getRoleBadge, userNeedsApproval, isProtectedSuperAdmin } from '../utils';

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
  
  const isSelected = selectedUserIds.has(user.id);
  const canSelect = !isProtected;

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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${roleBadge.color}`}>
              {roleBadge.label}
            </div>
            {roleBadge.description && roleBadge.description !== 'Global Access' && (
              <div className="text-xs text-gray-500 mt-1">
                {roleBadge.description}
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEditPermissions(user)}
            className="flex-shrink-0"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </Button>
        </div>
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
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewStats(user.id)}
            disabled={saving}
            title="View user statistics"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Stats
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResetPassword(user.email)}
            disabled={saving}
            title="Send password reset email"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetPassword(user.id)}
            disabled={saving}
            title="Set password directly"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Password
          </Button>
          {user.banned_until && new Date(user.banned_until) > new Date() ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUnban(user.id)}
              disabled={saving || isProtected}
              title="Unban user"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Unban
            </Button>
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(user.id)}
              disabled={saving || isProtected}
              title={isProtected ? 'Protected super admin cannot be deleted' : 'Delete or ban user'}
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

