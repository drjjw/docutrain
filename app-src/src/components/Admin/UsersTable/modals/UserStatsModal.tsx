import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import { Spinner } from '@/components/UI/Spinner';
import type { UserStatistics } from '@/types/admin';

interface UserStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewingStatsUserId: string | null;
  userStats: UserStatistics | null;
  loadingStats: boolean;
}

export function UserStatsModal({
  isOpen,
  onClose,
  viewingStatsUserId,
  userStats,
  loadingStats,
}: UserStatsModalProps) {
  if (!viewingStatsUserId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Statistics"
      size="lg"
    >
      <div className="space-y-6">
        {loadingStats ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : userStats ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-700">Documents Uploaded</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{userStats.document_count}</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-medium text-green-700">Account Status</div>
                <div className="text-lg font-semibold text-green-900 mt-1">
                  {userStats.is_banned ? 'Banned' : userStats.email_verified ? 'Active' : 'Unverified'}
                </div>
              </div>
            </div>

            {userStats.documents && userStats.documents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Documents</h4>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userStats.documents.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{doc.title}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 font-mono">{doc.slug}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <div className="text-xs text-gray-500 mb-1">Last Login</div>
                <div className="text-sm font-medium text-gray-900">
                  {userStats.last_login ? new Date(userStats.last_login).toLocaleString() : 'Never'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Account Created</div>
                <div className="text-sm font-medium text-gray-900">
                  {userStats.account_created ? new Date(userStats.account_created).toLocaleString() : 'Unknown'}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Failed to load statistics
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

