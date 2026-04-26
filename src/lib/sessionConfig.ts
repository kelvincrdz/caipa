export interface SessionConfig {
  theme: string;
  blocked_artists: string[];
  blocked_keywords: string[];
  max_initial_requests: number;
  request_cooldown_minutes: number;
  spotify_token?: string;
  spotify_device_name?: string;
  queue_locked?: boolean;
  enable_dedications?: boolean;
  photo_display_mode?: 'none' | 'slideshow' | 'background';
  photo_auto_approve?: boolean;
  auto_queue_enabled?: boolean;
}

export const DEFAULT_CONFIG: SessionConfig = {
  theme: 'Livre',
  blocked_artists: [],
  blocked_keywords: [],
  max_initial_requests: 5,
  request_cooldown_minutes: 3,
  queue_locked: false,
  enable_dedications: false,
  photo_display_mode: 'none',
  photo_auto_approve: false,
  auto_queue_enabled: true,
};
