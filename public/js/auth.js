// ============================================================
// Circles — Auth Module
// ============================================================

async function getSupabase() {
  return await initSupabaseClient();
}

// ── Get current session ─────────────────────────────────────
async function getSession() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ── Get current user (with profile) ────────────────────────
async function getUser() {
  const session = await getSession();
  if (!session) return null;
  const sb = await getSupabase();
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  return profile ? { ...session.user, ...profile } : session.user;
}

// ── Sign Up ─────────────────────────────────────────────────
async function signUp(name, email, password, age, interests, instagram) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Auth not available');

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { name, age, interests, instagram_handle: instagram }
    }
  });
  if (error) throw error;

  // Update profile with full details (trigger creates the row)
  if (data.user) {
    await sb.from('profiles').upsert({
      id: data.user.id,
      name,
      email,
      age: age || null,
      interests: interests || [],
      instagram_handle: instagram || null
    });
  }

  return data;
}

// ── Sign In ─────────────────────────────────────────────────
async function signIn(email, password) {
  const sb = await getSupabase();
  if (!sb) throw new Error('Auth not available');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ── Sign Out ────────────────────────────────────────────────
async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  window.location.href = '/';
}

// ── Require Auth (redirect if not logged in) ────────────────
async function requireAuth(redirectTo) {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo || '/login.html';
    return null;
  }
  return session;
}

// ── Require Organiser role ──────────────────────────────────
async function requireOrganiser() {
  const user = await getUser();
  if (!user) { window.location.href = '/login.html'; return null; }
  if (user.role !== 'organiser' && user.role !== 'admin') {
    window.location.href = '/dashboard.html';
    return null;
  }
  return user;
}

// ── Init Auth (update nav) ──────────────────────────────────
async function initAuth() {
  const session = await getSession();
  updateNavForAuth(session);

  // Listen for auth state changes
  const sb = await getSupabase();
  if (sb) {
    sb.auth.onAuthStateChange((event, session) => {
      updateNavForAuth(session);
    });
  }

  return session;
}

function updateNavForAuth(session) {
  const navCta = document.getElementById('nav-cta');
  const navLogout = document.getElementById('nav-logout');
  const navDashboard = document.getElementById('nav-dashboard');

  if (session) {
    if (navCta) navCta.style.display = 'none';
    if (navLogout) navLogout.style.display = 'inline-flex';
    if (navDashboard) navDashboard.style.display = 'inline-flex';
  } else {
    if (navCta) navCta.style.display = 'inline-flex';
    if (navLogout) navLogout.style.display = 'none';
    if (navDashboard) navDashboard.style.display = 'none';
  }
}
