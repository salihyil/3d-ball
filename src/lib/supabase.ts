import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableDefaultKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabasePublishableDefaultKey) {
  console.warn(
    'Supabase URL or Publishable Default Key is missing. Check your .env.local file.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabasePublishableDefaultKey || ''
);
