import { Button } from '@/components/UI/Button';
import type { Owner } from '@/types/admin';

interface OwnersTableRowProps {
  owner: Owner;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function OwnersTableRow({
  owner,
  saving,
  onEdit,
  onDelete,
}: OwnersTableRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          {owner.logo_url ? (
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
              <img 
                src={owner.logo_url} 
                alt={owner.name} 
                className="h-full w-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
              {owner.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {owner.name}
            </div>
            {owner.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {owner.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {owner.slug}
        </code>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-900 font-medium">
          {owner.document_count ?? 0}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-900 font-medium">
          {owner.default_chunk_limit}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {owner.custom_domain ? (
          <span className="text-sm text-gray-900">{owner.custom_domain}</span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(owner.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            disabled={saving}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Delete
          </Button>
        </div>
      </td>
    </tr>
  );
}

