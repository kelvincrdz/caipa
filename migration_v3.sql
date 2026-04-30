-- ─── Migration v3: Visual Kits ──────────────────────────────────────────────
-- Run in Supabase SQL editor

ALTER TABLE bars ADD COLUMN IF NOT EXISTS visual_theme TEXT DEFAULT 'boteco';
