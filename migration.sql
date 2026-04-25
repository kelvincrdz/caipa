-- Run this in your Supabase SQL editor

-- 1. Add admin credentials to bars table
ALTER TABLE bars ADD COLUMN IF NOT EXISTS admin_password TEXT DEFAULT NULL;

-- 2. Add cooldown settings to sessions table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS max_initial_requests INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS request_cooldown_minutes INTEGER NOT NULL DEFAULT 3;

-- 3. Add music genre tags to queue items
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 4. Fila bloqueada & dedicatórias (em sessions)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS queue_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS enable_dedications BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Dedicatória & reações (em queue_items)
ALTER TABLE queue_items
  ADD COLUMN IF NOT EXISTS dedication_to TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{"fire": 0, "heart": 0}'::jsonb;

-- 6. Log de moderação
CREATE TABLE IF NOT EXISTS moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_slug TEXT NOT NULL,
  action TEXT NOT NULL,
  item_title TEXT,
  item_artist TEXT,
  client_name TEXT,
  reason TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tema customizável por bar
ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS theme_primary TEXT DEFAULT '#336580',
  ADD COLUMN IF NOT EXISTS theme_accent  TEXT DEFAULT '#D1DC5A';
