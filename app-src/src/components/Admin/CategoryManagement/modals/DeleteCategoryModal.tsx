import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import type { Category } from '@/types/admin';

interface DeleteCategoryModalProps {
  category: Category | null;
  isOpen: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (categoryId: number) => void;
}

export function DeleteCategoryModal({
  category,
  isOpen,
  saving,
  onClose,
  onConfirm,
}: DeleteCategoryModalProps) {
  if (!category) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Category"
      size="md"
    >
      <div className="space-y-4">
        {/* Warning Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Documents using this category will have their category unassigned</p>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-gray-700">
          Are you sure you want to delete the category{' '}
          <span className="font-medium text-gray-900">"{category.name}"</span>?
        </p>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Impact</h4>
              <p className="text-sm text-yellow-700 mt-1">
                All documents currently assigned to this category will have their category set to None. 
                The documents themselves will not be deleted, but they will appear without a category assignment.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(category.id)}
            disabled={saving}
            loading={saving}
            className="w-full sm:w-auto"
          >
            {saving ? 'Deleting...' : 'Delete Category'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

