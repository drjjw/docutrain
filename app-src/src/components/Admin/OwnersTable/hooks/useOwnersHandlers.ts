import { updateOwner, createOwner, deleteOwner } from '@/lib/supabase/admin';
import type { Owner } from '@/types/admin';
import { clearOwnerLogoCache } from '@/hooks/useOwnerLogo';

interface UseOwnersHandlersProps {
  owners: Owner[];
  editingOwner: Owner | null;
  editName: string;
  editSlug: string;
  editDescription: string;
  editChunkLimit: number;
  editLogoUrl: string;
  editIntroMessage: string;
  editDefaultCover: string;
  editCustomDomain: string;
  editForcedGrokModel: string | null;
  editAccentColor: string;
  createName: string;
  createSlug: string;
  createDescription: string;
  createChunkLimit: number;
  createLogoUrl: string;
  createIntroMessage: string;
  createDefaultCover: string;
  createCustomDomain: string;
  createForcedGrokModel: string | null;
  createAccentColor: string;
  isSuperAdmin: boolean;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setEditingOwner: (owner: Owner | null) => void;
  setEditName: (name: string) => void;
  setEditSlug: (slug: string) => void;
  setEditDescription: (description: string) => void;
  setEditChunkLimit: (limit: number) => void;
  setEditLogoUrl: (url: string) => void;
  setEditIntroMessage: (message: string) => void;
  setEditDefaultCover: (cover: string) => void;
  setEditCustomDomain: (domain: string) => void;
  setEditForcedGrokModel: (model: string | null) => void;
  setEditAccentColor: (color: string) => void;
  setCreatingOwner: (creating: boolean) => void;
  setCreateName: (name: string) => void;
  setCreateSlug: (slug: string) => void;
  setCreateDescription: (description: string) => void;
  setCreateChunkLimit: (limit: number) => void;
  setCreateLogoUrl: (url: string) => void;
  setCreateIntroMessage: (message: string) => void;
  setCreateDefaultCover: (cover: string) => void;
  setCreateCustomDomain: (domain: string) => void;
  setCreateForcedGrokModel: (model: string | null) => void;
  setCreateAccentColor: (color: string) => void;
  setDeleteConfirmId: (id: string | null) => void;
  setOwners: (owners: Owner[]) => void;
  loadData: () => Promise<void>;
}

export function useOwnersHandlers({
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
}: UseOwnersHandlersProps) {
  const handleSaveOwner = async () => {
    if (!editingOwner) return;

    if (!editName.trim()) {
      setError('Owner name is required');
      return;
    }

    if (!editSlug.trim()) {
      setError('Owner slug is required');
      return;
    }

    if (editChunkLimit < 1 || editChunkLimit > 200) {
      setError('Chunk limit must be between 1 and 200');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await updateOwner(editingOwner.id, {
        name: editName.trim(),
        slug: editSlug.trim(),
        description: editDescription.trim() || null,
        default_chunk_limit: editChunkLimit,
        logo_url: editLogoUrl.trim() || null,
        intro_message: editIntroMessage.trim() || null,
        default_cover: editDefaultCover.trim() || null,
        custom_domain: editCustomDomain.trim() || null,
        forced_grok_model: editForcedGrokModel || null,
        metadata: {
          ...(editingOwner.metadata || {}),
          accent_color: editAccentColor.trim() || undefined,
        },
      });

      // Clear owner logo cache to ensure changes are reflected immediately
      clearOwnerLogoCache();

      setError('Owner updated successfully');
      setEditingOwner(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update owner');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOwner = async () => {
    if (!createName.trim()) {
      setError('Owner name is required');
      return;
    }

    if (!createSlug.trim()) {
      setError('Owner slug is required');
      return;
    }

    if (createChunkLimit < 1 || createChunkLimit > 200) {
      setError('Chunk limit must be between 1 and 200');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await createOwner({
        name: createName.trim(),
        slug: createSlug.trim(),
        description: createDescription.trim() || null,
        default_chunk_limit: createChunkLimit,
        logo_url: createLogoUrl.trim() || null,
        intro_message: createIntroMessage.trim() || null,
        default_cover: createDefaultCover.trim() || null,
        custom_domain: createCustomDomain.trim() || null,
        forced_grok_model: createForcedGrokModel || null,
        metadata: createAccentColor.trim() ? {
          accent_color: createAccentColor.trim(),
        } : undefined,
      });

      // Clear owner logo cache to ensure changes are reflected immediately
      clearOwnerLogoCache();

      setError('Owner created successfully');
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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create owner');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOwner = async (ownerId: string) => {
    if (!ownerId) return;

    try {
      setSaving(true);
      setError(null);

      await deleteOwner(ownerId);

      // Clear owner logo cache since an owner was deleted
      clearOwnerLogoCache();

      setError('Owner deleted successfully');
      setDeleteConfirmId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete owner');
    } finally {
      setSaving(false);
    }
  };

  return {
    handleSaveOwner,
    handleCreateOwner,
    handleDeleteOwner,
  };
}

