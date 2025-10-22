export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface UserDocument {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  status: DocumentStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentUpload {
  file: File;
  title: string;
}

