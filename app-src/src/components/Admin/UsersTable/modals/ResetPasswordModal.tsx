import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  resetPasswordConfirm: string | null;
  saving: boolean;
  onConfirm: (email: string) => void;
}

export function ResetPasswordModal({
  isOpen,
  onClose,
  resetPasswordConfirm,
  saving,
  onConfirm,
}: ResetPasswordModalProps) {
  if (!resetPasswordConfirm) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send Password Reset Email"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Send a password reset email to <strong className="font-medium">{resetPasswordConfirm}</strong>?
        </p>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={() => onConfirm(resetPasswordConfirm)}
            disabled={saving}
            loading={saving}
            className="flex-1"
          >
            Send Email
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}


