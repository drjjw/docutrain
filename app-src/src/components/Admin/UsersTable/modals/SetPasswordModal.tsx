import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';

interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  passwordEditUserId: string | null;
  newPassword: string;
  saving: boolean;
  onPasswordChange: (password: string) => void;
  onUpdate: (userId: string) => void;
}

export function SetPasswordModal({
  isOpen,
  onClose,
  passwordEditUserId,
  newPassword,
  saving,
  onPasswordChange,
  onUpdate,
}: SetPasswordModalProps) {
  if (!passwordEditUserId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set User Password"
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            New Password
          </label>
          <input
            type="password"
            placeholder="Enter new password (min 6 characters)"
            value={newPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500">
            Password must be at least 6 characters long
          </p>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={() => onUpdate(passwordEditUserId)}
            disabled={saving || !newPassword || newPassword.length < 6}
            loading={saving}
            className="flex-1"
          >
            Update Password
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

