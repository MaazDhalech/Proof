import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const {
  SUPABASE_URL,
  ANON_PUBLIC_KEY,
} = Constants.expoConfig?.extra || {};

if (!SUPABASE_URL || !ANON_PUBLIC_KEY) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(SUPABASE_URL, ANON_PUBLIC_KEY);
