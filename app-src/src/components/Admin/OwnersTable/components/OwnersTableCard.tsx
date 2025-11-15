import { Button } from '@/components/UI/Button';
import type { Owner } from '@/types/admin';

interface OwnersTableCardProps {
  owner: Owner;
  saving: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function OwnersTableCard({
  owner,
  saving,
  onEdit,
  onDelete,
}: OwnersTableCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {owner.logo_url ? (
            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
              <img 
                src={owner.logo_url} 
                alt={owner.name} 
                className="h-full w-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
              {owner.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {owner.name}
            </h3>
            {owner.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {owner.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
              <span>
                <strong>Slug:</strong> <code className="bg-gray-100 px-1.5 py-0.5 rounded">{owner.slug}</code>
              </span>
              <span>
                <strong>Documents:</strong> {owner.document_count ?? 0}
              </span>
              <span>
                <strong>Chunk Limit:</strong> {owner.default_chunk_limit}
              </span>
              <span>
                <strong>Plan:</strong> <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  owner.plan_tier === 'unlimited' ? 'bg-purple-100 text-purple-800' :
                  owner.plan_tier === 'enterprise' ? 'bg-blue-100 text-blue-800' :
                  owner.plan_tier === 'pro' ? 'bg-green-100 text-green-800' :
                  owner.plan_tier === 'free' ? 'bg-gray-100 text-gray-800' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {owner.plan_tier ? owner.plan_tier.charAt(0).toUpperCase() + owner.plan_tier.slice(1) : 'Pro'}
                </span>
              </span>
              {owner.custom_domain && (
                <span>
                  <strong>Domain:</strong> {owner.custom_domain}
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Created: {new Date(owner.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
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
      </div>
    </div>
  );
}

