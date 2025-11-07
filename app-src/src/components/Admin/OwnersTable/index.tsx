import { useState } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { usePermissions } from '@/hooks/usePermissions';
import { useOwnersData } from './hooks/useOwnersData';
import { useOwnersHandlers } from './hooks/useOwnersHandlers';
import { OwnersTableRow } from './components/OwnersTableRow';
import { OwnersTableCard } from './components/OwnersTableCard';
import { EditOwnerModal } from './modals/EditOwnerModal';
import { CreateOwnerModal } from './modals/CreateOwnerModal';
import { DeleteOwnerModal } from './modals/DeleteOwnerModal';
import type { Owner } from '@/types/admin';

export function OwnersTable() {
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  
  // Data management
  const {
    owners,
    setOwners,
    loading,
    error,
    setError,
    loadData,
  } = useOwnersData();

  // Modal state
  const [saving, setSaving] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Form state for editing
  const [editName, setEditName] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editChunkLimit, setEditChunkLimit] = useState(50);
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editIntroMessage, setEditIntroMessage] = useState('');
  const [editDefaultCover, setEditDefaultCover] = useState('');
  const [editCustomDomain, setEditCustomDomain] = useState('');
  const [editForcedGrokModel, setEditForcedGrokModel] = useState<string | null>(null);
  const [editAccentColor, setEditAccentColor] = useState('');

  // Form state for creating
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createChunkLimit, setCreateChunkLimit] = useState(50);
  const [createLogoUrl, setCreateLogoUrl] = useState('');
  const [createIntroMessage, setCreateIntroMessage] = useState('');
  const [createDefaultCover, setCreateDefaultCover] = useState('');
  const [createCustomDomain, setCreateCustomDomain] = useState('');
  const [createForcedGrokModel, setCreateForcedGrokModel] = useState<string | null>(null);
  const [createAccentColor, setCreateAccentColor] = useState('');

  // Handlers
  const handlers = useOwnersHandlers({
    owners,
    editingOwner,
    editName,
    editSlug,
    editDescription,
    editChunkLimit,
    editLogoUrl,
    editIntroMessage,
    editDefaultCover,
    editCustomDomain,
    editForcedGrokModel,
    editAccentColor,
    createName,
    createSlug,
    createDescription,
    createChunkLimit,
    createLogoUrl,
    createIntroMessage,
    createDefaultCover,
    createCustomDomain,
    createForcedGrokModel,
    createAccentColor,
    isSuperAdmin,
    setSaving,
    setError,
    setEditingOwner,
    setEditName,
    setEditSlug,
    setEditDescription,
    setEditChunkLimit,
    setEditLogoUrl,
    setEditIntroMessage,
    setEditDefaultCover,
    setEditCustomDomain,
    setEditForcedGrokModel,
    setEditAccentColor,
    setCreatingOwner,
    setCreateName,
    setCreateSlug,
    setCreateDescription,
    setCreateChunkLimit,
    setCreateLogoUrl,
    setCreateIntroMessage,
    setCreateDefaultCover,
    setCreateCustomDomain,
    setCreateForcedGrokModel,
    setCreateAccentColor,
    setDeleteConfirmId,
    setOwners,
    loadData,
  });

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <Alert variant="error">
        You must be a super administrator to manage owners.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert 
          variant={error.includes('successfully') || error.includes('created') || error.includes('updated') ? "success" : "error"} 
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Owner Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage document owners and their configurations
          </p>
        </div>
        <Button
          onClick={() => {
            setCreatingOwner(true);
            setCreateName('');
            setCreateSlug('');
            setCreateDescription('');
            setCreateChunkLimit(50);
            setCreateLogoUrl('');
            setCreateIntroMessage('');
            setCreateDefaultCover('');
            setCreateCustomDomain('');
            setCreateForcedGrokModel(null);
            setCreateAccentColor('');
          }}
          disabled={saving}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Owner
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Chunk Limit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Custom Domain
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {owners.map((owner) => (
                <OwnersTableRow
                  key={owner.id}
                  owner={owner}
                  saving={saving}
                  onEdit={() => {
                    setEditingOwner(owner);
                    setEditName(owner.name);
                    setEditSlug(owner.slug);
                    setEditDescription(owner.description || '');
                    setEditChunkLimit(owner.default_chunk_limit);
                    setEditLogoUrl(owner.logo_url || '');
                    setEditIntroMessage(owner.intro_message || '');
                    setEditDefaultCover(owner.default_cover || '');
                    setEditCustomDomain(owner.custom_domain || '');
                    setEditForcedGrokModel(owner.forced_grok_model || null);
                    setEditAccentColor((owner.metadata as any)?.accent_color || '');
                  }}
                  onDelete={() => setDeleteConfirmId(owner.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {owners.map((owner) => (
          <OwnersTableCard
            key={owner.id}
            owner={owner}
            saving={saving}
            onEdit={() => {
              setEditingOwner(owner);
              setEditName(owner.name);
              setEditSlug(owner.slug);
              setEditDescription(owner.description || '');
              setEditChunkLimit(owner.default_chunk_limit);
              setEditLogoUrl(owner.logo_url || '');
              setEditIntroMessage(owner.intro_message || '');
              setEditDefaultCover(owner.default_cover || '');
              setEditCustomDomain(owner.custom_domain || '');
              setEditForcedGrokModel(owner.forced_grok_model || null);
              setEditAccentColor((owner.metadata as any)?.accent_color || '');
            }}
            onDelete={() => setDeleteConfirmId(owner.id)}
          />
        ))}
      </div>

      {owners.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No owners found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new owner.</p>
        </div>
      )}

      {/* Modals */}
      <EditOwnerModal
        isOpen={!!editingOwner}
        onClose={() => {
          setEditingOwner(null);
          setEditName('');
          setEditSlug('');
          setEditDescription('');
          setEditChunkLimit(50);
          setEditLogoUrl('');
          setEditIntroMessage('');
          setEditDefaultCover('');
          setEditCustomDomain('');
          setEditForcedGrokModel(null);
          setEditAccentColor('');
        }}
        owner={editingOwner}
        name={editName}
        slug={editSlug}
        description={editDescription}
        chunkLimit={editChunkLimit}
        logoUrl={editLogoUrl}
        introMessage={editIntroMessage}
        defaultCover={editDefaultCover}
        customDomain={editCustomDomain}
        forcedGrokModel={editForcedGrokModel}
        accentColor={editAccentColor}
        saving={saving}
        onNameChange={setEditName}
        onSlugChange={setEditSlug}
        onDescriptionChange={setEditDescription}
        onChunkLimitChange={setEditChunkLimit}
        onLogoUrlChange={setEditLogoUrl}
        onIntroMessageChange={setEditIntroMessage}
        onDefaultCoverChange={setEditDefaultCover}
        onCustomDomainChange={setEditCustomDomain}
        onForcedGrokModelChange={setEditForcedGrokModel}
        onAccentColorChange={setEditAccentColor}
        onSave={handlers.handleSaveOwner}
      />

      <CreateOwnerModal
        isOpen={creatingOwner}
        onClose={() => {
          setCreatingOwner(false);
          setCreateName('');
          setCreateSlug('');
          setCreateDescription('');
          setCreateChunkLimit(50);
          setCreateLogoUrl('');
          setCreateIntroMessage('');
          setCreateDefaultCover('');
          setCreateCustomDomain('');
          setCreateForcedGrokModel(null);
          setCreateAccentColor('');
        }}
        name={createName}
        slug={createSlug}
        description={createDescription}
        chunkLimit={createChunkLimit}
        logoUrl={createLogoUrl}
        introMessage={createIntroMessage}
        defaultCover={createDefaultCover}
        customDomain={createCustomDomain}
        forcedGrokModel={createForcedGrokModel}
        accentColor={createAccentColor}
        saving={saving}
        onNameChange={setCreateName}
        onSlugChange={setCreateSlug}
        onDescriptionChange={setCreateDescription}
        onChunkLimitChange={setCreateChunkLimit}
        onLogoUrlChange={setCreateLogoUrl}
        onIntroMessageChange={setCreateIntroMessage}
        onDefaultCoverChange={setCreateDefaultCover}
        onCustomDomainChange={setCreateCustomDomain}
        onForcedGrokModelChange={setCreateForcedGrokModel}
        onAccentColorChange={setCreateAccentColor}
        onSave={handlers.handleCreateOwner}
      />

      <DeleteOwnerModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        ownerId={deleteConfirmId}
        owner={owners.find(o => o.id === deleteConfirmId) || null}
        saving={saving}
        onConfirm={handlers.handleDeleteOwner}
      />
    </div>
  );
}

