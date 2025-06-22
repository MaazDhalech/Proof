import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const {
  PUBLIC_SUPABASE_URL,
  ANON_PUBLIC_KEY,
} = Constants.expoConfig?.extra || {};

if (!PUBLIC_SUPABASE_URL || !ANON_PUBLIC_KEY) {
  throw new Error('Missing Supabase environment variables.');
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(PUBLIC_SUPABASE_URL, ANON_PUBLIC_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});