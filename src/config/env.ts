export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function isDevAuthSkipped(): boolean {
  return import.meta.env.VITE_DEV_SKIP_AUTH === 'true';
}
