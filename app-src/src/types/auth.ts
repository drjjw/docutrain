import type { User, Session, AuthResponse } from '@supabase/supabase-js';
import type { SignUpData } from '@/lib/supabase/auth';

export type { User, Session };

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData & { inviteToken?: string }) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
}

