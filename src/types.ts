export interface Bar {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme?: string;
  owner_id?: string;
}

export interface Session {
  id: string;
  bar_id: string;
  theme: string;
  is_active: boolean;
  allowed_genres: string[];
  max_requests_per_user: number;
  spotify_token?: string;
  spotify_device_name?: string;
}

export interface QueueItem {
  id: string;
  session_id: string;
  client_name: string;
  client_id: string;
  spotify_uri?: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  score: number;
  status: 'pending' | 'playing' | 'played';
  requested_at: any;
  preview_url?: string;
  external_urls?: any;
  tags?: string[];
}

export interface MusicTrack {
  id: string;
  spotify_uri?: string;
  title: string;
  artist: string;
  thumb: string;
  preview_url?: string;
  external_urls?: any;
  tags?: string[];
}

export interface Client {
  id: string;
  phone: string;
  display_name: string;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface ImportMetaEnv {
    readonly VITE_SPOTIFY_CLIENT_ID: string;
    readonly VITE_LASTFM_API_KEY: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_SUPERADMIN_PASSWORD: string;
  }
}
