require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase admin client (service key)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'placeholder-service-key';
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

async function requireOrganiser(req, res, next) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', req.user.id)
    .single();
  if (!profile || (profile.role !== 'organiser' && profile.role !== 'admin')) {
    return res.status(403).json({ error: 'Organiser access required' });
  }
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
      .select('*, community_members(count)')
      .eq('is_vetted', true)
      .order('created_at', { ascending: false });

    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const communities = data.map(c => ({
      ...c,
      member_count: c.community_members?.[0]?.count || 0
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
      .select('*, community_members(count)')
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
        member_count: community.community_members?.[0]?.count || 0
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
      .from('community_members')
      .insert({ community_id: req.params.id, user_id: req.user.id });

    if (error && error.code !== '23505') {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, whatsapp_link: community.whatsapp_link });
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

    if (req.query.category) {
      query = query.eq('communities.category', req.query.category);
    }
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
      .select('*, communities(name, category, cover_emoji, organiser_id), rsvps(count)')
      .eq('id', req.params.id)
      .single();

    if (error || !event) return res.status(404).json({ error: 'Event not found' });

    res.json({
      event: {
        ...event,
        rsvp_count: event.rsvps?.[0]?.count || 0
      }
    });
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

    // Check current RSVP count
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
        { onConflict: 'event_id,user_id' }
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

    const [commRes, upcomingRes, pastRes] = await Promise.all([
      supabase
        .from('community_members')
        .select('communities(*)')
        .eq('user_id', req.user.id),
      supabase
        .from('rsvps')
        .select('*, events(*, communities(name, category, cover_emoji))')
        .eq('user_id', req.user.id)
        .in('status', ['attending', 'waitlist'])
        .gte('events.date', today),
      supabase
        .from('rsvps')
        .select('*, events(*, communities(name, category, cover_emoji))')
        .eq('user_id', req.user.id)
        .eq('status', 'attending')
        .lt('events.date', today)
    ]);

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, interests')
      .eq('id', req.user.id)
      .single();

    res.json({
      profile,
      communities: (commRes.data || []).map(m => m.communities).filter(Boolean),
      upcoming_rsvps: (upcomingRes.data || []).filter(r => r.events),
      past_events: (pastRes.data || []).filter(r => r.events)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Organiser Dashboard ──────────────────────────────────────────────────────
app.get('/api/organiser/dashboard', requireAuth, requireOrganiser, async (req, res) => {
  try {
    const { data: communities } = await supabase
      .from('communities')
      .select('*, community_members(count)')
      .eq('organiser_id', req.user.id);

    const communityIds = (communities || []).map(c => c.id);

    const { data: events } = await supabase
      .from('events')
      .select('*, rsvps(count)')
      .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000'])
      .order('date', { ascending: true });

    const { data: members } = await supabase
      .from('community_members')
      .select('*, profiles(name, email, instagram_handle)')
      .in('community_id', communityIds.length ? communityIds : ['00000000-0000-0000-0000-000000000000']);

    res.json({
      communities: (communities || []).map(c => ({
        ...c,
        member_count: c.community_members?.[0]?.count || 0
      })),
      events: (events || []).map(e => ({
        ...e,
        rsvp_count: e.rsvps?.[0]?.count || 0
      })),
      members: members || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/organiser/events/:id/attendees', requireAuth, requireOrganiser, async (req, res) => {
  try {
    // Verify organiser owns this event's community
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
      .select('*, profiles(name, email, instagram_handle)')
      .eq('event_id', req.params.id)
      .neq('status', 'cancelled');

    res.json({ attendees: attendees || [] });
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

    // New users who joined at least 1 community this week (north star)
    const { data: newJoiners } = await supabase
      .from('community_members')
      .select('user_id')
      .gte('joined_at', oneWeekAgo);

    const uniqueNewJoiners = new Set((newJoiners || []).map(j => j.user_id)).size;

    // Weekly breakdown (last 8 weeks)
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();
      const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('community_members')
        .select('user_id')
        .gte('joined_at', start)
        .lt('joined_at', end);
      const unique = new Set((data || []).map(j => j.user_id)).size;
      weeks.push({ week_start: start.split('T')[0], new_joiners: unique });
    }

    // Total active users
    const { data: activeUsers } = await supabase
      .from('community_members')
      .select('user_id');
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
