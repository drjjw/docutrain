import type { DocumentWithOwner, Owner, DownloadLink } from '@/types/admin';

export type FieldChangeHandler = (field: string, value: any) => void;

export interface DocumentEditorModalProps {
  document: DocumentWithOwner | null;
  owners: Owner[];
  isSuperAdmin?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onRetrainingStart?: (userDocumentId: string) => void;
  onRetrainSuccess?: (userDocumentId: string) => void;
}

export interface DocumentOverviewSectionProps {
  documentId: string;
  slug: string;
  onSlugChange: (value: string) => void;
  ownerId?: string;
  onOwnerChange: (value: string) => void;
  owners: Owner[];
  isSuperAdmin: boolean;
}

export interface DocumentRetrainSectionProps {
  document: DocumentWithOwner;
  retraining: boolean;
  onRetrainStart: () => void;
  onRetrainSuccess: (userDocumentId?: string) => void;
  onRetrainError: (error: string) => void;
  onRetrainingStart?: (userDocumentId: string) => void;
}

export interface DocumentBasicInfoCardProps {
  title: string;
  subtitle: string;
  categoryObj?: { id: number; name: string } | null;
  year: number | null;
  backLink: string;
  onFieldChange: FieldChangeHandler;
  isSuperAdmin: boolean;
  yearError: string | null;
  owner?: Owner | null;
}

export interface DocumentFileDetailsCardProps {
  pdfFilename: string;
  pdfSubdirectory: string;
  embeddingType: 'openai' | 'local';
  cover: string;
  onFieldChange: FieldChangeHandler;
  onCoverChange: (url: string) => void;
  documentId: string;
  isSuperAdmin: boolean;
}

export interface AccessLevelSelectorProps {
  accessLevel: string;
  onAccessLevelChange: (value: string) => void;
  ownerId?: string;
  owners: Owner[];
  passcode: string;
  onPasscodeChange: (value: string) => void;
}

export interface DocumentSettingsCardProps {
  active: boolean;
  accessLevel: string;
  passcode: string;
  ownerId?: string;
  owners: Owner[];
  chunkLimitOverride: number | null;
  includeInSitemap?: boolean;
  onFieldChange: FieldChangeHandler;
  isSuperAdmin: boolean;
}

export interface DocumentUIConfigCardProps {
  showDocumentSelector: boolean;
  showKeywords: boolean;
  showDownloads: boolean;
  showReferences: boolean;
  showRecentQuestions: boolean;
  showCountryFlags: boolean;
  showQuizzes: boolean;
  quizzesGenerated?: boolean;
  documentSlug?: string;
  onFieldChange: FieldChangeHandler;
  isTextUpload?: boolean; // Whether this document is from a text upload (no pages)
  isSuperAdmin?: boolean; // Whether the current user is a super admin
  referencesDisabled?: boolean; // Whether references should be disabled (multiple PDFs or retrain_add)
  referencesDisabledReason?: string | null; // Reason why references are disabled
  savingField?: string | null; // Field name that is currently being saved
  savedField?: string | null; // Field name that was just saved
}

export interface DocumentMessagesCardProps {
  welcomeMessage: string;
  introMessage: string;
  onFieldChange: FieldChangeHandler;
}

export interface DocumentDisclaimerCardProps {
  showDisclaimer: boolean;
  disclaimerText: string | null;
  onFieldChange: FieldChangeHandler;
}

export interface DocumentDownloadsCardProps {
  downloads: DownloadLink[];
  onDownloadsChange: (downloads: DownloadLink[]) => void;
  documentId: string;
}

export interface DocumentMetadataCardProps {
  document: DocumentWithOwner;
  isSuperAdmin: boolean;
}

export interface DocumentEmbedCodeCardProps {
  documentSlug: string;
  documentTitle?: string;
}

