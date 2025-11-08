import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';

interface InvitationActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitationEmail: string;
  saving: boolean;
  isResending: boolean;
  isDeleting: boolean;
  onResend: () => void;
  onDelete: () => void;
}

export function InvitationActionsModal({
  isOpen,
  onClose,
  invitationEmail,
  saving,
  isResending,
  isDeleting,
  onResend,
  onDelete,
}: InvitationActionsModalProps) {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Actions for ${invitationEmail}`}
      size="sm"
    >
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => handleAction(onResend)}
          disabled={saving || isResending}
          loading={isResending}
          className="w-full !justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isResending ? 'Resending...' : 'Resend Invitation'}
        </Button>

        <div className="pt-2 border-t border-gray-200">
          <Button
            variant="danger"
            onClick={() => handleAction(onDelete)}
            disabled={saving || isDeleting}
            loading={isDeleting}
            className="w-full !justify-start"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {isDeleting ? 'Deleting...' : 'Delete Invitation'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

