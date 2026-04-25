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
  localStorage.setItem('sp_pkce_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleCallback(code: string): Promise<string> {
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

// Shared token for clients (set from Supabase sessions by ClientView)
let _sharedToken: string | null = null;
export function setSharedToken(token: string | null) {
  _sharedToken = token;
}

export async function getValidToken(): Promise<string | null> {
  const local = localStorage.getItem('sp_access_token');

  if (local) {
    const expiry = parseInt(localStorage.getItem('sp_token_expiry') || '0');
    // Refresh 60s before expiry
    if (Date.now() > expiry - 60_000) {
      return doRefresh();
    }
    return local;
  }

  return _sharedToken;
}

export function isAdminLoggedIn(): boolean {
  return !!localStorage.getItem('sp_access_token');
}

export function logout() {
  ['sp_access_token', 'sp_refresh_token', 'sp_token_expiry', 'sp_pkce_verifier'].forEach(k =>
    localStorage.removeItem(k),
  );
}
