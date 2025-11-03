export interface DownloadLink {
  url: string;
  title: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  title: string;
  url: string;
  storage_path?: string;
  file_size?: number;
  mime_type?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
}

// For backward compatibility, DownloadLink can be used where attachments are displayed
// The backend will convert attachments to DownloadLink[] format

export interface Owner {
  id: string;
  slug: string;
  name: string;
  description?: string;
  default_chunk_limit: number;
  logo_url?: string;
  intro_message?: string;
  default_cover?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentCategory =
  | 'Guidelines'
  | 'Maker'
  | 'Manuals'
  | 'Presentation'
  | 'Recipes'
  | 'Reviews'
  | 'Slides'
  | 'Training';

export type DocumentAccessLevel =
  | 'public'
  | 'passcode'
  | 'registered'
  | 'owner_restricted'
  | 'owner_admin_only';

export interface Document {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  back_link?: string;
  welcome_message: string;
  pdf_filename: string;
  pdf_subdirectory: string;
  embedding_type: 'openai' | 'local';
  year?: string;
  active?: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  category?: DocumentCategory;
  owner?: string;
  owner_id?: string;
  cover?: string;
  intro_message?: string;
  downloads?: DownloadLink[];
  chunk_limit_override?: number;
  show_document_selector?: boolean;
  show_keywords?: boolean;
  show_downloads?: boolean;
  access_level?: DocumentAccessLevel;
  passcode?: string;
  uploaded_by_user_id?: string;
}

export interface DocumentWithOwner extends Document {
  owners?: Owner;
}

export interface User {
  id: string;
  email: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  last_sign_in_at?: string;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  raw_app_meta_data?: Record<string, any>;
  raw_user_meta_data?: Record<string, any>;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'registered' | 'owner_admin' | 'super_admin';
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UserStatistics {
  document_count: number;
  documents: Array<{
    slug: string;
    title: string;
    uploaded_at: string;
    owner_id?: string;
  }>;
  total_storage_bytes?: number;
  last_login?: string;
  account_created?: string;
  email_verified?: boolean;
  is_banned?: boolean;
}

export interface UserWithRoles extends User {
  roles: UserRole[];
  owner_groups: {
    owner_id: string;
    owner_slug: string;
    owner_name: string;
    role: 'registered' | 'owner_admin' | 'super_admin';
  }[];
  banned_until?: string;
  deleted_at?: string;
  statistics?: UserStatistics;
}

export interface ConversationStats {
  total: number;
  uniqueUsers: number;
  uniqueIPs: number;
}

export interface Conversation {
  id: string;
  question: string;
  response: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  created_at: string;
  model: string;
  session_id: string;
}

export interface DownloadStats {
  total: number;
  uniqueUsers: number;
  uniqueIPs: number;
}

export interface Download {
  id: string;
  attachment_title: string;
  attachment_url: string;
  user_email?: string;
  user_name?: string;
  ip_address?: string;
  downloaded_at: string;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface DocumentAnalytics {
  conversationStats: ConversationStats;
  conversations: Conversation[];
  conversationPagination: PaginationInfo;
  downloadStats: DownloadStats;
  downloads: Download[];
  downloadPagination: PaginationInfo;
}

