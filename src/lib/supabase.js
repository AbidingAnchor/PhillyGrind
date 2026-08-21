import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const memoryStorage = new Map();

const authStorage = {
  getItem(key) {
    try {
      const value = window.localStorage.getItem(key);
      if (value != null) return value;
    } catch (error) {
      console.warn('[auth storage] localStorage getItem blocked', error);
    }
    return memoryStorage.get(key) ?? null;
  },
  setItem(key, value) {
    memoryStorage.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn('[auth storage] localStorage setItem blocked; using in-memory session only', error);
    }
  },
  removeItem(key) {
    memoryStorage.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('[auth storage] localStorage removeItem blocked', error);
    }
  },
};

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: authStorage,
      storageKey: 'phillygrind-auth-session',
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;
