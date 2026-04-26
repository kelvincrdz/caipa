const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/spotify/callback`;

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

function generateVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function initiateLogin(returnPath?: string) {
  if (returnPath) sessionStorage.setItem('sp_return_path', returnPath);

  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);
  const state = generateState();

  localStorage.setItem('sp_pkce_verifier', verifier);
  localStorage.setItem('sp_oauth_state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleCallback(code: string, returnedState?: string | null): Promise<string> {
  const savedState = localStorage.getItem('sp_oauth_state');
  localStorage.removeItem('sp_oauth_state');

  if (savedState && returnedState !== undefined && savedState !== returnedState) {
    throw new Error('Falha de segurança: parâmetro state inválido. Possível ataque CSRF. Tente logar novamente.');
  }

  const verifier = localStorage.getItem('sp_pkce_verifier');
  if (!verifier) throw new Error('Verificador PKCE não encontrado. Tente logar novamente.');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);

  saveTokens(data);
  localStorage.removeItem('sp_pkce_verifier');
  return data.access_token;
}

function saveTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem('sp_access_token', data.access_token);
  if (data.refresh_token) localStorage.setItem('sp_refresh_token', data.refresh_token);
  localStorage.setItem('sp_token_expiry', String(Date.now() + data.expires_in * 1000));
}

async function doRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem('sp_refresh_token');
  if (!refresh) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    }),
  });

  const data = await res.json();
  if (data.error) {
    logout();
    return null;
  }

  saveTokens(data);
  return data.access_token;
}

// Shared token for clients — set from Supabase sessions by ClientView
let _sharedToken: string | null = null;
export function setSharedToken(token: string | null) {
  _sharedToken = token;
}

export async function getValidToken(): Promise<string | null> {
  const local = localStorage.getItem('sp_access_token');

  if (local) {
    const expiry = parseInt(localStorage.getItem('sp_token_expiry') || '0');
    if (Date.now() > expiry - 60_000) {
      return doRefresh();
    }
    return local;
  }

  return _sharedToken;
}

export interface SpotifyProfile {
  display_name: string;
  email: string;
  images: { url: string }[];
}

export async function getSpotifyProfile(): Promise<SpotifyProfile | null> {
  const token = await getValidToken();
  if (!token) return null;
  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function isAdminLoggedIn(): boolean {
  return !!localStorage.getItem('sp_access_token');
}

export function logout() {
  ['sp_access_token', 'sp_refresh_token', 'sp_token_expiry', 'sp_pkce_verifier', 'sp_oauth_state'].forEach(k =>
    localStorage.removeItem(k),
  );
}
