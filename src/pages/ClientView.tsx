import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Music, ThumbsUp, Check, X, Sparkles, ExternalLink, Clock,
  Smartphone, Info, Tag, Heart, Star, History, Zap, Play, Pause, Camera,
} from "lucide-react";
import { searchMusic, getSimilarTracks, getTrackInfo } from "../services/musicService";
import { useQueue, tagMatchesTheme } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { setSharedToken } from "../services/spotifyAuth";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { OverflowMarquee } from "../components/OverflowMarquee";

// ── Tag normalization ────────────────────────────────────────────────────────
function normalizeTag(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Theme accents ────────────────────────────────────────────────────────────
type ThemeAccent = { title: string; badge: string };
const THEME_ACCENTS: Record<string, ThemeAccent> = {
  samba:  { title: "text-green-400",   badge: "bg-green-700"   },
  mpb:    { title: "text-violet-400",  badge: "bg-violet-700"  },
  "forró":{ title: "text-orange-400",  badge: "bg-orange-700"  },
  forro:  { title: "text-orange-400",  badge: "bg-orange-700"  },
  pagode: { title: "text-emerald-400", badge: "bg-emerald-700" },
  axé:    { title: "text-amber-400",   badge: "bg-amber-700"   },
  axe:    { title: "text-amber-400",   badge: "bg-amber-700"   },
  rock:   { title: "text-red-400",     badge: "bg-red-700"     },
  funk:   { title: "text-pink-400",    badge: "bg-pink-700"    },
};
const DEFAULT_ACCENT: ThemeAccent = { title: "text-brand-blue", badge: "bg-brand-blue/30" };
function getThemeAccent(theme: string): ThemeAccent {
  return THEME_ACCENTS[theme?.toLowerCase?.()] ?? DEFAULT_ACCENT;
}

// ── Daily request count ──────────────────────────────────────────────────────
function getRequestCount(slug: string, phone: string): number {
  const today = new Date().toISOString().split("T")[0];
  return parseInt(localStorage.getItem(`caipa_reqs_${slug}_${phone}_${today}`) || "0");
}
function incrementRequestCount(slug: string, phone: string) {
  const today = new Date().toISOString().split("T")[0];
  const key = `caipa_reqs_${slug}_${phone}_${today}`;
  localStorage.setItem(key, String(parseInt(localStorage.getItem(key) || "0") + 1));
}
function getLastRequestTime(slug: string, phone: string): number {
  const today = new Date().toISOString().split("T")[0];
  return parseInt(localStorage.getItem(`caipa_last_req_${slug}_${phone}_${today}`) || "0");
}
function setLastRequestTime(slug: string, phone: string) {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(`caipa_last_req_${slug}_${phone}_${today}`, String(Date.now()));
}

// ── Persistent badge ─────────────────────────────────────────────────────────
function getTotalRequests(phone: string): number {
  return parseInt(localStorage.getItem(`caipa_total_${phone}`) || "0");
}
function incrementTotalRequests(phone: string) {
  localStorage.setItem(`caipa_total_${phone}`, String(getTotalRequests(phone) + 1));
}
function getUserBadge(total: number): string {
  if (total === 0) return "Cliente";
  if (total <= 10) return "De Casa";
  return "Frequentador";
}

// ── Favorites ────────────────────────────────────────────────────────────────
function getFavorites(): any[] {
  return JSON.parse(localStorage.getItem("caipa_favorites") || "[]");
}
function toggleFavorite(track: any): boolean {
  const favs = getFavorites();
  const idx = favs.findIndex((f: any) => f.id === track.id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem("caipa_favorites", JSON.stringify(favs));
    return false;
  } else {
    const entry = { id: track.id, title: track.title, artist: track.artist, thumb: track.thumb, preview_url: track.preview_url, spotify_uri: track.spotify_uri, external_urls: track.external_urls };
    localStorage.setItem("caipa_favorites", JSON.stringify([entry, ...favs].slice(0, 30)));
    return true;
  }
}
function isFavorite(trackId: string): boolean {
  return getFavorites().some((f: any) => f.id === trackId);
}

// ── History ──────────────────────────────────────────────────────────────────
function getHistory(phone: string): any[] {
  return JSON.parse(localStorage.getItem(`caipa_history_${phone}`) || "[]");
}
function addToHistory(phone: string, track: any) {
  const hist = getHistory(phone).filter((h: any) => h.id !== track.id).slice(0, 19);
  localStorage.setItem(`caipa_history_${phone}`, JSON.stringify([{ ...track, requestedAt: Date.now() }, ...hist]));
}

// ── Super vote ───────────────────────────────────────────────────────────────
function hasSuperVote(phone: string): boolean {
  const today = new Date().toISOString().split("T")[0];
  return localStorage.getItem(`caipa_sv_${phone}_${today}`) !== "true";
}
function consumeSuperVote(phone: string) {
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(`caipa_sv_${phone}_${today}`, "true");
}

// ── Reactions ────────────────────────────────────────────────────────────────
function getMyReaction(phone: string, itemId: string): 'fire' | 'heart' | null {
  return (localStorage.getItem(`caipa_rx_${phone}_${itemId}`) as any) || null;
}
function setMyReaction(phone: string, itemId: string, type: 'fire' | 'heart' | null) {
  const key = `caipa_rx_${phone}_${itemId}`;
  if (!type) localStorage.removeItem(key);
  else localStorage.setItem(key, type);
}

// ── TabBtn ───────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-1.5 font-display text-sm sm:text-base uppercase tracking-tight border-4 transition-all",
        active
          ? "border-brand-blue bg-brand-lime text-brand-cream shadow-[3px_3px_0px_var(--color-brand-blue)] translate-x-[-1px] translate-y-[-1px]"
          : "border-transparent text-brand-blue/50 hover:text-brand-blue",
      )}
    >
      {children}
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ClientView() {
  const { slug } = useParams<{ slug: string }>();

  // ── Identity (per-slug) ──────────────────────────────────────────────────
  const [phone, setPhone] = useState<string | null>(() => localStorage.getItem(`caipa_phone_${slug}`));
  const [clientName, setClientName] = useState<string | null>(() => localStorage.getItem(`caipa_name_${slug}`));
  const [showIdentify, setShowIdentify] = useState(!localStorage.getItem(`caipa_phone_${slug}`));

  // ── Bar status ───────────────────────────────────────────────────────────
  const [barStatus, setBarStatus] = useState<"loading" | "approved" | "pending" | "not_found">("loading");
  const [barLogo, setBarLogo] = useState<string | null>(null);
  const [barName, setBarName] = useState<string>("");

  // ── Search ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // ── Track tags ────────────────────────────────────────────────────────────
  const [openTagId, setOpenTagId] = useState<string | null>(null);
  const [trackTagsCache, setTrackTagsCache] = useState<Record<string, { loading: boolean; tags: string[] }>>({});

  // ── Suggested ────────────────────────────────────────────────────────────
  const [suggested, setSuggested] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [votedItems, setVotedItems] = useState<Set<string>>(new Set());

  // ── Request limits ───────────────────────────────────────────────────────
  const [requestCount, setRequestCount] = useState(0);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);

  // ── Queue tabs / favorites / history ────────────────────────────────────
  const [queueTab, setQueueTab] = useState<"queue" | "favorites" | "history">("queue");
  const [favorites, setFavorites] = useState<any[]>(() => getFavorites());
  const [history, setHistory] = useState<any[]>([]);
  const [totalRequests, setTotalRequests] = useState(0);

  // ── Preview audio ─────────────────────────────────────────────────────────
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  // ── Super vote ────────────────────────────────────────────────────────────
  const [superVoteAvail, setSuperVoteAvail] = useState(false);
  const [superVotedItems, setSuperVotedItems] = useState<Set<string>>(new Set());

  // ── Reactions ─────────────────────────────────────────────────────────────
  const [reactMap, setReactMap] = useState<Record<string, 'fire' | 'heart' | null>>({});

  // ── Dedication modal ──────────────────────────────────────────────────────
  const [pendingTrack, setPendingTrack] = useState<any | null>(null);
  const [dedText, setDedText] = useState("");

  // ── Photo upload ──────────────────────────────────────────────────────────
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSent, setPhotoSent] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Approved photos ───────────────────────────────────────────────────────
  const [approvedPhotos, setApprovedPhotos] = useState<any[]>([]);
  const [carouselIdx, setCarouselIdx] = useState(0);

  // ── Notification toasts ───────────────────────────────────────────────────
  const [notifToast, setNotifToast] = useState<null | "playing" | "next">(null);
  const prevNowIdRef = useRef<string | null>(null);
  const prevNextIdRef = useRef<string | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { session } = useSession(barStatus === "approved" ? slug : undefined);
  const { queue, addMusic, vote, superVote, reactToItem } = useQueue(barStatus === "approved" ? slug : undefined);

  const PHOTO_COOLDOWN_MS = 60_000;

  // ── Bar approval check + logo + name ────────────────────────────────────
  useEffect(() => {
    if (!slug) { setBarStatus("not_found"); return; }
    supabase
      .from("bars")
      .select("is_approved,theme_primary,theme_accent,logo_url,name")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setBarStatus("not_found"); return; }
        if (data.is_approved) setBarStatus("approved");
        else setBarStatus("pending");
        if (data.theme_primary) document.documentElement.style.setProperty("--color-brand-blue", data.theme_primary);
        if (data.theme_accent) document.documentElement.style.setProperty("--color-brand-lime", data.theme_accent);
        if (data.logo_url) setBarLogo(data.logo_url);
        if (data.name) setBarName(data.name);
      });
  }, [slug]);

  // ── Approved photos ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    supabase.from("bar_photos").select("*").eq("bar_slug", slug).eq("status", "approved").order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setApprovedPhotos(data ?? []));

    const ch = supabase.channel(`client_photos_${slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bar_photos", filter: `bar_slug=eq.${slug}` },
        (payload) => { const p = payload.new as any; if (p.status === "approved") setApprovedPhotos(prev => [p, ...prev]); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bar_photos", filter: `bar_slug=eq.${slug}` },
        (payload) => {
          const p = payload.new as any;
          if (p.status === "approved") setApprovedPhotos(prev => { const exists = prev.find((x: any) => x.id === p.id); return exists ? prev.map((x: any) => x.id === p.id ? p : x) : [p, ...prev]; });
          else setApprovedPhotos(prev => prev.filter((x: any) => x.id !== p.id));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  // ── Carousel auto-advance ────────────────────────────────────────────────
  useEffect(() => {
    if (approvedPhotos.length < 2) return;
    const t = setInterval(() => setCarouselIdx(i => (i + 1) % approvedPhotos.length), 5000);
    return () => clearInterval(t);
  }, [approvedPhotos.length]);

  const nowPlaying = queue[0] ?? null;
  const upNext = queue.slice(1);

  useEffect(() => {
    setSharedToken(session.spotify_token ?? null);
  }, [session.spotify_token]);

  // ── Init user data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phone && slug) {
      setRequestCount(getRequestCount(slug, phone));
      setTotalRequests(getTotalRequests(phone));
      setSuperVoteAvail(hasSuperVote(phone));
      setHistory(getHistory(phone));
      const map: Record<string, 'fire' | 'heart' | null> = {};
      queue.forEach(item => { const r = getMyReaction(phone, item.id); if (r) map[item.id] = r; });
      setReactMap(map);
    }
  }, [phone, slug]);

  // ── Update reactMap when queue changes ───────────────────────────────────
  useEffect(() => {
    if (!phone) return;
    setReactMap(prev => {
      const next = { ...prev };
      queue.forEach(item => { if (!(item.id in next)) { const r = getMyReaction(phone, item.id); next[item.id] = r; } });
      return next;
    });
  }, [queue, phone]);

  // ── Notification toasts ──────────────────────────────────────────────────
  useEffect(() => {
    if (!phone) return;
    const nowItem = queue[0];
    const nextItem = queue[1];
    const nowId = nowItem?.id ?? null;
    const nextId = nextItem?.id ?? null;
    let toastType: "playing" | "next" | null = null;
    if (nowItem?.client_id === phone && nowId !== prevNowIdRef.current) {
      toastType = "playing";
      if ('Notification' in window && Notification.permission === "granted") new Notification("🎶 Tocando agora!", { body: `${nowItem.title} — ${nowItem.artist}` });
    } else if (nextItem?.client_id === phone && nextId !== prevNextIdRef.current) {
      toastType = "next";
      if ('Notification' in window && Notification.permission === "granted") new Notification("⚡ Sua música é a próxima!", { body: `${nextItem.title} — ${nextItem.artist}` });
    }
    prevNowIdRef.current = nowId;
    prevNextIdRef.current = nextId;
    if (toastType) {
      setNotifToast(toastType);
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotifToast(null), 8000);
    }
    return () => { if (notifTimerRef.current) clearTimeout(notifTimerRef.current); };
  }, [queue, phone]);

  // ── Cooldown timer ───────────────────────────────────────────────────────
  const maxInitial = session.max_initial_requests ?? 5;
  const cooldownMs = (session.request_cooldown_minutes ?? 3) * 60 * 1000;

  useEffect(() => {
    if (!phone || !slug || requestCount < maxInitial) { setCooldownSecondsLeft(0); return; }
    const tick = () => {
      const lastTime = getLastRequestTime(slug, phone);
      const elapsed = lastTime ? Date.now() - lastTime : cooldownMs;
      setCooldownSecondsLeft(Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [requestCount, maxInitial, cooldownMs, phone, slug]);

  // ── Cleanup preview audio ────────────────────────────────────────────────
  useEffect(() => { return () => { previewAudioRef.current?.pause(); }; }, []);

  // ── Loading / status screens ─────────────────────────────────────────────
  if (barStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="h-16 w-16 animate-spin rounded-full border-8 border-brand-blue border-t-transparent" />
      </div>
    );
  }
  if (barStatus === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream text-center p-8">
        <h1 className="font-display text-8xl text-brand-blue mb-4">404</h1>
        <p className="font-display text-4xl uppercase text-brand-blue/60">Bar não encontrado</p>
      </div>
    );
  }
  if (barStatus === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream text-center p-8 gap-8">
        <div className="card-bento bg-white p-6 sm:p-12 max-w-md">
          <Clock className="mx-auto text-yellow-500 mb-6 w-14 h-14 sm:w-20 sm:h-20" />
          <h1 className="font-display text-3xl sm:text-5xl text-brand-blue leading-none mb-4">EM ANÁLISE</h1>
          <p className="font-body text-base sm:text-xl font-black uppercase italic opacity-60">
            Este bar ainda não foi aprovado pela equipe Tocaí. Volte em breve!
          </p>
        </div>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const themeAccent = getThemeAccent(session.theme ?? "");
  const freeLeft = Math.max(0, maxInitial - requestCount);
  const canRequest = !session.queue_locked && (freeLeft > 0 || cooldownSecondsLeft === 0);
  const waitMinutes = Math.round(upNext.length * 3.5);

  // ── Photo helpers ────────────────────────────────────────────────────────
  function getLastPhotoTime(s: string, p: string): number {
    return parseInt(localStorage.getItem(`caipa_photo_${s}_${p}`) || "0");
  }
  function setLastPhotoTime(s: string, p: string) {
    localStorage.setItem(`caipa_photo_${s}_${p}`, String(Date.now()));
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        const max = 1280;
        if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) return;
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
          setPhotoFile(compressed); setPhotoPreview(URL.createObjectURL(compressed));
        }, "image/jpeg", 0.75);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile || !slug || !phone || !clientName) return;
    const lastTime = getLastPhotoTime(slug, phone);
    if (Date.now() - lastTime < PHOTO_COOLDOWN_MS) { alert("Aguarde 1 minuto entre envios de fotos."); return; }
    setPhotoUploading(true);
    const path = `${slug}/${Date.now()}.${photoFile.name.split(".").pop() ?? "jpg"}`;
    const { error: uploadError } = await supabase.storage.from("photos").upload(path, photoFile, { upsert: false });
    if (uploadError) { alert(`Erro ao enviar foto: ${uploadError.message}`); setPhotoUploading(false); return; }
    const { data: urlData } = supabase.storage.from("photos").getPublicUrl(path);
    await supabase.from("bar_photos").insert({ bar_slug: slug, photo_url: urlData.publicUrl, caption: photoCaption.trim() || null, uploader_name: clientName, status: "pending" });
    setLastPhotoTime(slug, phone);
    setPhotoUploading(false);
    setPhotoSent(true);
    setTimeout(() => { setPhotoSent(false); setShowPhotoModal(false); setPhotoFile(null); setPhotoPreview(null); setPhotoCaption(""); }, 2000);
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchMusic(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
    setShowSearch(true);
    results.forEach(async (track: any) => {
      setTrackTagsCache(prev => { if (prev[track.id]) return prev; return { ...prev, [track.id]: { loading: true, tags: [] } }; });
      const { tags } = await getTrackInfo(track.artist, track.title);
      setTrackTagsCache(prev => ({ ...prev, [track.id]: { loading: false, tags } }));
    });
  };

  const handleAlbumClick = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    if (openTagId === track.id) { setOpenTagId(null); return; }
    setOpenTagId(track.id);
    if (!trackTagsCache[track.id]) {
      setTrackTagsCache(prev => ({ ...prev, [track.id]: { loading: true, tags: [] } }));
      const { tags } = await getTrackInfo(track.artist, track.title);
      setTrackTagsCache(prev => ({ ...prev, [track.id]: { loading: false, tags } }));
    }
  };

  const handlePreview = (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    if (!track.preview_url) return;
    if (previewPlayingId === track.id) {
      previewAudioRef.current?.pause(); previewAudioRef.current = null; setPreviewPlayingId(null); return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(track.preview_url);
    audio.volume = 0.7;
    audio.play().catch(console.error);
    audio.addEventListener('ended', () => { setPreviewPlayingId(null); previewAudioRef.current = null; });
    previewAudioRef.current = audio;
    setPreviewPlayingId(track.id);
  };

  const handleToggleFavorite = (track: any) => {
    toggleFavorite(track); setFavorites(getFavorites());
  };

  const handleRequest = async (music: any) => {
    if (session.queue_locked) { alert("A fila está fechada no momento. Aguarde o admin reabrir."); return; }
    if (!canRequest) {
      const mins = Math.floor(cooldownSecondsLeft / 60);
      const secs = cooldownSecondsLeft % 60;
      alert(`Aguarde ${mins > 0 ? `${mins}min ` : ""}${secs}s antes do próximo pedido.`);
      return;
    }
    if (session.enable_dedications) { setPendingTrack(music); setDedText(""); return; }
    await doRequest(music, "");
  };

  const doRequest = async (music: any, dedicationTo: string) => {
    try {
      previewAudioRef.current?.pause(); previewAudioRef.current = null; setPreviewPlayingId(null);
      const cachedTags = trackTagsCache[music.id];
      const tags = cachedTags ? cachedTags.tags : (await getTrackInfo(music.artist, music.title)).tags;
      await addMusic({ ...music, tags }, phone || "anon", clientName || "Cliente", session, dedicationTo);
      setShowSearch(false); setSearchQuery(""); setPendingTrack(null); setDedText(""); setOpenTagId(null); setShowSuccess(true);
      if (phone && slug) {
        incrementRequestCount(slug, phone); setLastRequestTime(slug, phone); setRequestCount(c => c + 1);
        incrementTotalRequests(phone); setTotalRequests(t => t + 1);
        addToHistory(phone, music); setHistory(getHistory(phone));
      }
      const similar = await getSimilarTracks(music.artist, music.title);
      setSuggested(similar);
    } catch (e: any) { alert(e.message); }
  };

  const handleVote = (id: string) => {
    vote(id, phone || "anon");
    setVotedItems(prev => new Set([...prev, id]));
    setTimeout(() => { setVotedItems(prev => { const n = new Set(prev); n.delete(id); return n; }); }, 2500);
  };

  const handleSuperVote = async (id: string) => {
    if (!phone || !superVoteAvail || superVotedItems.has(id)) return;
    await superVote(id);
    consumeSuperVote(phone);
    setSuperVoteAvail(false);
    setSuperVotedItems(prev => new Set([...prev, id]));
  };

  const handleReact = async (itemId: string, type: 'fire' | 'heart') => {
    if (!phone) return;
    const item = queue.find(i => i.id === itemId);
    if (!item) return;
    const current = (item.reactions ?? { fire: 0, heart: 0 }) as { fire: number; heart: number };
    const myReact = reactMap[itemId] ?? null;
    const newReactions = { ...current };
    if (myReact === type) { newReactions[type] = Math.max(0, newReactions[type] - 1); setMyReaction(phone, itemId, null); setReactMap(prev => ({ ...prev, [itemId]: null })); }
    else {
      if (myReact) newReactions[myReact] = Math.max(0, newReactions[myReact] - 1);
      newReactions[type] = (newReactions[type] ?? 0) + 1;
      setMyReaction(phone, itemId, type); setReactMap(prev => ({ ...prev, [itemId]: type }));
    }
    await reactToItem(itemId, newReactions);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen flex-col bg-brand-cream p-4 lg:p-8"
    >
      {/* Notification Toast */}
      <AnimatePresence>
        {notifToast && (
          <motion.div
            key={notifToast}
            initial={{ opacity: 0, y: -60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => setNotifToast(null)}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] cursor-pointer w-full max-w-sm px-4"
          >
            <div className={cn(
              "border-4 px-6 py-4 shadow-[6px_6px_0px] flex items-center gap-4",
              notifToast === "playing"
                ? "border-brand-lime bg-brand-lime text-brand-cream shadow-[6px_6px_0px_var(--color-brand-blue)]"
                : "border-brand-blue bg-brand-blue text-brand-cream shadow-[6px_6px_0px_var(--color-brand-lime)]",
            )}>
              <span className="text-xl sm:text-3xl">{notifToast === "playing" ? "🎶" : "⚡"}</span>
              <div className="flex-1">
                <p className="font-display text-sm sm:text-2xl uppercase leading-none">
                  {notifToast === "playing" ? "Tocando agora!" : "Sua música é a próxima!"}
                </p>
                <p className="font-body text-xs font-bold uppercase opacity-70 mt-0.5">
                  {notifToast === "playing" ? queue[0]?.title : queue[1]?.title}
                </p>
              </div>
              <X size={18} className="opacity-60 flex-shrink-0" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-8 border-brand-blue pb-6"
      >
        <div>
          {barLogo ? (
            <img src={barLogo} alt={slug} className="h-14 sm:h-20 lg:h-24 object-contain max-w-[200px] sm:max-w-[280px] mb-1" />
          ) : (
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display uppercase tracking-tighter leading-none text-brand-blue">
              TOCA<span className="text-brand-lime text-stroke-blue">Í</span>
            </h1>
          )}
          <p className="text-sm sm:text-xl font-body font-bold italic uppercase opacity-70">
            tocai.com/{slug}
          </p>
        </div>
        <motion.div
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="text-left md:text-right mt-4 md:mt-0 flex flex-col items-start md:items-end gap-2"
        >
          {session.queue_locked && (
            <div className="px-4 py-1 border-4 border-red-600 bg-red-900/40 inline-block shadow-[4px_4px_0px_rgba(220,38,38,1)]">
              <span className="text-sm font-bold uppercase tracking-widest text-red-400">🔒 Fila Fechada</span>
            </div>
          )}
          {barName && (
            <p className="font-body text-xs font-bold uppercase opacity-50 tracking-widest">{barName}</p>
          )}
          <div className={cn("px-4 py-1 border-4 border-brand-blue inline-block mb-2 shadow-[4px_4px_0px_var(--color-brand-blue)]", themeAccent.badge)}>
            <span className="text-sm font-bold uppercase tracking-widest text-brand-lime">Tema da Noite</span>
          </div>
          <h2 className={cn("text-2xl sm:text-4xl lg:text-5xl font-display uppercase tracking-tight leading-none", themeAccent.title)}>
            {session.theme}
          </h2>
        </motion.div>
      </motion.header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow relative">

        {/* Search Results Overlay */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-brand-cream/95 backdrop-blur-md p-4 lg:p-8 overflow-y-auto"
            >
              <div className="card-bento p-6 lg:p-10 min-h-full">
                <div className="mb-8 flex items-center justify-between border-b-4 border-brand-blue pb-4">
                  <h4 className="font-display text-2xl sm:text-4xl lg:text-5xl uppercase tracking-tighter">O QUE VAMOS OUVIR?</h4>
                  <button onClick={() => { setShowSearch(false); previewAudioRef.current?.pause(); previewAudioRef.current = null; setPreviewPlayingId(null); }}
                    className="text-brand-blue hover:rotate-90 transition-transform p-1">
                    <X size={28} strokeWidth={3} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((item) => {
                    const tagInfo = trackTagsCache[item.id];
                    const isOpen = openTagId === item.id;
                    const isThemeActive = !!(session.theme && session.theme !== "Livre");
                    const isThemeMatch = isThemeActive && tagInfo && !tagInfo.loading
                      ? tagInfo.tags.some(t => normalizeTag(t).includes(normalizeTag(session.theme ?? '')) || normalizeTag(session.theme ?? '').includes(normalizeTag(t)))
                      : false;
                    const isPreviewing = previewPlayingId === item.id;
                    const faved = isFavorite(item.id);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "card-bento p-4 flex flex-col gap-4 group transition-all",
                          isThemeMatch && "ring-4 ring-brand-lime shadow-[0_0_0_4px_var(--color-brand-lime)]",
                        )}
                      >
                        {/* Album art */}
                        <div className="relative w-full aspect-video border-2 border-brand-blue shadow-[4px_4px_0px_var(--color-brand-blue)] group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all overflow-hidden">
                          <img src={item.thumb} alt={item.title} className="w-full h-full object-cover cursor-pointer" onClick={(e) => handleAlbumClick(e, item)} />
                          {isThemeMatch && (
                            <div className="absolute top-0 left-0 right-0 bg-brand-lime text-brand-cream text-[11px] font-black uppercase px-3 py-1 flex items-center justify-center gap-1 shadow-[0_2px_0_var(--color-brand-blue)]">
                              <Tag size={10} /> TEMA DA NOITE · +1 NA FILA
                            </div>
                          )}
                          {tagInfo?.loading && <div className="absolute top-2 left-2"><div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-lime border-t-transparent" /></div>}
                          <div className="absolute top-2 right-2 flex flex-col gap-1">
                            <button className="bg-brand-blue/80 text-brand-lime p-1 hover:bg-brand-blue transition-colors" onClick={(e) => handleAlbumClick(e, item)} title="Ver tags"><Info size={14} /></button>
                            {item.preview_url && (
                              <button
                                className={cn("p-1 transition-colors", isPreviewing ? "bg-brand-lime text-brand-cream" : "bg-brand-blue/80 text-brand-lime hover:bg-brand-blue")}
                                onClick={(e) => handlePreview(e, item)} title={isPreviewing ? "Pausar preview" : "Ouvir 30s"}
                              >
                                {isPreviewing ? <Pause size={14} /> : <Play size={14} />}
                              </button>
                            )}
                            <button
                              className={cn("p-1 transition-colors", faved ? "bg-red-500 text-white" : "bg-brand-blue/80 text-brand-lime hover:bg-brand-blue")}
                              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item); }} title={faved ? "Remover dos favoritos" : "Salvar nos favoritos"}
                            >
                              <Star size={14} fill={faved ? "currentColor" : "none"} />
                            </button>
                          </div>
                          {isPreviewing && (
                            <div className="absolute bottom-0 left-0 right-0 bg-brand-lime/90 text-brand-cream text-[10px] font-black uppercase px-2 py-1 flex items-center gap-1">
                              <span className="animate-pulse">●</span> PREVIEW 30S
                            </div>
                          )}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 35 }} className="absolute inset-x-0 bottom-0 bg-brand-blue/95 p-3">
                                {tagInfo?.loading ? (
                                  <div className="flex items-center gap-2"><div className="h-3 w-3 animate-spin rounded-full border-2 border-brand-lime border-t-transparent" /><span className="text-[10px] font-bold uppercase text-brand-lime">Buscando tags...</span></div>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {(tagInfo?.tags.slice(0, 6) ?? []).map(tag => {
                                      const isTheme = isThemeActive && (normalizeTag(tag).includes(normalizeTag(session.theme ?? '')) || normalizeTag(session.theme ?? '').includes(normalizeTag(tag)));
                                      return (<span key={tag} className={cn("text-[10px] font-bold uppercase px-2 py-0.5 border", isTheme ? "bg-brand-lime text-brand-cream border-brand-lime" : "bg-white/10 text-brand-lime/80 border-white/20")}>{tag}</span>);
                                    })}
                                    {(tagInfo?.tags ?? []).length === 0 && <span className="text-[10px] text-brand-lime/50 uppercase font-bold">Sem tags disponíveis</span>}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h5 className="truncate font-display text-xl uppercase leading-none">{item.title}</h5>
                          <p className="font-body text-sm font-bold uppercase opacity-60 italic">{item.artist}</p>
                        </div>
                        <button
                          onClick={() => handleRequest(item)}
                          disabled={session.queue_locked}
                          className={cn("btn-bento w-full text-base py-2 flex items-center justify-center gap-2", isThemeMatch && "bg-brand-lime text-brand-cream border-brand-blue", session.queue_locked && "opacity-40 cursor-not-allowed")}
                        >
                          {session.queue_locked ? "🔒 FILA FECHADA" : isThemeMatch ? <><Tag size={14} /> PEDIR · +1</> : "PEDIR"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dedication Modal */}
        <AnimatePresence>
          {pendingTrack && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-blue/80 p-6 backdrop-blur-sm">
              <div className="card-bento w-full max-w-sm bg-white p-5 sm:p-8">
                <h3 className="text-2xl sm:text-4xl font-display text-brand-blue mb-1 leading-none">DEDICAR?</h3>
                <p className="font-body text-sm font-bold uppercase italic opacity-60 mb-1">{pendingTrack.title} · {pendingTrack.artist}</p>
                <p className="font-body text-xs uppercase opacity-40 mb-6">Campo opcional</p>
                <input autoFocus type="text" placeholder="Para quem? Ex: Fulano ❤️" value={dedText} onChange={e => setDedText(e.target.value)} onKeyDown={e => e.key === "Enter" && doRequest(pendingTrack, dedText)} className="w-full border-4 border-brand-blue p-3 font-display text-base sm:text-xl uppercase focus:outline-none mb-4 bg-brand-cream" />
                <div className="flex gap-3">
                  <button onClick={() => doRequest(pendingTrack, "")} className="btn-bento flex-1 text-lg opacity-60">PULAR</button>
                  <button onClick={() => doRequest(pendingTrack, dedText)} className="btn-bento flex-1 text-lg bg-brand-lime text-brand-cream">❤️ DEDICAR</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Modal */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/90 p-6 backdrop-blur-md">
              <div className="card-bento max-w-sm bg-white p-6 sm:p-10 text-center shadow-[12px_12px_0px_var(--color-brand-lime)]">
                <div className="mb-4 sm:mb-6 flex justify-center text-brand-lime">
                  <Sparkles strokeWidth={3} className="drop-shadow-[4px_4px_0px_var(--color-brand-blue)] w-14 h-14 sm:w-20 sm:h-20" />
                </div>
                <h3 className="text-3xl sm:text-5xl font-display leading-none mb-2">PEDIDO ENVIADO!</h3>
                <p className="mb-6 sm:mb-8 font-body text-base sm:text-2xl font-black uppercase leading-tight italic opacity-60">Sua música já está na fila.</p>
                {suggested.length > 0 && (
                  <div className="mb-8 text-left">
                    <p className="mb-4 font-display text-xl tracking-widest text-brand-blue/60 underline decoration-brand-lime decoration-4 underline-offset-4 uppercase">PODE TE INTERESSAR:</p>
                    <div className="space-y-3">
                      {suggested.map((s, i) => (
                        <div key={i} className="border-b-2 border-brand-blue/10 pb-2">
                          <p className="font-display text-lg leading-none uppercase">{s.title}</p>
                          <p className="font-body text-xs font-bold uppercase opacity-50 italic">{s.artist}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => setShowSuccess(false)} className="btn-bento w-full text-xl sm:text-3xl">FECHAR</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* NOW PLAYING card */}
        <motion.div layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="md:col-span-7 md:row-span-4 border-4 border-brand-blue bg-brand-blue shadow-[8px_8px_0px_var(--color-brand-blue)] text-brand-cream p-6 lg:p-10 flex flex-col relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 bg-brand-lime text-brand-cream font-display px-3 py-1 sm:px-6 sm:py-2 text-base sm:text-2xl lg:text-3xl tracking-tighter shadow-[-4px_4px_0px_var(--color-brand-blue)] z-10">
            NO AR AGORA
          </div>
          {nowPlaying ? (
            <div className="flex flex-col lg:flex-row gap-8 items-center h-full">
              <div className="relative w-32 h-32 sm:w-48 sm:h-48 lg:w-64 lg:h-64 flex-shrink-0 animate-float">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -inset-4 rounded-full border-4 border-dashed border-brand-lime opacity-20" />
                <div className="w-full h-full border-4 border-brand-cream relative overflow-hidden shadow-[8px_8px_0px_var(--color-brand-lime)]">
                  {nowPlaying.thumbnail_url ? (<img src={nowPlaying.thumbnail_url} alt={nowPlaying.title} className="w-full h-full object-cover" />) : (<div className="w-full h-full bg-black flex items-center justify-center"><Music className="text-brand-lime opacity-40 w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20" /></div>)}
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/40 to-transparent" />
                </div>
              </div>
              <div className="flex flex-col justify-center text-center lg:text-left flex-1 min-w-0">
                <OverflowMarquee
                  text={nowPlaying.title}
                  className="text-2xl sm:text-4xl lg:text-6xl font-display leading-none mb-2 uppercase italic tracking-tighter"
                />
                <p className="text-sm sm:text-xl lg:text-2xl font-body font-bold text-brand-lime mb-2 uppercase tracking-widest leading-none">{nowPlaying.artist}</p>
                {(nowPlaying.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3 justify-center lg:justify-start">
                    {(nowPlaying.tags ?? []).slice(0, 4).map((tag: string) => {
                      const isTheme = tagMatchesTheme([tag], session.theme ?? '');
                      return (
                        <span key={tag} className={cn("text-[10px] font-bold uppercase px-2 py-0.5 border flex items-center gap-1", isTheme ? "bg-brand-lime text-brand-cream border-brand-lime/80" : "bg-white/10 text-brand-lime/70 border-brand-lime/20")}>
                          {isTheme && <Tag size={8} />}{tag}
                        </span>
                      );
                    })}
                  </div>
                )}
                {nowPlaying.dedication_to && (
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <span className="text-lg">❤️</span>
                    <span className="text-sm font-body font-bold uppercase text-brand-lime/80 italic">Para {nowPlaying.dedication_to}</span>
                  </div>
                )}
                {session.spotify_device_name ? (
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <Smartphone size={13} className="text-brand-lime/70 flex-shrink-0" />
                    <span className="text-[10px] font-body font-bold uppercase opacity-60 tracking-widest">tocando em: {session.spotify_device_name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <span className="text-[10px] font-body font-bold uppercase text-yellow-400/80 tracking-widest">⚠ admin sem dispositivo conectado</span>
                  </div>
                )}
                {nowPlaying.external_urls?.spotify && (
                  <a href={nowPlaying.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-brand-lime/70 font-body text-xs font-bold uppercase underline mb-4 justify-center lg:justify-start">
                    <ExternalLink size={12} /> Ouvir no Spotify
                  </a>
                )}
                <div className="flex items-center justify-center lg:justify-start gap-3 mt-2">
                  <div className="w-10 h-10 rounded-full bg-brand-lime border-4 border-brand-cream flex items-center justify-center text-lg shadow-[4px_4px_0px_var(--color-brand-blue)]">🎶</div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest">Requisitado por</p>
                    <p className="text-base sm:text-lg lg:text-xl font-display uppercase tracking-tight leading-none">@{nowPlaying.client_name}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 opacity-40">
              <Music className="text-brand-lime w-12 h-12 sm:w-20 sm:h-20" />
              <p className="font-display text-2xl sm:text-4xl uppercase">FILA VAZIA</p>
              <p className="font-body text-base sm:text-xl font-bold uppercase italic">Faça o primeiro pedido!</p>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-3 bg-brand-cream/10">
            {nowPlaying && (<motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="h-full bg-brand-lime w-full" />)}
          </div>
        </motion.div>

        {/* Queue Card — with tabs */}
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
          className="md:col-span-5 md:row-span-6 card-bento p-6 lg:p-8 flex flex-col bg-white"
        >
          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b-4 border-brand-blue pb-3">
            <TabBtn active={queueTab === "queue"} onClick={() => setQueueTab("queue")}>FILA <span className="opacity-60">({upNext.length})</span></TabBtn>
            <TabBtn active={queueTab === "favorites"} onClick={() => setQueueTab("favorites")}><Star size={12} className="inline mr-1 mb-0.5" />{favorites.length}</TabBtn>
            <TabBtn active={queueTab === "history"} onClick={() => setQueueTab("history")}><History size={12} className="inline mr-1 mb-0.5" />HIST.</TabBtn>
          </div>

          {/* Queue tab */}
          {queueTab === "queue" && (
            <div className="flex-grow space-y-4 overflow-y-auto pr-2 queue-scroll">
              {upNext.length === 0 && (<div className="flex flex-col items-center justify-center py-16 opacity-30 text-center gap-3"><Music size={48} /><p className="font-display text-2xl uppercase">Nenhuma música na fila</p></div>)}
              {upNext.map((item, idx) => {
                const myReact = reactMap[item.id] ?? null;
                const reactions = (item.reactions ?? { fire: 0, heart: 0 }) as { fire: number; heart: number };
                return (
                  <motion.div layout key={item.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05, duration: 0.3 }}
                    whileHover={{ x: 2, y: 2, transition: { duration: 0.1 } }}
                    className={cn("flex flex-col p-4 border-4 border-brand-blue shadow-[4px_4px_0px_var(--color-brand-blue)] transition-shadow", idx === 0 ? "bg-brand-cream" : "bg-white", votedItems.has(item.id) && "bg-green-900/20")}
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn("font-display text-2xl sm:text-4xl lg:text-5xl leading-none opacity-40", themeAccent.title)}>{(idx + 2).toString().padStart(2, "0")}</span>
                      <div className="flex-grow min-w-0">
                        <p className="font-display text-lg sm:text-2xl lg:text-3xl leading-none uppercase truncate tracking-tighter">{item.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="text-[10px] lg:text-xs font-body font-bold uppercase opacity-70 truncate italic">{item.artist}</p>
                          {item.client_id === phone && (<span className="bg-brand-lime text-brand-cream text-[10px] px-1 font-bold border border-brand-blue leading-none flex-shrink-0">VOCÊ</span>)}
                          {tagMatchesTheme(item.tags ?? [], session.theme ?? '') && (
                            <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 border flex items-center gap-1 flex-shrink-0", themeAccent.badge, "text-brand-lime border-brand-blue/40")}><Tag size={8} /> TEMA</span>
                          )}
                        </div>
                        {item.dedication_to && (<p className="text-[10px] font-bold uppercase text-pink-400 mt-0.5 italic">❤️ para {item.dedication_to}</p>)}
                      </div>
                      <div className="text-right flex flex-col items-center gap-1">
                        <button onClick={() => handleVote(item.id)} className="group flex flex-col items-center transition-all active:scale-125">
                          <span className={cn("font-display text-lg sm:text-2xl lg:text-3xl leading-none transition-colors duration-300", votedItems.has(item.id) ? "text-green-400" : "text-brand-blue")}>+{item.score}</span>
                          <AnimatePresence mode="wait" initial={false}>
                            {votedItems.has(item.id) ? (<motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={16} className="text-green-400" /></motion.div>)
                              : (<motion.div key="thumb" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><ThumbsUp size={16} className="text-brand-blue group-hover:text-green-400" /></motion.div>)}
                          </AnimatePresence>
                        </button>
                        {superVoteAvail && !superVotedItems.has(item.id) && (
                          <button onClick={() => handleSuperVote(item.id)} className="flex flex-col items-center text-yellow-400 hover:text-yellow-300 active:scale-125 transition-all" title="Super Voto: +3 (uma vez por noite)">
                            <Zap size={14} fill="currentColor" /><span className="text-[9px] font-bold uppercase leading-none">+3</span>
                          </button>
                        )}
                        <p className="text-[9px] font-bold uppercase opacity-60 mt-1">@{item.client_name}</p>
                      </div>
                    </div>
                    {/* Reactions */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-brand-blue/10">
                      <button onClick={() => handleReact(item.id, 'fire')} className={cn("flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 border-2 transition-all", myReact === 'fire' ? "border-orange-400 bg-orange-900/30 text-orange-400" : "border-transparent text-brand-blue/40 hover:border-orange-300")}>
                        🔥 {reactions.fire > 0 ? reactions.fire : ""}
                      </button>
                      <button onClick={() => handleReact(item.id, 'heart')} className={cn("flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 border-2 transition-all", myReact === 'heart' ? "border-red-400 bg-red-900/30 text-red-400" : "border-transparent text-brand-blue/40 hover:border-red-300")}>
                        ❤️ {reactions.heart > 0 ? reactions.heart : ""}
                      </button>
                      {superVoteAvail && (<span className="ml-auto text-[9px] font-bold uppercase text-yellow-400 opacity-70">⚡ super voto disponível</span>)}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Favorites tab */}
          {queueTab === "favorites" && (
            <div className="flex-grow space-y-3 overflow-y-auto pr-2 queue-scroll">
              {favorites.length === 0 && (<div className="flex flex-col items-center justify-center py-16 opacity-30 text-center gap-3"><Star size={48} /><p className="font-display text-2xl uppercase">Sem favoritos ainda</p><p className="font-body text-sm uppercase italic">Salve músicas nos resultados de busca</p></div>)}
              {favorites.map(track => (
                <div key={track.id} className="flex items-center gap-3 p-3 border-4 border-brand-blue bg-white shadow-[4px_4px_0px_var(--color-brand-blue)]">
                  {track.thumb && (<img src={track.thumb} alt={track.title} className="h-12 w-12 object-cover border-2 border-brand-blue flex-shrink-0" />)}
                  <div className="flex-grow min-w-0">
                    <p className="font-display text-lg leading-none uppercase truncate">{track.title}</p>
                    <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{track.artist}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleRequest(track)} disabled={session.queue_locked} className="btn-bento text-sm px-3 py-1 disabled:opacity-40">PEDIR</button>
                    <button onClick={() => handleToggleFavorite(track)} className="text-red-400 hover:text-red-300 p-1"><Star size={16} fill="currentColor" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* History tab */}
          {queueTab === "history" && (
            <div className="flex-grow space-y-3 overflow-y-auto pr-2 queue-scroll">
              {history.length === 0 && (<div className="flex flex-col items-center justify-center py-16 opacity-30 text-center gap-3"><History size={48} /><p className="font-display text-2xl uppercase">Sem histórico</p><p className="font-body text-sm uppercase italic">Suas músicas pedidas aparecem aqui</p></div>)}
              {history.map((track: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 border-4 border-brand-blue bg-white shadow-[4px_4px_0px_var(--color-brand-blue)]">
                  {track.thumb && (<img src={track.thumb} alt={track.title} className="h-12 w-12 object-cover border-2 border-brand-blue flex-shrink-0" />)}
                  <div className="flex-grow min-w-0">
                    <p className="font-display text-lg leading-none uppercase truncate">{track.title}</p>
                    <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{track.artist}</p>
                    {track.requestedAt && (<p className="text-[9px] font-bold uppercase opacity-40 mt-0.5">{new Date(track.requestedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>)}
                  </div>
                  <button onClick={() => handleRequest(track)} disabled={session.queue_locked} className="btn-bento text-sm px-3 py-1 flex-shrink-0 disabled:opacity-40">DE NOVO</button>
                </div>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div className="mt-4">
            {session.queue_locked ? (
              <div className="border-4 border-red-600 bg-red-900/30 p-4 text-center">
                <p className="font-display text-xl sm:text-2xl uppercase text-red-400">🔒 Fila Fechada</p>
                <p className="font-body text-xs font-bold uppercase text-red-400/70 mt-1">O admin pausou os pedidos temporariamente</p>
              </div>
            ) : (
              <div className="relative flex items-center">
                <input type="text" placeholder="QUER OUVIR O QUÊ?"
                  className="w-full border-4 border-brand-blue bg-brand-cream px-4 py-3 sm:px-6 sm:py-4 font-display text-lg sm:text-2xl lg:text-3xl uppercase tracking-tighter placeholder:text-brand-blue/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-lime/30"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} />
                <button onClick={handleSearch} className="absolute right-4 bg-brand-blue p-2 text-brand-lime shadow-[2px_2px_0px_var(--color-brand-lime)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-0 active:translate-y-0 transition-all">
                  {isSearching ? <div className="h-5 w-5 sm:h-8 sm:w-8 animate-spin rounded-full border-4 border-brand-lime border-t-transparent" /> : <Search size={22} strokeWidth={3} />}
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Identity Card */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
          className="md:col-span-3 md:row-span-2 card-bento-lime p-5 flex flex-col justify-between group"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-cream/60 group-hover:text-brand-cream transition-colors">Sua Identidade</span>
            <span className="text-xs font-display bg-brand-blue text-brand-lime px-3 py-1 uppercase italic tracking-tighter">{getUserBadge(totalRequests)}</span>
          </div>
          <div>
            <p className="text-2xl sm:text-4xl lg:text-5xl font-display uppercase italic text-brand-cream leading-none tracking-tight">{clientName || "VISITANTE"}</p>
            <p className="text-sm font-body font-bold text-brand-cream opacity-60">CLIENTE_ID: {phone?.slice(-4) || "????"}</p>
          </div>
          <div className="flex gap-1 mt-4">
            {Array.from({ length: maxInitial }).map((_, i) => (
              <div key={i} className={cn("h-3 w-full transition-colors", i < requestCount ? cooldownSecondsLeft > 0 ? "bg-yellow-500" : "bg-brand-cream" : "bg-brand-cream/20")} />
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase text-brand-cream opacity-60 mt-2">
            {cooldownSecondsLeft > 0 ? `Recarregando em ${Math.floor(cooldownSecondsLeft / 60)}:${String(cooldownSecondsLeft % 60).padStart(2, "0")}` : freeLeft > 0 ? `${freeLeft} pedido${freeLeft !== 1 ? "s" : ""} restante${freeLeft !== 1 ? "s" : ""} hoje` : "Pode pedir mais uma!"}
          </p>
          {superVoteAvail && (
            <div className="mt-2 flex items-center gap-1 bg-yellow-900/30 border-2 border-yellow-400 px-2 py-1">
              <Zap size={12} className="text-yellow-400" fill="currentColor" />
              <span className="text-[10px] font-bold uppercase text-yellow-400">Super Voto disponível!</span>
            </div>
          )}
          <p className="text-[9px] font-bold uppercase text-brand-cream/40 mt-1">{totalRequests} pedidos no total</p>
        </motion.div>

        {/* Wait Time + Photo Button */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.4 }}
          className="md:col-span-4 md:row-span-2 flex gap-3"
        >
          {/* Tempo Estimado */}
          <div className="flex-1 border-4 border-brand-blue p-4 flex flex-col justify-center items-center text-center bg-brand-cream shadow-[8px_8px_0px_var(--color-brand-blue)] relative overflow-hidden">
            {approvedPhotos.length > 0 && (
              <AnimatePresence mode="wait">
                <motion.div key={approvedPhotos[carouselIdx % approvedPhotos.length]?.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 0.38 }} exit={{ opacity: 0 }} transition={{ duration: 1.5 }}
                  className="absolute inset-0 scale-110 pointer-events-none"
                  style={{ backgroundImage: `url(${approvedPhotos[carouselIdx % approvedPhotos.length]?.photo_url})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(12px)" }}
                />
              </AnimatePresence>
            )}
            <div className="absolute inset-0 bg-brand-cream/60 pointer-events-none" />
            <p className="relative z-10 text-xs font-bold uppercase mb-2 opacity-60 tracking-widest">TEMPO ESTIMADO</p>
            <div className="relative z-10 flex items-baseline gap-1">
              <p className="text-4xl sm:text-6xl lg:text-7xl font-display tracking-tighter text-brand-blue leading-none">{waitMinutes}</p>
              <span className="text-lg sm:text-2xl font-display text-brand-blue">MIN</span>
            </div>
            <p className="relative z-10 text-[10px] font-bold uppercase mt-2 bg-brand-blue text-brand-lime px-3 py-1 italic tracking-widest">
              {upNext.length === 0 ? "Fila livre!" : upNext.length <= 3 ? "Fila andando rápido" : "Fila movimentada"}
            </p>
          </div>

          {/* Photo upload button */}
          {phone && (
            <button onClick={() => setShowPhotoModal(true)}
              className="flex flex-col items-center justify-center gap-2 border-4 border-brand-blue bg-white shadow-[8px_8px_0px_var(--color-brand-blue)] px-4 hover:bg-brand-cream transition-colors group min-w-[80px]"
            >
              <Camera size={28} className="text-brand-blue group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue text-center leading-tight">FOTO<br />PRO<br />TELÃO</span>
            </button>
          )}
        </motion.div>

      </div>

      {/* Footer */}
      <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6 border-t-8 border-brand-blue pt-8"
      >
        <div className="flex flex-wrap justify-center md:justify-start gap-4">
          <span className="text-xs font-bold border-4 border-brand-blue bg-white px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)]">tocai.com/{slug}</span>
          <span className="text-xs font-bold border-4 border-brand-blue bg-brand-lime text-brand-cream px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)]">PAGUE NO BALCÃO</span>
          <a href={`/stats/${slug}`} className="text-xs font-bold border-4 border-brand-blue bg-white px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)] hover:bg-brand-cream transition-colors">📊 VER ESTATÍSTICAS</a>
          {approvedPhotos.length > 0 && (
            <button onClick={() => setShowPhotoGallery(true)} className="text-xs font-bold border-4 border-brand-blue bg-white px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)] hover:bg-brand-cream transition-colors flex items-center gap-1">
              <Camera size={12} /> FOTOS DA NOITE
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
          <span className="text-lg font-display uppercase tracking-widest text-brand-blue italic">Real-time Sync Active</span>
        </div>
      </motion.footer>

      {/* Photo Gallery Modal */}
      <AnimatePresence>
        {showPhotoGallery && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[115] bg-brand-blue/95 backdrop-blur-md overflow-y-auto p-4 sm:p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-center mb-6 border-b-4 border-brand-lime pb-4">
                <h3 className="font-display text-3xl sm:text-5xl uppercase text-white flex items-center gap-3"><Camera size={28} className="text-brand-lime" /> FOTOS DA NOITE</h3>
                <button onClick={() => setShowPhotoGallery(false)} className="text-white/60 hover:text-brand-lime transition-colors p-1"><X size={28} strokeWidth={3} /></button>
              </div>
              <div className="columns-2 sm:columns-3 gap-3">
                {approvedPhotos.map(photo => (
                  <div key={photo.id} className="break-inside-avoid mb-3 relative group">
                    <img src={photo.photo_url} alt={photo.caption ?? ""} className="w-full border-2 border-white/10 group-hover:border-brand-lime transition-colors" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <a href={photo.photo_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="border-4 border-brand-blue bg-brand-lime text-brand-cream font-display text-sm uppercase px-4 py-2 shadow-[3px_3px_0px_var(--color-brand-blue)]">ABRIR</a>
                    </div>
                    {(photo.caption || photo.uploader_name) && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1.5">
                        {photo.caption && (<p className="font-display text-xs uppercase text-brand-lime leading-none truncate">{photo.caption}</p>)}
                        <p className="text-[10px] font-bold uppercase text-white/50 mt-0.5">📸 {photo.uploader_name ?? "Anônimo"}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photo Upload Modal */}
      <AnimatePresence>
        {showPhotoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-blue/80 p-6 backdrop-blur-sm">
            <div className="card-bento w-full max-w-sm bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-3xl uppercase leading-none flex items-center gap-2"><Camera size={24} /> FOTO PRO TELÃO</h3>
                <button onClick={() => { setShowPhotoModal(false); setPhotoFile(null); setPhotoPreview(null); setPhotoCaption(""); }} className="text-brand-blue/40 hover:text-brand-blue transition-colors"><X size={24} /></button>
              </div>
              <p className="font-body text-xs font-bold uppercase opacity-50 italic mb-4">Sua foto aparece na TV após aprovação do admin.</p>
              {photoSent ? (
                <div className="text-center py-8">
                  <div className="text-green-400 flex justify-center mb-3"><Check size={48} strokeWidth={3} /></div>
                  <p className="font-display text-2xl uppercase text-green-400">FOTO ENVIADA!</p>
                  <p className="font-body text-sm uppercase opacity-60 mt-1">Aguardando aprovação do admin</p>
                </div>
              ) : (
                <>
                  <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                  {photoPreview ? (
                    <div className="relative mb-4 border-4 border-brand-blue">
                      <img src={photoPreview} alt="Preview" className="w-full max-h-56 object-cover" />
                      <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-2 right-2 bg-white border-2 border-brand-blue p-1 hover:bg-red-50"><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => photoInputRef.current?.click()} className="w-full border-4 border-dashed border-brand-blue p-10 text-center mb-4 hover:bg-brand-cream/40 transition-colors">
                      <Camera size={36} className="mx-auto mb-2 text-brand-blue/40" />
                      <p className="font-display text-xl uppercase opacity-60">Tirar foto ou escolher da galeria</p>
                    </button>
                  )}
                  <input type="text" placeholder="Legenda curta: @seunome ou #bardobeto" maxLength={60} value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} className="w-full border-4 border-brand-blue p-3 font-body text-base focus:outline-none mb-4 bg-brand-cream" />
                  <div className="flex gap-3">
                    <button onClick={() => { setShowPhotoModal(false); setPhotoFile(null); setPhotoPreview(null); setPhotoCaption(""); }} className="flex-1 border-4 border-brand-blue/30 py-3 font-display text-lg uppercase text-brand-blue/60">CANCELAR</button>
                    <button onClick={handlePhotoUpload} disabled={!photoFile || photoUploading}
                      className={cn("flex-1 border-4 py-3 font-display text-lg uppercase transition-all flex items-center justify-center gap-2", photoFile && !photoUploading ? "border-brand-blue bg-brand-blue text-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)]" : "border-brand-blue/30 text-brand-blue/30 cursor-not-allowed")}
                    >
                      {photoUploading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-lime border-t-transparent" /> ENVIANDO...</> : "ENVIAR"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Identification Modal */}
      <AnimatePresence>
        {showIdentify && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue/80 p-6 backdrop-blur-sm">
            <form
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = (fd.get("name") as string).trim();
                const p = (fd.get("phone") as string).replace(/\D/g, "");
                if (!name || name.length < 2) return;
                if (!/^\d{10,11}$/.test(p)) return;
                localStorage.setItem(`caipa_phone_${slug}`, p);
                localStorage.setItem(`caipa_name_${slug}`, name);
                setPhone(p);
                setClientName(name);
                if (slug) setRequestCount(getRequestCount(slug, p));
                setTotalRequests(getTotalRequests(p));
                setSuperVoteAvail(hasSuperVote(p));
                setHistory(getHistory(p));
                setShowIdentify(false);
                if ('Notification' in window && Notification.permission === "default") {
                  Notification.requestPermission().catch(() => {});
                }
              }}
              className="card-bento w-full max-w-sm p-5 sm:p-8 bg-white"
            >
              <h3 className="mb-2 text-2xl sm:text-4xl font-display text-brand-blue">QUEM ESTÁ PEDINDO?</h3>
              <p className="mb-6 font-body text-sm sm:text-lg font-bold uppercase leading-tight italic text-brand-blue/60">
                Antes de pedir, como devemos te chamar na fila?
              </p>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase text-brand-blue/50 italic">Nome / Apelido</label>
                  <input name="name" required minLength={2} type="text" placeholder="EX: JOÃO DO SAMBA"
                    className="w-full border-4 border-brand-blue bg-brand-cream p-3 font-display text-xl sm:text-2xl uppercase focus:outline-none focus:bg-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase text-brand-blue/50 italic">Celular (DDD + número)</label>
                  <input name="phone" required type="tel" inputMode="numeric" placeholder="(00) 00000-0000"
                    className="w-full border-4 border-brand-blue bg-brand-cream p-3 font-display text-xl sm:text-2xl focus:outline-none focus:bg-white" />
                </div>
                <button type="submit" className="btn-bento w-full text-xl sm:text-2xl mt-4 uppercase">ENTRAR NO FLOW 🎶</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
