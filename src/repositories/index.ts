import { isSupabaseConfigured } from '../lib/supabaseClient';
import { LocalStorageSupplyHubRepository } from './localStorageRepository';
import { SupabaseSupplyHubRepository } from './supabaseRepository';
import type { ISupplyHubRepository } from './types';

// Otomatis menggunakan Supabase (PostgreSQL + Storage) begitu VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY diisi.
// Jika belum dikonfigurasi, tetap berjalan mulus menggunakan penyimpanan lokal browser (localStorage).
export const supplyHubRepository: ISupplyHubRepository = isSupabaseConfigured
  ? new SupabaseSupplyHubRepository()
  : new LocalStorageSupplyHubRepository();
