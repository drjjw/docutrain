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
  created_at: string;
  updated_at: string;
}

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
  category?: string;
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

