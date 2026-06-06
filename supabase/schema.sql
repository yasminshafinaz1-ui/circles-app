-- ============================================================
-- Circles — Supabase Schema
-- ============================================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  age integer,
  interests text[] default '{}',
  instagram_handle text,
  role text default 'user' check (role in ('user', 'organiser', 'admin')),
  created_at timestamptz default now()
);

-- Communities
create table public.communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  category text not null check (category in ('active', 'creative', 'career', 'wellness', 'social')),
  cover_emoji text default '🌟',
  who_gender text default 'All genders',
  who_age_min integer default 18,
  who_age_max integer default 45,
  who_vibe text,
  whatsapp_link text,
  organiser_id uuid references public.profiles(id),
  is_vetted boolean default false,
  created_at timestamptz default now()
);

-- Community Members
create table public.community_members (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(community_id, user_id)
);

-- Events
create table public.events (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade,
  organiser_id uuid references public.profiles(id),
  title text not null,
  description text,
  date date not null,
  time_start time,
  time_end time,
  location text,
  capacity integer,
  price_rm integer default 0,
  created_at timestamptz default now()
);

-- RSVPs
create table public.rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text default 'attending' check (status in ('attending', 'waitlist', 'cancelled')),
  rsvp_at timestamptz default now(),
  unique(event_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;

-- Profiles
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Service role can do everything on profiles"
  on public.profiles for all
  using (true)
  with check (true);

-- Communities
create policy "Anyone can read vetted communities"
  on public.communities for select
  using (is_vetted = true);

create policy "Organisers can update their own communities"
  on public.communities for update
  using (auth.uid() = organiser_id);

create policy "Organisers can insert communities"
  on public.communities for insert
  with check (auth.uid() = organiser_id);

-- Community Members
create policy "Anyone can read community members"
  on public.community_members for select
  using (true);

create policy "Users can join communities"
  on public.community_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave communities"
  on public.community_members for delete
  using (auth.uid() = user_id);

-- Events
create policy "Anyone can read events"
  on public.events for select
  using (true);

create policy "Organisers can insert events"
  on public.events for insert
  with check (auth.uid() = organiser_id);

create policy "Organisers can update their own events"
  on public.events for update
  using (auth.uid() = organiser_id);

-- RSVPs
create policy "Users can read their own RSVPs"
  on public.rsvps for select
  using (auth.uid() = user_id);

create policy "Users can RSVP"
  on public.rsvps for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own RSVPs"
  on public.rsvps for update
  using (auth.uid() = user_id);

create policy "Organisers can read RSVPs for their events"
  on public.rsvps for select
  using (
    exists (
      select 1 from public.events e
      join public.communities c on c.id = e.community_id
      where e.id = rsvps.event_id
        and c.organiser_id = auth.uid()
    )
  );

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
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
-- Seed Data
-- ============================================================

-- Communities (fixed UUIDs)
insert into public.communities (id, name, description, category, cover_emoji, who_gender, who_age_min, who_age_max, who_vibe, whatsapp_link, is_vetted) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Teman Girls KL',
  'A warm, judgment-free community for women navigating life in KL. From brunch meetups to career advice sessions — we do it all together.',
  'social',
  '💛',
  'Women only',
  20,
  35,
  'supportive, chill, real talk',
  'https://chat.whatsapp.com/example1',
  true
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Jom Touch Grass',
  'Weekend hikers, trail runners, and anyone who wants to get off their sofa and into nature. KL''s friendliest outdoor crew.',
  'active',
  '🌿',
  'All genders',
  18,
  40,
  'adventurous, low-ego, endorphin-addicted',
  'https://chat.whatsapp.com/example2',
  true
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'KL Sketch Nation',
  'Urban sketchers, doodlers, and visual storytellers. We meet weekly at different KL spots to draw the city around us.',
  'creative',
  '✏️',
  'All genders',
  18,
  45,
  'creative, observant, coffee-fuelled',
  'https://chat.whatsapp.com/example3',
  true
),
(
  'a1b2c3d4-0004-0004-0004-000000000004',
  'Hustle Honeys',
  'Female founders, side-hustlers, and career-driven women sharing resources, referrals, and real talk about building in Malaysia.',
  'career',
  '🚀',
  'Women only',
  22,
  38,
  'ambitious, collaborative, no-BS',
  'https://chat.whatsapp.com/example4',
  true
),
(
  'a1b2c3d4-0005-0005-0005-000000000005',
  'The Bloom Society',
  'Holistic wellness for the modern Malaysian woman. Yoga, sound healing, journaling workshops, and everything in between.',
  'wellness',
  '🌸',
  'Women only',
  21,
  40,
  'mindful, grounded, growth-oriented',
  'https://chat.whatsapp.com/example5',
  true
),
(
  'a1b2c3d4-0006-0006-0006-000000000006',
  'cakepiknik',
  'Spontaneous picnics, potluck gatherings, and slow afternoons in the park. Food lovers who believe life''s too short for sad lunch breaks.',
  'social',
  '🧺',
  'All genders',
  18,
  35,
  'laid-back, foodie, spontaneous',
  'https://chat.whatsapp.com/example6',
  true
);

-- Events (fixed UUIDs, near-future dates)
insert into public.events (id, community_id, title, description, date, time_start, time_end, location, capacity, price_rm) values
(
  'e1e2e3e4-0001-0001-0001-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Pottery Workshop: Make Your Own Mug',
  'A hands-on pottery session in Bangsar. No experience needed — just show up, get your hands dirty, and leave with a mug you made yourself.',
  (current_date + interval '5 days')::date,
  '14:00',
  '17:00',
  'Studio Clay, Bangsar, KL',
  16,
  65
),
(
  'e1e2e3e4-0002-0002-0002-000000000002',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Sunday Trail Run — Bukit Kiara',
  'Easy to moderate trail run through Bukit Kiara. 7km loop, suitable for beginners. We run together, no one left behind.',
  (current_date + interval '3 days')::date,
  '07:00',
  '10:00',
  'Bukit Kiara, Taman Tun Dr Ismail, KL',
  30,
  0
),
(
  'e1e2e3e4-0003-0003-0003-000000000003',
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Urban Sketch Session: Masjid India',
  'Join us for a morning of sketching in the vibrant streets of Masjid India. Bring your own supplies or borrow from us.',
  (current_date + interval '7 days')::date,
  '09:00',
  '12:00',
  'Masjid India, Kuala Lumpur',
  20,
  0
),
(
  'e1e2e3e4-0004-0004-0004-000000000004',
  'a1b2c3d4-0004-0004-0004-000000000004',
  'Hustle Honeys Monthly Mixer',
  'Our signature monthly networking mixer. Pitch your project, swap contacts, or just come to be inspired by KL''s most driven women.',
  (current_date + interval '10 days')::date,
  '19:00',
  '22:00',
  'WORQ, Uptown Damansara, PJ',
  50,
  25
),
(
  'e1e2e3e4-0005-0005-0005-000000000005',
  'a1b2c3d4-0005-0005-0005-000000000005',
  'Sound Bath + Journaling Circle',
  'A deeply restorative evening of sound healing with crystal singing bowls, followed by a guided journaling session. Come as you are.',
  (current_date + interval '14 days')::date,
  '19:30',
  '21:30',
  'The Hive Wellness Studio, Petaling Jaya',
  20,
  45
);
