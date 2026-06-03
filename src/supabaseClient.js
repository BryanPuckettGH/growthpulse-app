import { createClient } from '@supabase/supabase-js';

// These come from environment variables (Vite exposes VITE_ vars to the app).
// The anon key is designed to be public; row-level security protects the data.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);
export const supabase = supabaseConfigured ? createClient(url, anon) : null;
