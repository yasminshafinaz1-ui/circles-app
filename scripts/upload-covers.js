#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Run this script LOCALLY (on your machine, not in the cloud) to upload the
// 5 cover images and link them to communities in Supabase.
//
// Usage:
//   1. cd into the project root
//   2. Place your images in the same folder as this script (scripts/)
//   3. node scripts/upload-covers.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Map: image filename → community name (must match exactly)
const UPLOADS = [
  { file: 'IMG_4550.JPG', community: 'Jom Touch Grass' },
  { file: 'IMG_4549.JPG', community: 'cakepiknik' },
  { file: 'IMG_4548.JPG', community: 'KL Sketch Nation' },
  { file: 'IMG_4547.JPG', community: 'Teman Girls KL' },
  { file: 'IMG_4546.JPG', community: 'The Bloom Society' },
];

async function run() {
  console.log('Fetching communities…');
  const { data: communities, error } = await supabase
    .from('communities')
    .select('id, name');

  if (error) { console.error('Could not fetch communities:', error.message); process.exit(1); }

  const communityMap = {};
  communities.forEach(c => { communityMap[c.name.toLowerCase()] = c; });

  for (const { file, community } of UPLOADS) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  File not found: ${file} — skipping`);
      continue;
    }

    const comm = communityMap[community.toLowerCase()];
    if (!comm) {
      console.warn(`  ⚠️  Community not found: "${community}" — skipping`);
      continue;
    }

    const storagePath = `${comm.id}_cover.jpg`;
    const fileBuffer = fs.readFileSync(filePath);

    console.log(`  Uploading ${file} → community-covers/${storagePath}…`);
    const { error: upErr } = await supabase.storage
      .from('community-covers')
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (upErr) {
      console.error(`  ✗ Upload failed for ${file}:`, upErr.message);
      continue;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('community-covers')
      .getPublicUrl(storagePath);

    const { error: dbErr } = await supabase
      .from('communities')
      .update({ cover_photo: publicUrl })
      .eq('id', comm.id);

    if (dbErr) {
      console.error(`  ✗ DB update failed for ${community}:`, dbErr.message);
    } else {
      console.log(`  ✓ ${community} → ${publicUrl}`);
    }
  }

  console.log('\nDone!');
}

run().catch(e => { console.error(e); process.exit(1); });
