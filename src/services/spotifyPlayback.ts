import { getValidToken } from './spotifyAuth';

const API = 'https://api.spotify.com/v1';

async function call(endpoint: string, method = 'GET', body?: unknown) {
  const token = await getValidToken();
  if (!token) throw new Error('Spotify não autenticado');
  const res = await fetch(`${API}/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 202 || res.status === 200 && res.headers.get('content-length') === '0') return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const data = await call('me/player/devices');
  return (data?.devices ?? []) as SpotifyDevice[];
}

export async function transferPlayback(deviceId: string, play = false) {
  return call('me/player', 'PUT', { device_ids: [deviceId], play });
}

export async function play(uri: string, deviceId: string) {
  return call(`me/player/play?device_id=${encodeURIComponent(deviceId)}`, 'PUT', { uris: [uri] });
}

export async function pause(deviceId: string) {
  return call(`me/player/pause?device_id=${encodeURIComponent(deviceId)}`, 'PUT');
}

export async function resume(deviceId: string) {
  return call(`me/player/play?device_id=${encodeURIComponent(deviceId)}`, 'PUT');
}

export async function skipNext(deviceId: string) {
  return call(`me/player/next?device_id=${encodeURIComponent(deviceId)}`, 'POST');
}

export async function addToQueue(uri: string, deviceId: string) {
  return call(
    `me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${encodeURIComponent(deviceId)}`,
    'POST',
  );
}

export async function getCurrentlyPlaying() {
  return call('me/player/currently-playing');
}

export async function setVolume(volumePercent: number, deviceId: string) {
  return call(
    `me/player/volume?volume_percent=${volumePercent}&device_id=${encodeURIComponent(deviceId)}`,
    'PUT',
  );
}
