import Constants from 'expo-constants';
import { LettaClient } from '@letta-ai/letta-client'

const {
  LETTA_API_KEY
} = Constants.expoConfig?.extra || {};

if (!LETTA_API_KEY) {
  throw new Error('Missing Supabase environment variables.');
}

export const letta_client = new LettaClient({
    token: LETTA_API_KEY,
});