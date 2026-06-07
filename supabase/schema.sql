-- ============================================================
-- Circles — Schema (Week 1 Foundation)
-- Run the RESET block first if tables already exist
-- ============================================================

-- ============================================================
-- STEP 1: RESET (run this block first if you get "already exists")
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.rsvps cascade;
drop table if exists public.memberships cascade;
drop table if exists public.community_members cascade;
drop table if exists public.events cascade;
drop table if exists public.communities cascade;
drop table if exists public.users cascade;
drop table if exists public.profiles cascade;

-- ============================================================
-- STEP 2: CREATE TABLES
-- ============================================================

create table public.users (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  age integer,
  interests text[] default '{}',
  instagram text,
  created_at timestamptz default now()
);

create table public.communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  category text not null check (category in ('active', 'creative', 'career', 'wellness', 'social')),
  cover_photo text,
  cover_emoji text default '🌟',
  who_its_for text,
  whatsapp_link text,
  instagram_link text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  organiser_id uuid references public.users(id),
  created_at timestamptz default now()
);

create table public.events (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade,
  title text not null,
  date date not null,
  time text,
  location text,
  description text,
  capacity integer,
  price_rm integer default 0,
  created_at timestamptz default now()
);

create table public.rsvps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  status text default 'attending' check (status in ('attending', 'waitlist', 'cancelled')),
  attended boolean default false,
  promoted_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);

create table public.memberships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  membership_type text default 'follower' check (membership_type in ('follower', 'member')),
  joined_at timestamptz default now(),
  upgraded_at timestamptz,
  unique(user_id, community_id)
);

-- ============================================================
-- STEP 3: ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.communities enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.memberships enable row level security;

-- users
create policy "Users can read own record" on public.users for select using (auth.uid() = id);
create policy "Users can update own record" on public.users for update using (auth.uid() = id);
create policy "Service role full access to users" on public.users for all using (true) with check (true);

-- communities
create policy "Anyone can read approved communities" on public.communities for select using (status = 'approved');
create policy "Organisers can manage own communities" on public.communities for all using (auth.uid() = organiser_id) with check (auth.uid() = organiser_id);
create policy "Service role full access to communities" on public.communities for all using (true) with check (true);

-- events
create policy "Anyone can read events" on public.events for select using (true);
create policy "Service role full access to events" on public.events for all using (true) with check (true);

-- rsvps
create policy "Users can manage own RSVPs" on public.rsvps for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Service role full access to rsvps" on public.rsvps for all using (true) with check (true);

-- memberships
create policy "Anyone can read memberships" on public.memberships for select using (true);
create policy "Users can manage own memberships" on public.memberships for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Service role full access to memberships" on public.memberships for all using (true) with check (true);

-- ============================================================
-- STEP 4: TRIGGER — auto-create user row on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STEP 5: SEED DATA — 6 communities + 5 events
-- ============================================================

insert into public.communities (id, name, description, category, cover_emoji, who_its_for, whatsapp_link, status) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Teman Girls KL',
  'A warm, judgment-free community for women navigating life in KL. Brunch meetups, workshops, hikes and more.',
  'social', '💛', 'Women only · Ages 20–35 · Supportive & chill',
  'https://chat.whatsapp.com/example1', 'approved'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Jom Touch Grass',
  'Weekend hikers, trail runners, and anyone who wants to get off their sofa and into nature.',
  'active', '🌿', 'All genders · Ages 18–40 · Adventurous & low-ego',
  'https://chat.whatsapp.com/example2', 'approved'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'KL Sketch Nation',
  'Urban sketchers, doodlers, and visual storytellers. We meet weekly at different KL spots to draw the city.',
  'creative', '✏️', 'All genders · Ages 18–45 · Creative & coffee-fuelled',
  'https://chat.whatsapp.com/example3', 'approved'
),
(
  'a1b2c3d4-0004-0004-0004-000000000004',
  'Hustle Honeys',
  'Female founders, side-hustlers, and career-driven women sharing resources, referrals, and real talk.',
  'career', '🚀', 'Women only · Ages 22–38 · Ambitious & collaborative',
  'https://chat.whatsapp.com/example4', 'approved'
),
(
  'a1b2c3d4-0005-0005-0005-000000000005',
  'The Bloom Society',
  'Holistic wellness for the modern Malaysian woman. Yoga, sound healing, journaling workshops and more.',
  'wellness', '🌸', 'Women only · Ages 21–40 · Mindful & growth-oriented',
  'https://chat.whatsapp.com/example5', 'approved'
),
(
  'a1b2c3d4-0006-0006-0006-000000000006',
  'cakepiknik',
  'Spontaneous picnics, potluck gatherings, and slow afternoons in the park. Life is too short for sad lunches.',
  'social', '🧺', 'All genders · Ages 18–35 · Laid-back & foodie',
  'https://chat.whatsapp.com/example6', 'approved'
);

insert into public.events (id, community_id, title, date, time, location, description, capacity, price_rm) values
(
  'e1e2e3e4-0001-0001-0001-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Pottery Workshop: Make Your Own Mug',
  (current_date + interval '5 days')::date,
  '2:00 PM – 5:00 PM',
  'Studio Clay, Bangsar, KL',
  'Hands-on pottery session. No experience needed — show up, get your hands dirty, leave with a mug.',
  16, 65
),
(
  'e1e2e3e4-0002-0002-0002-000000000002',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Sunday Trail Run — Bukit Kiara',
  (current_date + interval '3 days')::date,
  '7:00 AM – 10:00 AM',
  'Bukit Kiara, Taman Tun Dr Ismail, KL',
  'Easy to moderate 7km trail run. Suitable for beginners. We run together, no one left behind.',
  30, 0
),
(
  'e1e2e3e4-0003-0003-0003-000000000003',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Urban Sketch Session: Masjid India',
  (current_date + interval '7 days')::date,
  '9:00 AM – 12:00 PM',
  'Masjid India, Kuala Lumpur',
  'Morning of sketching in the vibrant streets of Masjid India. Bring your own supplies or borrow from us.',
  20, 0
),
(
  'e1e2e3e4-0004-0004-0004-000000000004',
  'a1b2c3d4-0004-0004-0004-000000000004',
  'Hustle Honeys Monthly Mixer',
  (current_date + interval '10 days')::date,
  '7:00 PM – 10:00 PM',
  'WORQ, Uptown Damansara, PJ',
  'Monthly networking mixer. Pitch your project, swap contacts, or just come to be inspired.',
  50, 25
),
(
  'e1e2e3e4-0005-0005-0005-000000000005',
  'a1b2c3d4-0005-0005-0005-000000000005',
  'Sound Bath + Journaling Circle',
  (current_date + interval '14 days')::date,
  '7:30 PM – 9:30 PM',
  'The Hive Wellness Studio, Petaling Jaya',
  'Restorative evening of sound healing with crystal singing bowls, followed by guided journaling.',
  20, 45
);
