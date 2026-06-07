require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// ─── Config ──────────────────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
  });
});

// ─── Communities ─────────────────────────────────────────────────────────────
app.get('/api/communities', async (req, res) => {
  try {
    let query = supabase
      .from('communities')
      .select('*, memberships(count)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const communities = (data || []).map(c => ({
      ...c,
      member_count: c.memberships?.[0]?.count || 0
    }));

    res.json({ communities });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/communities/:id', async (req, res) => {
  try {
    const { data: community, error } = await supabase
      .from('communities')
      .select('*, memberships(count)')
      .eq('id', req.params.id)
      .single();

    if (error || !community) return res.status(404).json({ error: 'Community not found' });

    const { data: events } = await supabase
      .from('events')
      .select('*, rsvps(count)')
      .eq('community_id', req.params.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true });

    res.json({
      community: {
        ...community,
        member_count: community.memberships?.[0]?.count || 0
      },
      events: (events || []).map(e => ({
        ...e,
        rsvp_count: e.rsvps?.[0]?.count || 0
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/communities/:id/join', requireAuth, async (req, res) => {
  try {
    const { data: community } = await supabase
      .from('communities')
      .select('id, whatsapp_link')
      .eq('id', req.params.id)
      .single();

    if (!community) return res.status(404).json({ error: 'Community not found' });

    const { error } = await supabase
      .from('memberships')
      .insert({ community_id: req.params.id, user_id: req.user.id });

    if (error && error.code !== '23505') {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, whatsapp_link: community.whatsapp_link });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/communities/:id/join', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('memberships')
      .delete()
      .eq('community_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Events ──────────────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  try {
    let query = supabase
      .from('events')
      .select('*, communities(name, category, cover_emoji), rsvps(count)')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (req.query.community_id) {
      query = query.eq('community_id', req.query.community_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const events = (data || []).map(e => ({
      ...e,
      rsvp_count: e.rsvps?.[0]?.count || 0
    }));

    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from('events')
      .select('*, communities(name, category, cover_emoji), rsvps(count)')
      .eq('id', req.params.id)
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });

    res.json({ event: { ...event, rsvp_count: event.rsvps?.[0]?.count || 0 } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/events/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('id, capacity')
      .eq('id', req.params.id)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    let status = 'attending';
    if (event.capacity) {
      const { count } = await supabase
        .from('rsvps')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', req.params.id)
        .eq('status', 'attending');

      if (count >= event.capacity) status = 'waitlist';
    }

    const { data, error } = await supabase
      .from('rsvps')
      .upsert(
        { event_id: req.params.id, user_id: req.user.id, status },
        { onConflict: 'user_id,event_id' }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ rsvp: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/events/:id/rsvp', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('rsvps')
      .update({ status: 'cancelled' })
      .eq('event_id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dashboard ───────────────────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [userRes, commRes, upcomingRes, pastRes] = await Promise.all([
      supabase.from('users').select('name, email, age, interests, instagram').eq('id', req.user.id).single(),
      supabase.from('memberships').select('communities(*)').eq('user_id', req.user.id),
      supabase.from('rsvps').select('*, events(*, communities(name, category, cover_emoji))').eq('user_id', req.user.id).in('status', ['attending', 'waitlist']),
      supabase.from('rsvps').select('*, events(*, communities(name, category, cover_emoji))').eq('user_id', req.user.id).eq('status', 'attending')
    ]);

    const upcoming = (upcomingRes.data || []).filter(r => r.events && r.events.date >= today);
    const past = (pastRes.data || []).filter(r => r.events && r.events.date < today);

    res.json({
      user: userRes.data,
      communities: (commRes.data || []).map(m => m.communities).filter(Boolean),
      upcoming_rsvps: upcoming,
      past_events: past
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Organiser Dashboard ──────────────────────────────────────────────────────
app.get('/api/organiser/dashboard', requireAuth, async (req, res) => {
  try {
    const { data: communities } = await supabase
      .from('communities')
      .select('*, memberships(count)')
      .eq('organiser_id', req.user.id);

    const communityIds = (communities || []).map(c => c.id);
    const safeIds = communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'];

    const [eventsRes, membersRes] = await Promise.all([
      supabase.from('events').select('*, rsvps(count)').in('community_id', safeIds).order('date', { ascending: true }),
      supabase.from('memberships').select('*, users(name, email, instagram)').in('community_id', safeIds)
    ]);

    res.json({
      communities: (communities || []).map(c => ({ ...c, member_count: c.memberships?.[0]?.count || 0 })),
      events: (eventsRes.data || []).map(e => ({ ...e, rsvp_count: e.rsvps?.[0]?.count || 0 })),
      members: membersRes.data || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/organiser/events/:id/attendees', requireAuth, async (req, res) => {
  try {
    const { data: event } = await supabase
      .from('events')
      .select('*, communities(organiser_id)')
      .eq('id', req.params.id)
      .single();

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.communities?.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data: attendees } = await supabase
      .from('rsvps')
      .select('*, users(name, email, instagram)')
      .eq('event_id', req.params.id)
      .neq('status', 'cancelled');

    res.json({ attendees: attendees || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Community Submission ─────────────────────────────────────────────────────
app.post('/api/communities/submit', requireAuth, async (req, res) => {
  try {
    const { name, description, category, who_its_for, whatsapp_link, instagram_link } = req.body;
    if (!name || !description || !category) {
      return res.status(400).json({ error: 'name, description and category are required' });
    }
    const valid = ['active','creative','career','wellness','social'];
    if (!valid.includes(category)) return res.status(400).json({ error: 'Invalid category' });

    const { data, error } = await supabase.from('communities').insert({
      name, description, category,
      who_its_for: who_its_for || null,
      whatsapp_link: whatsapp_link || null,
      instagram_link: instagram_link || null,
      organiser_id: req.user.id,
      status: 'pending'
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ community: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Organiser: Create Event ──────────────────────────────────────────────────
app.post('/api/organiser/events', requireAuth, async (req, res) => {
  try {
    const { community_id, title, description, date, time, location, capacity, price_rm } = req.body;
    if (!community_id || !title || !date) {
      return res.status(400).json({ error: 'community_id, title and date are required' });
    }
    // Verify organiser owns this community
    const { data: community } = await supabase.from('communities')
      .select('organiser_id').eq('id', community_id).single();
    if (!community || community.organiser_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not own this community' });
    }

    const { data, error } = await supabase.from('events').insert({
      community_id, title, description: description || null,
      date, time: time || null, location: location || null,
      capacity: capacity ? parseInt(capacity) : null,
      price_rm: price_rm ? parseInt(price_rm) : 0,
      organiser_id: req.user.id
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ event: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newJoiners } = await supabase
      .from('memberships')
      .select('user_id')
      .gte('joined_at', oneWeekAgo);

    const uniqueNewJoiners = new Set((newJoiners || []).map(j => j.user_id)).size;

    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('memberships').select('user_id').gte('joined_at', start).lt('joined_at', end);
      weeks.push({ week_start: start.split('T')[0], new_joiners: new Set((data || []).map(j => j.user_id)).size });
    }

    const { data: activeUsers } = await supabase.from('memberships').select('user_id');
    const totalActiveUsers = new Set((activeUsers || []).map(u => u.user_id)).size;

    const [{ count: totalCommunities }, { count: totalEvents }, { count: totalRsvps }] = await Promise.all([
      supabase.from('communities').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('rsvps').select('*', { count: 'exact', head: true }).neq('status', 'cancelled')
    ]);

    res.json({
      north_star: uniqueNewJoiners,
      weekly_new_joiners: weeks,
      total_active_users: totalActiveUsers,
      total_communities: totalCommunities || 0,
      total_events: totalEvents || 0,
      total_rsvps: totalRsvps || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/pending', async (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { data, error } = await supabase.from('communities')
      .select('*, users(name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ communities: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/communities/:id/approve', async (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { error } = await supabase.from('communities')
      .update({ status: 'approved' }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/communities/:id/reject', async (req, res) => {
  const key = req.query.key || req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { reason } = req.body;
    const { error } = await supabase.from('communities')
      .update({ status: 'rejected', reject_reason: reason || null }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Circles server running on http://localhost:${PORT}`);
});
