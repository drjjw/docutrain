import type { DocumentWithOwner, Owner, DownloadLink } from '@/types/admin';

export type FieldChangeHandler = (field: string, value: any) => void;

export interface DocumentEditorModalProps {
  document: DocumentWithOwner | null;
  owners: Owner[];
  isSuperAdmin?: boolean;
  onSave: () => void;
  onCancel: () => void;
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
  onRetrainSuccess: () => void;
  onRetrainError: (error: string) => void;
}

export interface DocumentBasicInfoCardProps {
  title: string;
  subtitle: string;
  category: string | null;
  year: number | null;
  backLink: string;
  onFieldChange: FieldChangeHandler;
  isSuperAdmin: boolean;
  yearError: string | null;
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
  onFieldChange: FieldChangeHandler;
  isSuperAdmin: boolean;
}

export interface DocumentUIConfigCardProps {
  showDocumentSelector: boolean;
  showKeywords: boolean;
  showDownloads: boolean;
  showReferences: boolean;
  onFieldChange: FieldChangeHandler;
}

export interface DocumentMessagesCardProps {
  welcomeMessage: string;
  introMessage: string;
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

