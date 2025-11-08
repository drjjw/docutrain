import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import type { UserWithRoles } from '@/types/admin';

interface UserActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserWithRoles;
  saving: boolean;
  isProtected: boolean;
  onEdit: () => void;
  onViewStats: () => void;
  onResetPassword: () => void;
  onSetPassword: () => void;
  onUnban?: () => void;
  onDelete: () => void;
}

export function UserActionsModal({
  isOpen,
  onClose,
  user,
  saving,
  isProtected,
  onEdit,
  onViewStats,
  onResetPassword,
  onSetPassword,
  onUnban,
  onDelete,
}: UserActionsModalProps) {
  const isBanned = user.banned_until && new Date(user.banned_until) > new Date();
  
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Actions for ${user.email}`}
      size="sm"
    >
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => handleAction(onEdit)}
          disabled={saving}
          className="w-full !justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Permissions
        </Button>

        <Button
          variant="outline"
          onClick={() => handleAction(onViewStats)}
          disabled={saving}
          className="w-full !justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          View Statistics
        </Button>

        <Button
          variant="outline"
          onClick={() => handleAction(onResetPassword)}
          disabled={saving}
          className="w-full !justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Reset Password
        </Button>

        <Button
          variant="outline"
          onClick={() => handleAction(onSetPassword)}
          disabled={saving}
          className="w-full !justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Set Password
        </Button>

        {isBanned && onUnban && (
          <Button
            variant="outline"
            onClick={() => handleAction(onUnban)}
            disabled={saving || isProtected}
            className="w-full !justify-start"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Unban User
          </Button>
        )}

        <div className="pt-2 border-t border-gray-200">
          <Button
            variant="danger"
            onClick={() => handleAction(onDelete)}
            disabled={saving || isProtected}
            className="w-full !justify-start"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete User
          </Button>
        </div>
      </div>
    </Modal>
  );
}

