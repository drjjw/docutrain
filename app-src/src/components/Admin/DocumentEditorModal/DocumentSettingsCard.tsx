import { Toggle } from '@/components/UI/Toggle';
import { NumberInput } from './fields';
import { AccessLevelSelector } from './AccessLevelSelector';
import type { DocumentSettingsCardProps } from './types';

export function DocumentSettingsCard({
  active,
  accessLevel,
  passcode,
  ownerId,
  owners,
  chunkLimitOverride,
  includeInSitemap,
  onFieldChange,
  isSuperAdmin
}: DocumentSettingsCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Permissions</h4>
        </div>
      </div>
      <div className="px-6 py-4">
        {/* Document Status */}
        <div className="mb-6">
          <h5 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Status
          </h5>
          <div className="space-y-4">
            <Toggle
              checked={active || false}
              onChange={(checked) => onFieldChange('active', checked)}
              label="Active Document"
              description="When enabled, this document is available for users to access"
              size="md"
            />
          </div>
        </div>

        {/* Access Level */}
        <AccessLevelSelector
          accessLevel={accessLevel}
          onAccessLevelChange={(value) => onFieldChange('access_level', value)}
          ownerId={ownerId}
          owners={owners}
          passcode={passcode}
          onPasscodeChange={(value) => onFieldChange('passcode', value)}
        />

        {/* Sitemap Inclusion - Only show for public documents */}
        {accessLevel === 'public' && (
          <div className="mb-6 mt-6">
            <h5 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Search Engine Visibility
            </h5>
            <div className="space-y-4">
              <Toggle
                checked={includeInSitemap !== false}
                onChange={(checked) => onFieldChange('include_in_sitemap', checked)}
                label="Include in Sitemap"
                description="When enabled, this document will be included in the sitemap.xml for search engines. Only applies to public documents."
                size="md"
              />
            </div>
          </div>
        )}

        {/* Technical Configuration - Super Admin Only */}
        {isSuperAdmin && (
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Technical Configuration
            </h5>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Chunk Limit Override</label>
              <div className="max-w-xs">
                <NumberInput
                  value={chunkLimitOverride}
                  onChange={(value) => onFieldChange('chunk_limit_override', value)}
                  min={1}
                  max={200}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Override the default maximum number of chunks to process (leave empty for default)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

