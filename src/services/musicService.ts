import { getValidToken } from './spotifyAuth';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const LFM_KEY = import.meta.env.VITE_LASTFM_API_KEY || '29191de8f39b768b9386942de00f673d';

async function fetchSpotify(endpoint: string) {
  const token = await getValidToken();
  if (!token) throw new Error('Spotify não autenticado. Faça login no painel do admin.');
  const res = await fetch(`${SPOTIFY_API_URL}/${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function searchMusic(query: string) {
  try {
    const data = await fetchSpotify(
      `search?q=${encodeURIComponent(query)}&type=track&limit=8`,
    );
    if (data.error) throw new Error(data.error.message);
    return data.tracks.items.map((item: any) => ({
      id: item.id,
      spotify_uri: item.uri,
      title: item.name,
      artist: item.artists.map((a: any) => a.name).join(', '),
      thumb: item.album.images[1]?.url || item.album.images[0]?.url || '',
      preview_url: item.preview_url,
      external_urls: item.external_urls,
    }));
  } catch (e) {
    console.error('Spotify search error:', e);
    return [];
  }
}

export async function getTrackInfo(artist: string, track: string) {
  if (!LFM_KEY) return { tags: [], genres: [] };
  try {
    const res = await fetch(
      `${LASTFM_API_URL}?method=track.getInfo&api_key=${LFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json`,
    );
    const data = await res.json();
    const tags = data.track?.toptags?.tag?.map((t: any) => t.name) || [];
    return { tags, genres: tags };
  } catch {
    return { tags: [], genres: [] };
  }
}

export async function getSimilarTracks(artist: string, track: string) {
  if (!LFM_KEY) return [];
  try {
    const res = await fetch(
      `${LASTFM_API_URL}?method=track.getSimilar&api_key=${LFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&limit=3&format=json`,
    );
    const data = await res.json();
    return (
      data.similartracks?.track?.map((t: any) => ({
        title: t.name,
        artist: t.artist.name,
      })) || []
    );
  } catch {
    return [];
  }
}
