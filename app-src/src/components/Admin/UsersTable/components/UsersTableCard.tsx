import { Button } from '@/components/UI/Button';
import type { UserWithRoles } from '@/types/admin';
import { formatDate, getRoleBadge, userNeedsApproval, isProtectedSuperAdmin } from '../utils';

interface UsersTableCardProps {
  user: UserWithRoles;
  isSuperAdmin: boolean;
  selectedUserIds: Set<string>;
  saving: boolean;
  onToggleSelection: (userId: string) => void;
  onEditPermissions: (user: UserWithRoles) => void;
  onResetPassword: (email: string) => void;
  onSetPassword: (userId: string) => void;
  onDelete: (userId: string) => void;
}

export function UsersTableCard({
  user,
  isSuperAdmin,
  selectedUserIds,
  saving,
  onToggleSelection,
  onEditPermissions,
  onResetPassword,
  onSetPassword,
  onDelete,
}: UsersTableCardProps) {
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
    <div 
      className={`bg-white rounded-lg shadow-sm border ${
        needsApproval ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'
      } overflow-hidden`}
    >
      {/* Card Header */}
      <div className={`px-4 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 ${isSelected ? 'bg-blue-50' : ''}`}>
        <div className="flex items-center gap-3">
          {canSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelection(user.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
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
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Button>
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
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResetPassword(user.email)}
              disabled={saving}
              className="flex-1 min-w-[120px]"
              title="Send password reset email"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Reset Link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetPassword(user.id)}
              disabled={saving}
              className="flex-1 min-w-[120px]"
              title="Set password directly"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Set Password
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(user.id)}
              disabled={saving || isProtected}
              className="flex-1 min-w-[120px]"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

