// ============================================================
// Circles — Supabase Client Initialization
// ============================================================

let supabase;

async function initSupabaseClient() {
  if (supabase) return supabase;

  // Try config injected at build/deploy time
  if (window.CIRCLES_CONFIG?.supabaseUrl && window.CIRCLES_CONFIG?.supabaseAnonKey) {
    supabase = window.supabase.createClient(
      window.CIRCLES_CONFIG.supabaseUrl,
      window.CIRCLES_CONFIG.supabaseAnonKey
    );
    return supabase;
  }

  // Fallback: fetch from /api/config (local dev / server-rendered)
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    if (config.supabaseUrl && config.supabaseAnonKey) {
      supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    } else {
      console.warn('Circles: Supabase config not set. Auth features disabled.');
      supabase = null;
    }
  } catch (e) {
    console.warn('Circles: Could not fetch /api/config.', e);
    supabase = null;
  }

  return supabase;
}
