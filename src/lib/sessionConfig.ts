export interface SessionConfig {
  theme: string;
  blocked_artists: string[];
  blocked_keywords: string[];
  max_initial_requests: number;
  request_cooldown_minutes: number;
  spotify_token?: string;
  spotify_device_name?: string;
}

export const DEFAULT_CONFIG: SessionConfig = {
  theme: 'Livre',
  blocked_artists: [],
  blocked_keywords: [],
  max_initial_requests: 5,
  request_cooldown_minutes: 3,
};
