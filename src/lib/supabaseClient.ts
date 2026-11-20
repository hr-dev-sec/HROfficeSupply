import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const SUPABASE_STORAGE_BUCKET =
  (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined)?.trim() || 'supplyhub-media';

export const SUPABASE_DOCUMENTS_BUCKET =
  (import.meta.env.VITE_SUPABASE_DOCUMENTS_BUCKET as string | undefined)?.trim() || 'supplyhub-documents';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('YOUR_')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
