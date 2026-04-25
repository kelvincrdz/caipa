import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QueueItem } from '../types';
import { SessionConfig } from '../lib/sessionConfig';

function normalizeTag(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function tagMatchesTheme(tags: string[], theme: string): boolean {
  if (!theme || normalizeTag(theme) === 'livre') return false;
  const t = normalizeTag(theme);
  return tags.some(tag => {
    const nt = normalizeTag(tag);
    return nt.includes(t) || t.includes(nt);
  });
}

function sortAndNormalize(items: QueueItem[]): QueueItem[] {
  return [...items]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime();
    })
    .map((item, i) => ({ ...item, status: i === 0 ? ('playing' as const) : ('pending' as const) }));
}

export function useQueue(barSlug: string | undefined) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barSlug) { setLoading(false); return; }

    supabase
      .from('queue_items')
      .select('*')
      .eq('bar_slug', barSlug)
      .neq('status', 'played')
      .order('score', { ascending: false })
      .order('requested_at', { ascending: true })
      .then(({ data }) => {
        setQueue(sortAndNormalize((data ?? []) as QueueItem[]));
        setLoading(false);
      });

    const channel = supabase
      .channel(`queue_${barSlug}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'queue_items', filter: `bar_slug=eq.${barSlug}` },
        (payload) => setQueue(prev => sortAndNormalize([...prev, payload.new as QueueItem])),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'queue_items', filter: `bar_slug=eq.${barSlug}` },
        (payload) =>
          setQueue(prev =>
            sortAndNormalize(prev.map(item => (item.id === (payload.new as any).id ? (payload.new as QueueItem) : item))),
          ),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'queue_items', filter: `bar_slug=eq.${barSlug}` },
        (payload) =>
          setQueue(prev => sortAndNormalize(prev.filter(item => item.id !== (payload.old as any).id))),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [barSlug]);

  const addMusic = async (
    music: any,
    clientId: string,
    clientName: string,
    session: SessionConfig,
    dedicationTo?: string,
  ) => {
    const artistsBlocked = session.blocked_artists ?? [];
    const keywordsBlocked = session.blocked_keywords ?? [];

    const isBlocked =
      artistsBlocked.some(a => music.artist.toLowerCase().includes(a.toLowerCase())) ||
      keywordsBlocked.some(k => music.title.toLowerCase().includes(k.toLowerCase()));

    if (isBlocked) throw new Error('Música ou artista bloqueado nesta sessão!');

    if (session.queue_locked) throw new Error('A fila está fechada no momento. Aguarde o admin reabrir.');

    const tags: string[] = music.tags ?? [];
    const score = tagMatchesTheme(tags, session.theme ?? '') ? 1 : 0;

    const { data, error } = await supabase
      .from('queue_items')
      .insert({
        bar_slug: barSlug,
        client_name: clientName,
        client_id: clientId,
        title: music.title,
        artist: music.artist,
        thumbnail_url: music.thumb || '',
        spotify_uri: music.spotify_uri ?? null,
        preview_url: music.preview_url ?? null,
        external_urls: music.external_urls ?? null,
        tags,
        score,
        status: 'pending',
        dedication_to: dedicationTo || null,
        reactions: { fire: 0, heart: 0 },
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const vote = async (itemId: string, _clientId: string) => {
    const item = queue.find(i => i.id === itemId);
    if (!item) return;
    await supabase.from('queue_items').update({ score: item.score + 1 }).eq('id', itemId);
  };

  const superVote = async (itemId: string) => {
    const item = queue.find(i => i.id === itemId);
    if (!item) return;
    await supabase.from('queue_items').update({ score: item.score + 3 }).eq('id', itemId);
  };

  const reactToItem = async (itemId: string, reactions: { fire: number; heart: number }) => {
    await supabase.from('queue_items').update({ reactions }).eq('id', itemId);
  };

  const veto = async (itemId: string, reason?: string) => {
    const item = queue.find(i => i.id === itemId);
    await supabase.from('queue_items').update({ score: -999 }).eq('id', itemId);
    if (barSlug) {
      await supabase.from('moderation_logs').insert({
        bar_slug: barSlug,
        action: 'veto',
        item_title: item?.title ?? null,
        item_artist: item?.artist ?? null,
        client_name: item?.client_name ?? null,
        reason: reason || null,
      });
    }
  };

  const removeItem = async (itemId: string, reason?: string) => {
    const item = queue.find(i => i.id === itemId);
    await supabase.from('queue_items').delete().eq('id', itemId);
    if (barSlug) {
      await supabase.from('moderation_logs').insert({
        bar_slug: barSlug,
        action: 'remove',
        item_title: item?.title ?? null,
        item_artist: item?.artist ?? null,
        client_name: item?.client_name ?? null,
        reason: reason || null,
      });
    }
  };

  const jumpToTop = async (itemId: string) => {
    const maxScore = queue.reduce((max, i) => Math.max(max, i.score), 0) + 100;
    await supabase.from('queue_items').update({ score: maxScore }).eq('id', itemId);
  };

  const advanceQueue = async () => {
    if (queue.length === 0) return;
    await supabase.from('queue_items').delete().eq('id', queue[0].id);
  };

  return { queue, loading, addMusic, vote, superVote, reactToItem, veto, removeItem, jumpToTop, advanceQueue };
}
