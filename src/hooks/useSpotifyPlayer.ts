import { useState, useEffect, useRef, useCallback } from 'react';
import { getValidToken } from '../services/spotifyAuth';

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

export interface SpotifyPlayerState {
  is_paused: boolean;
  uri: string;
  position: number;
  duration: number;
}

export function useSpotifyPlayer(enabled: boolean, playerName = 'Tocaí Bar') {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const initPlayer = () => {
      getValidToken().then(token => {
        if (!token) return;

        const player = new window.Spotify.Player({
          name: playerName,
          getOAuthToken: async (cb: (t: string) => void) => {
            const t = await getValidToken();
            if (t) cb(t);
          },
          volume: 0.8,
        });

        player.addListener('ready', ({ device_id }: { device_id: string }) => {
          setDeviceId(device_id);
          setIsReady(true);
        });

        player.addListener('not_ready', () => {
          setIsReady(false);
          setDeviceId(null);
        });

        player.addListener('player_state_changed', (state: any) => {
          if (!state) {
            setPlayerState(null);
            return;
          }
          setPlayerState({
            is_paused: state.paused,
            uri: state.track_window?.current_track?.uri ?? '',
            position: state.position,
            duration: state.duration,
          });
        });

        player.addListener('initialization_error', ({ message }: any) =>
          console.error('[Spotify SDK] init error:', message),
        );
        player.addListener('authentication_error', ({ message }: any) =>
          console.error('[Spotify SDK] auth error:', message),
        );
        player.addListener('account_error', ({ message }: any) =>
          console.error('[Spotify SDK] account error (Premium required):', message),
        );

        player.connect();
        playerRef.current = player;
      });
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      if (!document.querySelector('script[src*="spotify-player"]')) {
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      setIsReady(false);
      setDeviceId(null);
      setPlayerState(null);
    };
  }, [enabled, playerName]);

  const togglePlay = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const nextTrack = useCallback(() => {
    playerRef.current?.nextTrack();
  }, []);

  const prevTrack = useCallback(() => {
    playerRef.current?.previousTrack();
  }, []);

  const seek = useCallback((positionMs: number) => {
    playerRef.current?.seek(positionMs);
  }, []);

  return { deviceId, isReady, playerState, togglePlay, nextTrack, prevTrack, seek };
}
