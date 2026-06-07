-- ============================================================
-- Migration: Membership v2 — follower/member two-tier system
-- Run this in Supabase SQL Editor (safe on existing data)
-- ============================================================

-- Add membership_type to memberships
alter table public.memberships
  add column if not exists membership_type text default 'follower'
    check (membership_type in ('follower', 'member'));

alter table public.memberships
  add column if not exists upgraded_at timestamptz;

-- Existing rows (from the old /join flow) are treated as followers
-- If you want to grandfather them as members, run this instead:
-- update public.memberships set membership_type = 'member', upgraded_at = joined_at;

-- Add attended flag to rsvps
alter table public.rsvps
  add column if not exists attended boolean default false;
