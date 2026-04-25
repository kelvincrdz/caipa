export interface SessionConfig {
  theme: string;
  blocked_artists: string[];
  blocked_keywords: string[];
  spotify_token?: string;
  spotify_device_name?: string;
}

export const DEFAULT_CONFIG: SessionConfig = {
  theme: 'Livre',
  blocked_artists: [],
  blocked_keywords: [],
};
