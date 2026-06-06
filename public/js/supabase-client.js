// Circles — Supabase Client
// Fetches config from /api/config then initialises the client once.

let _supabase = null;
let _initPromise = null;

function initSupabaseClient() {
  if (_supabase) return Promise.resolve(_supabase);
  if (_initPromise) return _initPromise;

  _initPromise = fetch('/api/config')
    .then(r => r.json())
    .then(config => {
      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        console.warn('Circles: missing Supabase config');
        return null;
      }
      // window.supabase is set by the CDN <script> loaded before this file
      _supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      return _supabase;
    })
    .catch(e => {
      console.warn('Circles: could not load config', e);
      return null;
    });

  return _initPromise;
}
