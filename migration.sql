-- Run this in your Supabase SQL editor

-- 1. Add admin credentials to bars table
ALTER TABLE bars ADD COLUMN IF NOT EXISTS admin_password TEXT DEFAULT NULL;

-- 2. Add cooldown settings to sessions table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS max_initial_requests INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS request_cooldown_minutes INTEGER NOT NULL DEFAULT 3;

-- 3. Add music genre tags to queue items
ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
