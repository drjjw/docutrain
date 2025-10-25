export interface DownloadLink {
  url: string;
  title: string;
}

export interface Owner {
  id: string;
  slug: string;
  name: string;
  description?: string;
  default_chunk_limit: number;
  logo_url?: string;
  intro_message?: string;
  default_cover?: string;
  custom_domain?: string;
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
  is_public?: boolean;
  requires_auth?: boolean;
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

export interface UserWithRoles extends User {
  roles: UserRole[];
  owner_groups: {
    owner_id: string;
    owner_slug: string;
    owner_name: string;
    role: 'registered' | 'owner_admin' | 'super_admin';
  }[];
}

