import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { SessionConfig, DEFAULT_CONFIG } from '../lib/sessionConfig';

export function useSession(barSlug: string | undefined) {
  const [session, setSession] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  function mapRow(d: any): SessionConfig {
    return {
      theme: d.theme,
      blocked_artists: d.blocked_artists ?? [],
      blocked_keywords: d.blocked_keywords ?? [],
      max_initial_requests: d.max_initial_requests ?? 5,
      request_cooldown_minutes: d.request_cooldown_minutes ?? 3,
      spotify_token: d.spotify_token ?? undefined,
      spotify_device_name: d.spotify_device_name ?? undefined,
    };
  }

  useEffect(() => {
    if (!barSlug) return;

    supabase
      .from('sessions')
      .select('*')
      .eq('bar_slug', barSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSession(mapRow(data));
        setLoading(false);
      });

    const channel = supabase
      .channel(`session_${barSlug}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `bar_slug=eq.${barSlug}` },
        (payload) => setSession(mapRow(payload.new)),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [barSlug]);

  const updateSession = useCallback(async (patch: Partial<SessionConfig>) => {
    if (!barSlug) return;
    const updated = { ...session, ...patch };
    setSession(updated);
    await supabase.from('sessions').upsert(
      { bar_slug: barSlug, ...updated, updated_at: new Date().toISOString() },
      { onConflict: 'bar_slug' },
    );
  }, [barSlug, session]);

  return { session, loading, updateSession };
}
