-- ─── Migration v2: Bar Profile, Fotos da Noite, Auto-fila ───────────────────
-- Run in Supabase SQL editor

-- Feature 1: Bar Profile campos extras
ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS address      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lat          DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng          DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS whatsapp     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instagram    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS music_style  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_charge TEXT DEFAULT NULL;

-- Feature 3: Fotos da Noite
CREATE TABLE IF NOT EXISTS bar_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_slug      TEXT NOT NULL,
  photo_url     TEXT NOT NULL,
  caption       TEXT DEFAULT NULL,
  uploader_name TEXT DEFAULT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bar_photos_slug_status_idx ON bar_photos(bar_slug, status);
CREATE INDEX IF NOT EXISTS bar_photos_created_idx ON bar_photos(created_at);

-- Feature 3+4: Novos campos em sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS photo_display_mode  TEXT NOT NULL DEFAULT 'none', -- none | slideshow | background
  ADD COLUMN IF NOT EXISTS photo_auto_approve  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_queue_enabled  BOOLEAN NOT NULL DEFAULT TRUE;

-- Supabase Storage: criar bucket "photos" (público)
-- Execute no dashboard: Storage > New bucket > "photos" > Public = true
-- Ou via SQL (requer extensão pgcrypto):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true) ON CONFLICT DO NOTHING;

-- RLS para bar_photos (opcional mas recomendado):
-- ALTER TABLE bar_photos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Anyone can insert photos" ON bar_photos FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Anyone can read approved photos" ON bar_photos FOR SELECT USING (status = 'approved');
-- CREATE POLICY "Anyone can read all photos" ON bar_photos FOR SELECT USING (true);
