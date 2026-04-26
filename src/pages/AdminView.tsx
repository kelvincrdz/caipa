import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Power, Settings, List, Trash2, ShieldAlert, ArrowUpCircle,
  Play, Music, SkipForward, Pause, Wifi, WifiOff, LogIn, LogOut, Lock, ShieldCheck, Tag, Share2, Copy, CheckCheck,
  Lock as LockIcon, Unlock, Heart, History, Search, Plus, ClipboardList, BarChart2, Palette, Ban, ImageIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { tagMatchesTheme } from "../hooks/useQueue";
import { cn } from "../lib/utils";
import { useQueue } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { initiateLogin, isAdminLoggedIn, logout, getValidToken } from "../services/spotifyAuth";
import { play as spotifyPlay, pause as spotifyPause, resume as spotifyResume } from "../services/spotifyPlayback";
import { supabase } from "../lib/supabase";
import { searchMusic, getTrackInfo } from "../services/musicService";

const GENRE_TAGS = [
  { label: "Livre",      value: "Livre",      cls: "border-brand-blue/40 text-brand-blue/60 bg-white" },
  { label: "Forró",      value: "Forró",      cls: "border-orange-400 text-orange-700 bg-orange-50" },
  { label: "Samba",      value: "Samba",      cls: "border-green-500 text-green-700 bg-green-50" },
  { label: "Pagode",     value: "Pagode",     cls: "border-emerald-500 text-emerald-700 bg-emerald-50" },
  { label: "MPB",        value: "MPB",        cls: "border-violet-500 text-violet-700 bg-violet-50" },
  { label: "Axé",        value: "Axé",        cls: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  { label: "Rock",       value: "Rock",       cls: "border-red-500 text-red-700 bg-red-50" },
  { label: "Pop",        value: "Pop",        cls: "border-pink-500 text-pink-700 bg-pink-50" },
  { label: "Funk",       value: "Funk",       cls: "border-fuchsia-500 text-fuchsia-700 bg-fuchsia-50" },
  { label: "Eletrônica", value: "Eletrônica", cls: "border-blue-500 text-blue-700 bg-blue-50" },
  { label: "Reggae",     value: "Reggae",     cls: "border-lime-500 text-lime-700 bg-lime-50" },
  { label: "Bossa Nova", value: "Bossa Nova", cls: "border-amber-500 text-amber-700 bg-amber-50" },
  { label: "Sertanejo",  value: "Sertanejo",  cls: "border-stone-500 text-stone-700 bg-stone-50" },
  { label: "Hip-Hop",    value: "Hip-Hop",    cls: "border-indigo-500 text-indigo-700 bg-indigo-50" },
  { label: "Jazz",       value: "Jazz",       cls: "border-cyan-500 text-cyan-700 bg-cyan-50" },
];

export default function AdminView() {
  const { slug } = useParams<{ slug: string }>();

  const [adminAuthed, setAdminAuthed] = useState(() =>
    sessionStorage.getItem(`caipa_admin_auth_${slug}`) === "true"
  );
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const handleAdminLogin = async () => {
    if (!slug) return;
    setLoginLoading(true);
    setLoginError(false);
    const { data } = await supabase
      .from("bars")
      .select("admin_password")
      .eq("slug", slug)
      .maybeSingle();
    const storedPwd = data?.admin_password ?? slug;
    if (loginUsername === slug && loginPassword === storedPwd) {
      sessionStorage.setItem(`caipa_admin_auth_${slug}`, "true");
      setAdminAuthed(true);
    } else {
      setLoginError(true);
    }
    setLoginLoading(false);
  };

  const [activeTab, setActiveTab] = useState<"queue" | "settings" | "share" | "history" | "moderation">("queue");
  const [copied, setCopied] = useState(false);
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  // Admin "escolhe" search
  const [adminSearch, setAdminSearch] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<any[]>([]);
  const [isAdminSearching, setIsAdminSearching] = useState(false);
  const [showAdminSearch, setShowAdminSearch] = useState(false);

  // Played history
  const [playedHistory, setPlayedHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Moderation
  const [modModal, setModModal] = useState<{
    type: "veto" | "remove"; itemId: string; itemTitle: string; itemArtist: string;
  } | null>(null);
  const [modReason, setModReason] = useState("");
  const [modLogs, setModLogs] = useState<any[]>([]);
  const [modLoading, setModLoading] = useState(false);

  // Bar theme colors
  const [barColors, setBarColors] = useState({ primary: "#336580", accent: "#D1DC5A" });
  const [colorsSaved, setColorsSaved] = useState(false);

  // Bar logo
  const [barLogo, setBarLogo] = useState("");
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // Encerrar confirmation
  const [encerrarConfirm, setEncerrarConfirm] = useState(false);

  const { queue, veto, vote, removeItem, jumpToTop, advanceQueue } = useQueue(slug);
  const { session: config, updateSession: updateConfig } = useSession(slug);
  const { deviceId, isReady, playerState, togglePlay, nextTrack } = useSpotifyPlayer(loggedIn);

  const nowPlaying = queue[0] ?? null;
  const others = queue.slice(1);
  const barName = slug?.toUpperCase().replace("-", " ") || "MEU BAR";
  const spotifyDesync = !!(playerState?.uri && nowPlaying?.spotify_uri && playerState.uri !== nowPlaying.spotify_uri);

  useEffect(() => {
    if (!isReady || !deviceId || !nowPlaying?.spotify_uri) return;
    spotifyPlay(nowPlaying.spotify_uri, deviceId).catch(console.error);
  }, [nowPlaying?.id, isReady, deviceId]);

  useEffect(() => {
    if (!isReady || !deviceId || !slug) return;
    getValidToken().then(token => {
      if (token) {
        updateConfig({
          spotify_token: token,
          spotify_device_name: `${barName} (Tocaí)`,
        });
      }
    });
  }, [isReady, deviceId, slug]);

  // Load bar theme colors + logo on mount
  useEffect(() => {
    if (!slug) return;
    supabase.from("bars").select("theme_primary,theme_accent,logo_url").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const p = data.theme_primary || "#336580";
          const a = data.theme_accent  || "#D1DC5A";
          setBarColors({ primary: p, accent: a });
          document.documentElement.style.setProperty("--color-brand-blue", p);
          document.documentElement.style.setProperty("--color-brand-lime", a);
          setBarLogo(data.logo_url || "");
        }
      });
  }, [slug]);

  // Load moderation logs when tab activated
  useEffect(() => {
    if (activeTab !== "moderation" || !slug) return;
    setModLoading(true);
    supabase.from("moderation_logs")
      .select("*").eq("bar_slug", slug)
      .order("logged_at", { ascending: false }).limit(100)
      .then(({ data }) => { setModLogs(data ?? []); setModLoading(false); });
  }, [activeTab, slug]);

  // Load played history when tab is activated
  useEffect(() => {
    if (activeTab !== "history" || !slug) return;
    setHistoryLoading(true);
    supabase
      .from("queue_items")
      .select("*")
      .eq("bar_slug", slug)
      .eq("status", "played")
      .order("requested_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setPlayedHistory(data ?? []);
        setHistoryLoading(false);
      });
  }, [activeTab, slug]);

  function handleLogout() {
    logout();
    setLoggedIn(false);
    updateConfig({ spotify_token: undefined, spotify_device_name: undefined });
  }

  function handleLogin() {
    initiateLogin(`/admin/${slug}`);
  }

  const progress =
    playerState && playerState.duration > 0
      ? (playerState.position / playerState.duration) * 100
      : 0;

  const isPlaying = playerState ? !playerState.is_paused : false;

  // Time remaining
  const timeRemaining = playerState && playerState.duration > 0
    ? Math.max(0, Math.floor((playerState.duration - playerState.position) / 1000))
    : null;

  async function handleSkip() {
    await advanceQueue();
  }

  async function handleTogglePlay() {
    if (!deviceId) return;
    if (isPlaying) {
      await spotifyPause(deviceId).catch(console.error);
    } else {
      await spotifyResume(deviceId).catch(console.error);
    }
    togglePlay();
  }

  // Admin search
  const handleAdminSearch = async () => {
    if (!adminSearch.trim()) return;
    setIsAdminSearching(true);
    const results = await searchMusic(adminSearch);
    setAdminSearchResults(results);
    setIsAdminSearching(false);
    setShowAdminSearch(true);
  };

  const handleAdminAddTrack = async (music: any) => {
    if (!slug) return;
    const maxScore = queue.reduce((max, i) => Math.max(max, i.score), 0) + 100;
    const { tags } = await getTrackInfo(music.artist, music.title);
    await supabase.from("queue_items").insert({
      bar_slug: slug,
      client_name: "Admin",
      client_id: "admin",
      title: music.title,
      artist: music.artist,
      thumbnail_url: music.thumb || "",
      spotify_uri: music.spotify_uri ?? null,
      preview_url: music.preview_url ?? null,
      external_urls: music.external_urls ?? null,
      tags,
      score: maxScore,
      status: "pending",
    });
    setShowAdminSearch(false);
    setAdminSearch("");
    setAdminSearchResults([]);
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !slug) return;
    setLogoUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${slug}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) {
      alert(`Erro ao enviar logo: ${error.message}\n\nCrie um bucket público chamado "logos" no Supabase Storage.`);
      setLogoUploading(false);
      return;
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setBarLogo(data.publicUrl);
    setLogoUploading(false);
  };

  const handleSaveLogo = async () => {
    if (!slug) return;
    await supabase.from("bars").update({ logo_url: barLogo || null }).eq("slug", slug);
    setLogoSaved(true);
    setTimeout(() => setLogoSaved(false), 2000);
  };

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!adminAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-bento bg-white p-12 w-full max-w-sm text-center"
        >
          <div className="mb-6 flex justify-center text-brand-blue">
            <ShieldCheck size={64} strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-display text-brand-blue mb-1 leading-none">ADMIN</h1>
          <p className="font-body text-sm font-bold uppercase opacity-60 mb-2 italic">
            {slug?.toUpperCase()}
          </p>
          <p className="font-body text-xs font-bold uppercase opacity-40 mb-8">
            Usuário: slug do bar &nbsp;•&nbsp; Senha: definida no cadastro
          </p>
          <input
            type="text"
            placeholder="USUÁRIO (slug do bar)"
            value={loginUsername}
            onChange={e => { setLoginUsername(e.target.value); setLoginError(false); }}
            onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
            className="w-full border-4 border-brand-blue p-4 font-display text-xl uppercase focus:outline-none focus:bg-brand-cream/30 mb-3"
            autoFocus
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="SENHA"
            value={loginPassword}
            onChange={e => { setLoginPassword(e.target.value); setLoginError(false); }}
            onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
            className="w-full border-4 border-brand-blue p-4 font-display text-xl uppercase focus:outline-none focus:bg-brand-cream/30 mb-4"
            autoComplete="current-password"
          />
          {loginError && (
            <p className="font-body text-sm font-bold uppercase text-red-600 mb-4">
              Usuário ou senha incorretos.
            </p>
          )}
          <button
            onClick={handleAdminLogin}
            disabled={loginLoading}
            className="btn-bento w-full text-2xl disabled:opacity-50"
          >
            <Lock size={18} className="inline mr-2" />
            {loginLoading ? "VERIFICANDO..." : "ENTRAR"}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream lg:flex-row">
      {/* Sidebar */}
      <nav className="fixed bottom-0 z-50 flex h-20 w-full border-t-4 border-brand-blue bg-white lg:static lg:flex lg:h-screen lg:w-64 lg:flex-col lg:border-r-4 lg:border-t-0 p-4 shadow-2xl">
        <div className="hidden lg:mb-8 lg:block">
          <h1 className="text-5xl font-display text-brand-blue leading-none">TOCAÍ</h1>
          <p className="font-body text-sm font-bold opacity-60 uppercase">DASHBOARD</p>
        </div>

        <div className="flex w-full justify-around gap-2 lg:flex-col lg:justify-start">
          <NavBtn active={activeTab === "queue"} icon={<List />} label="FILA" onClick={() => setActiveTab("queue")} />
          <NavBtn active={activeTab === "history"} icon={<History />} label="HIST." onClick={() => setActiveTab("history")} />
          <NavBtn active={activeTab === "moderation"} icon={<ClipboardList />} label="MOD." onClick={() => setActiveTab("moderation")} />
          <NavBtn active={activeTab === "settings"} icon={<Settings />} label="CONFIG" onClick={() => setActiveTab("settings")} />
          <NavBtn active={activeTab === "share"} icon={<Share2 />} label="LINK" onClick={() => setActiveTab("share")} />

          <div className="hidden lg:mt-auto lg:block space-y-3">
            {loggedIn ? (
              <div className="space-y-2">
                <div className={cn(
                  "flex items-center gap-2 border-4 px-4 py-2 font-display text-lg",
                  isReady
                    ? "border-green-500 text-green-600 bg-green-50"
                    : "border-yellow-500 text-yellow-600 bg-yellow-50"
                )}>
                  {isReady ? <Wifi size={18} /> : <WifiOff size={18} />}
                  <span className="leading-none uppercase text-sm">
                    {isReady ? "DEVICE PRONTO" : "CONECTANDO..."}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 border-4 border-brand-blue/30 p-3 font-display text-base transition-all uppercase leading-none text-brand-blue/60 hover:border-brand-blue hover:text-brand-blue"
                >
                  <LogOut size={18} /> SPOTIFY
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex w-full items-center gap-3 border-4 border-green-600 bg-green-600 text-white p-4 font-display text-xl transition-all uppercase leading-none hover:bg-green-700 shadow-[4px_4px_0px_rgba(0,100,0,0.3)]"
              >
                <LogIn size={22} /> LOGIN SPOTIFY
              </button>
            )}

            {/* Fila bloqueada toggle */}
            <button
              onClick={() => updateConfig({ queue_locked: !config.queue_locked })}
              className={cn(
                "flex w-full items-center gap-3 border-4 p-4 font-display text-xl transition-all uppercase leading-none",
                config.queue_locked
                  ? "border-orange-500 text-orange-600 bg-orange-50"
                  : "border-brand-blue/40 text-brand-blue/60 bg-white hover:border-brand-blue hover:text-brand-blue"
              )}
            >
              {config.queue_locked ? <><Unlock size={22} /> ABRIR FILA</> : <><LockIcon size={22} /> FECHAR FILA</>}
            </button>

            <a
              href={`/stats/${slug}`}
              className="flex w-full items-center gap-3 border-4 border-brand-blue/30 p-3 font-display text-base transition-all uppercase leading-none text-brand-blue/60 hover:border-brand-blue hover:text-brand-blue"
            >
              <BarChart2 size={18} /> ESTATÍSTICAS
            </a>
            {encerrarConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={() => { updateConfig({ is_active: false }); setEncerrarConfirm(false); }}
                  className="flex-1 border-4 border-red-600 bg-red-600 text-white p-3 font-display text-base uppercase leading-none"
                >
                  CONFIRMAR
                </button>
                <button
                  onClick={() => setEncerrarConfirm(false)}
                  className="flex-1 border-4 border-brand-blue/40 text-brand-blue/60 bg-white p-3 font-display text-base uppercase leading-none"
                >
                  CANCELAR
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEncerrarConfirm(true)}
                className="flex w-full items-center gap-3 border-4 border-red-500 text-red-500 bg-red-50 p-4 font-display text-xl transition-all uppercase leading-none hover:bg-red-100"
              >
                <Power size={24} /> ENCERRAR
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 p-4 pb-24 lg:p-8">
        <header className="mb-8 flex items-center justify-between border-b-4 border-brand-blue pb-4">
          <div>
            <h2 className="text-5xl font-display text-brand-blue leading-none">{barName}</h2>
            {config.queue_locked && (
              <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-orange-600 bg-orange-50 border border-orange-300 px-2 py-0.5 mt-1">
                <LockIcon size={10} /> Fila Fechada
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              {loggedIn ? (
                <div className={cn(
                  "flex items-center gap-1 border-2 px-3 py-1 font-display text-sm uppercase",
                  isReady ? "border-green-500 text-green-600" : "border-yellow-500 text-yellow-600"
                )}>
                  {isReady ? <Wifi size={14} /> : <WifiOff size={14} />}
                  {isReady ? "PRONTO" : "..."}
                </div>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-1 border-2 border-green-600 bg-green-600 text-white px-3 py-1 font-display text-sm uppercase"
                >
                  <LogIn size={14} /> SPOTIFY
                </button>
              )}
            </div>
            <div className="lg:hidden">
              <button
                onClick={() => updateConfig({ queue_locked: !config.queue_locked })}
                className={cn(
                  "rounded-full p-3 transition-all",
                  config.queue_locked ? "bg-orange-500 text-white" : "bg-brand-blue/20 text-brand-blue"
                )}
                title={config.queue_locked ? "Abrir fila" : "Fechar fila"}
              >
                {config.queue_locked ? <Unlock size={20} /> : <LockIcon size={20} />}
              </button>
            </div>
          </div>
        </header>

        {!loggedIn && (
          <div className="mb-6 border-4 border-yellow-500 bg-yellow-50 p-6 flex items-center gap-4">
            <WifiOff size={32} className="text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-display text-2xl text-yellow-700 uppercase leading-none">SPOTIFY DESCONECTADO</p>
              <p className="font-body text-sm font-bold uppercase opacity-70 mt-1">
                Faça login com Spotify para este dispositivo tocar as músicas da fila.
              </p>
            </div>
            <button onClick={handleLogin} className="ml-auto flex-shrink-0 flex items-center gap-2 bg-green-600 text-white border-4 border-green-700 px-4 py-3 font-display text-xl uppercase shadow-[4px_4px_0px_rgba(0,100,0,0.3)]">
              <LogIn size={20} /> CONECTAR
            </button>
          </div>
        )}

        {/* ── QUEUE TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "queue" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Now Playing */}
            <div className="card-bento bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-4xl font-display leading-none underline decoration-brand-lime decoration-8 underline-offset-4">
                  TOCANDO AGORA
                </h3>
                <span className="bg-brand-blue px-3 py-1 font-display text-2xl text-brand-lime animate-pulse shadow-[4px_4px_0px_var(--color-brand-lime)]">
                  LIVE
                </span>
              </div>

              {nowPlaying ? (
                <div className="flex items-center gap-6 border-4 border-brand-blue p-6 bg-brand-cream/20">
                  {nowPlaying.thumbnail_url ? (
                    <img
                      src={nowPlaying.thumbnail_url}
                      alt={nowPlaying.title}
                      className="h-20 w-20 object-cover border-2 border-brand-blue flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center bg-brand-blue text-brand-lime shadow-[6px_6px_0px_var(--color-brand-lime)] flex-shrink-0">
                      <Music size={32} />
                    </div>
                  )}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-4xl font-display leading-none uppercase truncate tracking-tighter">
                      {nowPlaying.title}
                    </p>
                    <p className="font-body text-xl uppercase font-black opacity-60 leading-tight truncate italic">
                      {nowPlaying.artist} • @{nowPlaying.client_name}
                    </p>
                    {nowPlaying.dedication_to && (
                      <p className="text-sm font-bold uppercase text-pink-600 italic mt-1">
                        ❤️ Para {nowPlaying.dedication_to}
                      </p>
                    )}

                    {isReady ? (
                      <div className="mt-3 space-y-1">
                        <div className="h-2 bg-brand-blue/20 w-full">
                          <motion.div
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                            className="h-full bg-brand-lime"
                          />
                        </div>
                        {timeRemaining !== null && (
                          <p className="text-[11px] font-bold uppercase text-brand-blue/60">
                            ⏱ {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')} restantes
                          </p>
                        )}
                        {spotifyDesync && (
                          <p className="text-[11px] font-bold uppercase text-orange-600 bg-orange-50 border border-orange-300 px-2 py-0.5 inline-block mt-1">
                            ⚠ Spotify tocando música diferente da fila — use PULAR para sincronizar
                          </p>
                        )}
                      </div>
                    ) : loggedIn ? (
                      <div className="mt-3 space-y-1">
                        <div className="h-2 bg-brand-blue/20 w-full animate-pulse" />
                        <p className="text-[11px] font-bold uppercase text-brand-blue/40">⏳ Conectando ao dispositivo Spotify...</p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <p className="text-[11px] font-bold uppercase text-brand-blue/40">Conecte o Spotify para ver progresso da faixa</p>
                      </div>
                    )}

                    {!nowPlaying.spotify_uri && (
                      <p className="mt-2 text-xs font-bold uppercase text-yellow-600 bg-yellow-50 border border-yellow-300 px-2 py-1 inline-block">
                        ⚠ Sem URI Spotify — playback manual necessário
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {isReady && nowPlaying.spotify_uri && (
                      <button
                        onClick={handleTogglePlay}
                        className="flex items-center gap-2 bg-brand-blue text-brand-lime px-4 py-2 font-display text-lg border-2 border-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-lime)] transition-all"
                      >
                        {isPlaying ? <><Pause size={18} /> PAUSAR</> : <><Play size={18} fill="currentColor" /> TOCAR</>}
                      </button>
                    )}
                    <button
                      onClick={handleSkip}
                      className="flex items-center gap-2 bg-white text-brand-blue px-4 py-2 font-display text-lg border-2 border-brand-blue shadow-[4px_4px_0px_var(--color-brand-blue)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-blue)] transition-all"
                    >
                      <SkipForward size={18} /> PULAR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-4 border-dashed border-brand-blue bg-white/50 p-12 text-center">
                  <p className="font-body text-2xl opacity-40 uppercase font-black">Fila vazia...</p>
                </div>
              )}
            </div>

            {/* Admin escolhe — add track at top */}
            <div className="card-bento bg-brand-blue/5 p-6">
              <h3 className="text-3xl font-display uppercase italic mb-4 border-l-8 border-brand-lime pl-4">
                ADMIN ESCOLHE
              </h3>
              <div className="relative flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Buscar e adicionar com score máximo..."
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAdminSearch()}
                  className="flex-1 border-4 border-brand-blue p-4 font-display text-2xl uppercase tracking-tighter placeholder:text-brand-blue/30 focus:outline-none bg-white"
                />
                <button
                  onClick={handleAdminSearch}
                  className="bg-brand-blue text-brand-lime p-4 border-2 border-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                >
                  {isAdminSearching
                    ? <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-lime border-t-transparent" />
                    : <Search size={24} />
                  }
                </button>
              </div>

              {showAdminSearch && adminSearchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {adminSearchResults.map(track => {
                    const alreadyInQueue = queue.some(q =>
                      q.spotify_uri === track.spotify_uri ||
                      (q.title.toLowerCase() === track.title.toLowerCase() && q.artist.toLowerCase() === track.artist.toLowerCase())
                    );
                    return (
                    <div key={track.id} className={cn("flex items-center gap-3 p-3 border-2 bg-white", alreadyInQueue ? "border-orange-400 bg-orange-50" : "border-brand-blue")}>
                      {track.thumb && (
                        <img src={track.thumb} alt={track.title} className="h-10 w-10 object-cover border border-brand-blue flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-lg leading-none uppercase truncate">{track.title}</p>
                        <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{track.artist}</p>
                        {alreadyInQueue && (
                          <p className="text-[10px] font-bold uppercase text-orange-600 mt-0.5">já na fila</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdminAddTrack(track)}
                        disabled={alreadyInQueue}
                        className={cn(
                          "flex items-center gap-1 border-2 px-3 py-1.5 font-display text-sm uppercase flex-shrink-0 transition-all",
                          alreadyInQueue
                            ? "border-orange-400 text-orange-400 bg-orange-50 cursor-not-allowed opacity-60"
                            : "bg-brand-lime text-brand-blue border-brand-blue shadow-[2px_2px_0px_var(--color-brand-blue)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                        )}
                      >
                        <Plus size={14} /> TOPO
                      </button>
                    </div>
                  );
                  })}
                  <button
                    onClick={() => { setShowAdminSearch(false); setAdminSearchResults([]); setAdminSearch(""); }}
                    className="text-xs font-bold uppercase text-brand-blue/60 hover:text-brand-blue w-full text-center py-2"
                  >
                    FECHAR BUSCA
                  </button>
                </div>
              )}
            </div>

            {/* Queue */}
            <div className="space-y-6">
              <h3 className="text-4xl font-display uppercase italic border-l-8 border-brand-blue pl-4">
                Próximos da Fila ({others.length})
              </h3>
              {others.map(item => (
                <AdminQueueItem
                  key={item.id}
                  {...item}
                  currentTheme={config.theme}
                  onVeto={() => setModModal({ type: "veto", itemId: item.id, itemTitle: item.title, itemArtist: item.artist })}
                  onVote={() => vote(item.id, "admin")}
                  onRemove={() => setModModal({ type: "remove", itemId: item.id, itemTitle: item.title, itemArtist: item.artist })}
                  onPlayNow={async () => {
                    await jumpToTop(item.id);
                    if (isReady && deviceId && item.spotify_uri) {
                      spotifyPlay(item.spotify_uri, deviceId).catch(console.error);
                    }
                  }}
                />
              ))}
              {others.length === 0 && (
                <p className="font-body text-2xl opacity-40 uppercase font-black py-20 text-center border-4 border-dashed border-brand-blue bg-white/50">
                  A fila está vazia...
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── HISTORY TAB ────────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h3 className="text-4xl font-display uppercase italic border-l-8 border-brand-blue pl-4">
              Músicas Tocadas ({playedHistory.length})
            </h3>
            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
              </div>
            ) : playedHistory.length === 0 ? (
              <div className="border-4 border-dashed border-brand-blue bg-white/50 p-20 text-center">
                <p className="font-display text-3xl uppercase opacity-40">Nenhuma música tocada ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playedHistory.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border-4 border-brand-blue bg-white shadow-[4px_4px_0px_var(--color-brand-blue)]">
                    <span className="font-display text-3xl text-brand-blue/30 leading-none w-8 text-center">{idx + 1}</span>
                    {item.thumbnail_url && (
                      <img src={item.thumbnail_url} alt={item.title} className="h-12 w-12 object-cover border-2 border-brand-blue flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-2xl leading-none uppercase truncate">{item.title}</p>
                      <p className="font-body text-sm font-bold uppercase opacity-60 italic truncate">{item.artist}</p>
                      {item.dedication_to && (
                        <p className="text-[10px] font-bold uppercase text-pink-500 italic">❤️ Para {item.dedication_to}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display text-sm uppercase text-brand-blue/60">@{item.client_name}</p>
                      {item.requested_at && (
                        <p className="text-[10px] font-bold uppercase opacity-40">
                          {new Date(item.requested_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── MODERATION TAB ─────────────────────────────────────────────────── */}
        {activeTab === "moderation" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-display uppercase italic border-l-8 border-brand-blue pl-4">
                Log de Moderação ({modLogs.length})
              </h3>
            </div>
            {modLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
              </div>
            ) : modLogs.length === 0 ? (
              <div className="border-4 border-dashed border-brand-blue bg-white/50 p-20 text-center">
                <p className="font-display text-3xl uppercase opacity-40">Nenhuma ação de moderação ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {modLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 p-4 border-4 border-brand-blue bg-white shadow-[4px_4px_0px_var(--color-brand-blue)]">
                    <div className={cn(
                      "flex-shrink-0 px-3 py-1 border-2 font-display text-sm uppercase",
                      log.action === "veto"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-red-500 bg-red-50 text-red-700",
                    )}>
                      {log.action === "veto" ? "VETADO" : "REMOVIDO"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-2xl leading-none uppercase truncate">{log.item_title}</p>
                      <p className="font-body text-sm font-bold uppercase opacity-60 italic truncate">{log.item_artist}</p>
                      {log.reason && (
                        <p className="text-xs font-bold uppercase text-brand-blue/60 mt-0.5 italic">Motivo: {log.reason}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      <p className="font-display text-sm uppercase text-brand-blue/60">@{log.client_name}</p>
                      <p className="text-[10px] font-bold uppercase opacity-40">
                        {new Date(log.logged_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <button
                        onClick={() => {
                          const cur = config.blocked_artists;
                          if (log.item_artist && !cur.some((a: string) => a.toLowerCase() === log.item_artist.toLowerCase())) {
                            updateConfig({ blocked_artists: [...cur, log.item_artist] });
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 hover:text-red-800 border border-red-300 px-2 py-0.5"
                        title="Adicionar artista à lista negra"
                      >
                        <Ban size={10} /> LISTA NEGRA
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── SHARE TAB ──────────────────────────────────────────────────────── */}
        {activeTab === "share" && (() => {
          const clientUrl = `${window.location.origin}/${slug}`;
          const handleCopy = () => {
            navigator.clipboard.writeText(clientUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          };
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-xl">
              <div className="card-bento p-8">
                <h3 className="mb-2 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-block">
                  LINK DO BAR
                </h3>
                <p className="mb-6 font-body text-xs font-bold uppercase opacity-50 italic">
                  Compartilhe com seus clientes para eles pedirem músicas
                </p>

                <div className="border-4 border-brand-blue bg-brand-cream/40 p-4 flex items-center gap-3 mb-4">
                  <span className="flex-1 font-body text-base font-bold break-all select-all">{clientUrl}</span>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-2 border-4 px-4 py-3 font-display text-lg uppercase transition-all",
                      copied
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-brand-blue bg-white text-brand-blue hover:bg-brand-blue hover:text-white"
                    )}
                  >
                    {copied ? <><CheckCheck size={18} /> COPIADO</> : <><Copy size={18} /> COPIAR</>}
                  </button>
                </div>

                <div className="flex justify-center p-6 border-4 border-brand-blue bg-white">
                  <QRCodeSVG value={clientUrl} size={240} bgColor="#ffffff" fgColor="#0a1628" level="H" />
                </div>
                <p className="mt-4 font-body text-xs font-bold uppercase opacity-50 text-center">
                  Aponte a câmera do celular para o QR Code
                </p>
              </div>
            </motion.div>
          );
        })()}

        {/* ── SETTINGS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="space-y-8 max-w-3xl">
            {/* Theme */}
            <div className="card-bento p-8">
              <h3 className="mb-2 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-block">
                TEMA DA NOITE
              </h3>
              <p className="mb-6 font-body text-xs font-bold uppercase opacity-50 italic">
                Selecione o gênero — músicas com essa tag entram com +1 na fila
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {GENRE_TAGS.map(genre => {
                  const isActive = config.theme === genre.value;
                  return (
                    <button
                      key={genre.value}
                      onClick={() => updateConfig({ theme: genre.value })}
                      className={cn(
                        "border-4 px-5 py-2 font-display text-2xl uppercase tracking-tight transition-all",
                        isActive
                          ? cn(genre.cls, "shadow-[4px_4px_0px_var(--color-brand-blue)] translate-x-[-2px] translate-y-[-2px] border-opacity-100 font-black")
                          : cn(genre.cls, "opacity-50 hover:opacity-80"),
                      )}
                    >
                      {isActive && <Tag size={14} className="inline mr-1 mb-0.5" />}
                      {genre.label}
                    </button>
                  );
                })}
              </div>
              <div className="border-4 border-brand-blue bg-brand-cream/50 px-6 py-4 flex items-center gap-4">
                <Tag size={24} className="text-brand-blue flex-shrink-0" />
                <div>
                  <p className="font-display text-3xl uppercase leading-none">{config.theme}</p>
                  <p className="font-body text-xs font-bold uppercase opacity-60 italic mt-1">
                    {config.theme === "Livre"
                      ? "Sem tema — todas as músicas entram com score 0"
                      : `Músicas com tag "${config.theme}" entram com +1 na fila`}
                  </p>
                </div>
              </div>
            </div>

            {/* Queue control */}
            <div className="card-bento p-8 bg-brand-blue/5">
              <h3 className="mb-6 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-block">
                CONTROLE DE PEDIDOS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">
                    PEDIDOS INICIAIS POR PESSOA
                  </label>
                  <input
                    type="number" min={1} max={20}
                    className="border-4 border-brand-blue p-4 font-display text-4xl text-center focus:outline-none bg-white"
                    value={config.max_initial_requests}
                    onChange={e => updateConfig({ max_initial_requests: Math.max(1, parseInt(e.target.value) || 5) })}
                    onBlur={e => updateConfig({ max_initial_requests: Math.max(1, parseInt(e.target.value) || 5) })}
                  />
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic">Pedidos sem espera (padrão: 5)</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">
                    COOLDOWN APÓS O LIMITE (MINUTOS)
                  </label>
                  <input
                    type="number" min={1} max={60}
                    className="border-4 border-brand-blue p-4 font-display text-4xl text-center focus:outline-none bg-white"
                    value={config.request_cooldown_minutes}
                    onChange={e => updateConfig({ request_cooldown_minutes: Math.max(1, parseInt(e.target.value) || 3) })}
                    onBlur={e => updateConfig({ request_cooldown_minutes: Math.max(1, parseInt(e.target.value) || 3) })}
                  />
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic">Espera entre pedidos extras (padrão: 3)</p>
                </div>
              </div>

              {/* Fila bloqueada toggle */}
              <div className="flex items-center justify-between border-4 border-brand-blue bg-white p-5">
                <div>
                  <p className="font-display text-2xl uppercase leading-none">Fechar Fila</p>
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic mt-1">
                    Bloqueia novos pedidos sem encerrar a sessão
                  </p>
                </div>
                <button
                  onClick={() => updateConfig({ queue_locked: !config.queue_locked })}
                  className={cn(
                    "flex items-center gap-2 border-4 px-5 py-3 font-display text-xl uppercase transition-all",
                    config.queue_locked
                      ? "border-orange-500 bg-orange-500 text-white shadow-[4px_4px_0px_rgba(234,88,12,0.5)]"
                      : "border-brand-blue bg-brand-blue text-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)]"
                  )}
                >
                  {config.queue_locked ? <><Unlock size={18} /> ABRIR</> : <><LockIcon size={18} /> FECHAR</>}
                </button>
              </div>

              {/* Dedicatórias toggle */}
              <div className="flex items-center justify-between border-4 border-brand-blue bg-white p-5 mt-4">
                <div>
                  <p className="font-display text-2xl uppercase leading-none">Modo "Dedico pra"</p>
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic mt-1">
                    Permite dedicar músicas a alguém — aparece na TV e na fila
                  </p>
                </div>
                <button
                  onClick={() => updateConfig({ enable_dedications: !config.enable_dedications })}
                  className={cn(
                    "flex items-center gap-2 border-4 px-5 py-3 font-display text-xl uppercase transition-all",
                    config.enable_dedications
                      ? "border-pink-500 bg-pink-500 text-white shadow-[4px_4px_0px_rgba(236,72,153,0.5)]"
                      : "border-brand-blue/40 bg-white text-brand-blue/60 hover:border-brand-blue hover:text-brand-blue"
                  )}
                >
                  <Heart size={18} fill={config.enable_dedications ? "currentColor" : "none"} />
                  {config.enable_dedications ? "ATIVADO" : "ATIVAR"}
                </button>
              </div>
            </div>

            {/* Tema customizável */}
            <div className="card-bento p-8">
              <h3 className="mb-2 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-block flex items-center gap-3">
                <Palette size={28} className="inline" /> CORES DO BAR
              </h3>
              <p className="mb-6 font-body text-xs font-bold uppercase opacity-50 italic">
                Personaliza ClientView e QueueTV. Preview ao vivo nesta tela.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="flex flex-col gap-2">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">COR PRINCIPAL</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={barColors.primary}
                      onChange={e => {
                        const v = e.target.value;
                        setBarColors(prev => ({ ...prev, primary: v }));
                        document.documentElement.style.setProperty("--color-brand-blue", v);
                      }}
                      className="h-14 w-14 border-4 border-brand-blue cursor-pointer p-1"
                    />
                    <span className="font-display text-2xl uppercase">{barColors.primary}</span>
                  </div>
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic">Fundo, bordas e texto principal</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">COR DE DESTAQUE</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={barColors.accent}
                      onChange={e => {
                        const v = e.target.value;
                        setBarColors(prev => ({ ...prev, accent: v }));
                        document.documentElement.style.setProperty("--color-brand-lime", v);
                      }}
                      className="h-14 w-14 border-4 border-brand-blue cursor-pointer p-1"
                    />
                    <span className="font-display text-2xl uppercase">{barColors.accent}</span>
                  </div>
                  <p className="font-body text-xs font-bold uppercase opacity-50 italic">Botões, tags e destaques</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!slug) return;
                    await supabase.from("bars").update({
                      theme_primary: barColors.primary,
                      theme_accent: barColors.accent,
                    }).eq("slug", slug);
                    setColorsSaved(true);
                    setTimeout(() => setColorsSaved(false), 2000);
                  }}
                  className={cn(
                    "flex items-center gap-2 border-4 px-5 py-3 font-display text-xl uppercase transition-all",
                    colorsSaved
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-brand-blue bg-brand-blue text-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)]",
                  )}
                >
                  {colorsSaved ? <><CheckCheck size={18} /> SALVO!</> : "SALVAR CORES"}
                </button>
                <button
                  onClick={() => {
                    setBarColors({ primary: "#336580", accent: "#D1DC5A" });
                    document.documentElement.style.setProperty("--color-brand-blue", "#336580");
                    document.documentElement.style.setProperty("--color-brand-lime", "#D1DC5A");
                  }}
                  className="flex items-center gap-2 border-4 border-brand-blue/30 px-5 py-3 font-display text-xl uppercase text-brand-blue/60 hover:border-brand-blue hover:text-brand-blue transition-all"
                >
                  RESETAR
                </button>
              </div>
            </div>

            {/* Logo do Estabelecimento */}
            <div className="card-bento p-8">
              <h3 className="mb-2 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-flex items-center gap-3">
                <ImageIcon size={28} className="inline" /> LOGO DO BAR
              </h3>
              <p className="mb-6 font-body text-xs font-bold uppercase opacity-50 italic">
                Substitui o texto "TOCAÍ" na tela do cliente e na TV. PNG/JPG com fundo transparente recomendado.
              </p>

              {barLogo && (
                <div className="mb-4 border-4 border-brand-blue p-4 bg-brand-cream/40 flex items-center justify-center">
                  <img src={barLogo} alt="Logo preview" className="max-h-24 max-w-full object-contain" />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFile}
                    className="hidden"
                    id="logo-upload"
                  />
                  <label
                    htmlFor="logo-upload"
                    className={cn(
                      "cursor-pointer flex items-center gap-2 border-4 px-5 py-3 font-display text-xl uppercase transition-all",
                      logoUploading
                        ? "border-brand-blue/40 text-brand-blue/40 cursor-not-allowed"
                        : "border-brand-blue bg-white text-brand-blue hover:bg-brand-blue hover:text-brand-lime"
                    )}
                  >
                    <ImageIcon size={18} /> {logoUploading ? "ENVIANDO..." : "UPLOAD IMAGEM"}
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">
                    OU COLE UMA URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={barLogo}
                    onChange={e => setBarLogo(e.target.value)}
                    className="w-full border-2 border-brand-blue p-3 font-body text-base focus:outline-none bg-white"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveLogo}
                    className={cn(
                      "flex items-center gap-2 border-4 px-5 py-3 font-display text-xl uppercase transition-all",
                      logoSaved
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-brand-blue bg-brand-blue text-brand-lime shadow-[4px_4px_0px_var(--color-brand-lime)]",
                    )}
                  >
                    {logoSaved ? <><CheckCheck size={18} /> SALVO!</> : "SALVAR LOGO"}
                  </button>
                  {barLogo && (
                    <button
                      onClick={() => setBarLogo("")}
                      className="flex items-center gap-2 border-4 border-brand-blue/30 px-5 py-3 font-display text-xl uppercase text-brand-blue/60 hover:border-red-500 hover:text-red-600 transition-all"
                    >
                      REMOVER
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Blocklist */}
            <div className="card-bento p-8 bg-red-50/30 border-red-600 shadow-[8px_8px_0px_rgba(220,38,38,1)]">
              <h3 className="mb-6 text-4xl font-display text-red-600 leading-none italic underline decoration-red-600 decoration-4 underline-offset-8">
                LISTA NEGRA
              </h3>
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">
                    ARTISTAS BLOQUEADOS (separados por vírgula)
                  </label>
                  <input
                    className="w-full border-2 border-brand-blue p-3 font-body text-xl focus:border-brand-blue focus:outline-none bg-white"
                    placeholder="Sertanejo, Heavy Metal..."
                    value={config.blocked_artists.join(", ")}
                    onChange={e => updateConfig({ blocked_artists: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    onBlur={e => updateConfig({ blocked_artists: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase tracking-tight text-brand-blue/60">
                    PALAVRAS BLOQUEADAS (separadas por vírgula)
                  </label>
                  <input
                    className="w-full border-2 border-brand-blue p-3 font-body text-xl focus:border-brand-blue focus:outline-none bg-white"
                    placeholder="Remix, Piseiro, Live..."
                    value={config.blocked_keywords.join(", ")}
                    onChange={e => updateConfig({ blocked_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    onBlur={e => updateConfig({ blocked_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                  />
                </div>
              </div>
            </div>

            <div className="card-bento p-6 bg-brand-lime/20">
              <p className="font-body text-sm font-bold uppercase opacity-70">
                ✓ Configurações salvas no Supabase e sincronizadas em tempo real com todos os clientes.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Moderation reason modal */}
      {modModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-blue/80 p-6 backdrop-blur-sm">
          <div className="card-bento w-full max-w-sm bg-white p-8">
            <h3 className={cn(
              "text-4xl font-display leading-none mb-1",
              modModal.type === "veto" ? "text-yellow-700" : "text-red-700",
            )}>
              {modModal.type === "veto" ? "VETAR MÚSICA" : "REMOVER MÚSICA"}
            </h3>
            <p className="font-body text-sm font-bold uppercase italic opacity-60 mb-1">
              {modModal.itemTitle} · {modModal.itemArtist}
            </p>
            <p className="font-body text-xs uppercase opacity-40 mb-6">Motivo é opcional</p>
            <input
              autoFocus
              type="text"
              placeholder="Motivo (ex: fora do tema, ofensivo...)"
              value={modReason}
              onChange={e => setModReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (modModal.type === "veto") veto(modModal.itemId, modReason);
                  else removeItem(modModal.itemId, modReason);
                  setModModal(null); setModReason("");
                }
                if (e.key === "Escape") { setModModal(null); setModReason(""); }
              }}
              className="w-full border-4 border-brand-blue p-3 font-body text-lg focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setModModal(null); setModReason(""); }}
                className="btn-bento flex-1 text-lg opacity-60"
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  if (modModal.type === "veto") veto(modModal.itemId, modReason);
                  else removeItem(modModal.itemId, modReason);
                  setModModal(null); setModReason("");
                }}
                className={cn(
                  "flex-1 border-4 px-4 py-3 font-display text-xl uppercase transition-all",
                  modModal.type === "veto"
                    ? "border-yellow-500 bg-yellow-500 text-white shadow-[4px_4px_0px_rgba(234,179,8,0.5)]"
                    : "border-red-600 bg-red-600 text-white shadow-[4px_4px_0px_rgba(220,38,38,0.5)]",
                )}
              >
                {modModal.type === "veto" ? "VETAR" : "REMOVER"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 border-4 p-2 font-display transition-all lg:flex-row lg:gap-4 lg:p-4 lg:text-4xl lg:leading-none",
        active
          ? "border-brand-blue bg-brand-lime shadow-[6px_6px_0px_var(--color-brand-blue)] translate-x-[-2px] translate-y-[-2px]"
          : "border-transparent opacity-60",
      )}
    >
      <span className={active ? "scale-110" : ""}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function AdminQueueItem({
  title, artist, score, client_name, thumbnail_url, tags, dedication_to, currentTheme,
  onVeto, onVote, onRemove, onPlayNow,
}: any) {
  const itemTags: string[] = tags ?? [];
  const isThemeMatch = tagMatchesTheme(itemTags, currentTheme ?? '');

  return (
    <motion.div
      className="card-bento flex items-center justify-between p-6 bg-white group transition-shadow duration-200 hover:shadow-[8px_8px_0px_var(--color-brand-lime)]"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="flex items-center gap-4 flex-1 overflow-hidden">
        {thumbnail_url ? (
          <img src={thumbnail_url} alt={title} className="h-14 w-14 object-cover border-2 border-brand-blue flex-shrink-0" />
        ) : (
          <div className="h-14 w-14 flex items-center justify-center bg-brand-blue/10 border-2 border-brand-blue flex-shrink-0">
            <Music size={24} className="text-brand-blue/40" />
          </div>
        )}
        <div className="overflow-hidden min-w-0">
          <h5 className="text-3xl font-display leading-none uppercase truncate tracking-tighter">{title}</h5>
          <p className="font-body text-base font-black uppercase leading-tight truncate italic opacity-60">
            {artist} • @{client_name}
          </p>
          {dedication_to && (
            <p className="text-[10px] font-bold uppercase text-pink-500 italic">❤️ Para {dedication_to}</p>
          )}
          {itemTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {isThemeMatch && (
                <span className="bg-brand-lime text-brand-blue border border-brand-blue text-[10px] font-bold uppercase px-2 py-0.5 flex items-center gap-1">
                  <Tag size={9} /> TEMA
                </span>
              )}
              {itemTags.slice(0, 4).map(tag => (
                <span key={tag} className="bg-brand-blue/10 text-brand-blue/60 border border-brand-blue/20 text-[10px] font-bold uppercase px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-1">
          <ActionIcon icon={<Play size={24} fill="currentColor" />} label="TOCAR" color="text-brand-blue" onClick={onPlayNow} />
          <ActionIcon icon={<ShieldAlert size={24} />} label="VETO" color="text-yellow-600" onClick={onVeto} />
          <ActionIcon icon={<ArrowUpCircle size={24} />} label="VOTAR" color="text-green-600" onClick={onVote} />
          <ActionIcon icon={<Trash2 size={24} />} label="REMOVER" color="text-red-500" onClick={onRemove} />
        </div>
        <div className="ml-4 border-l-4 border-brand-blue pl-6 text-center">
          <span className="font-display text-6xl text-brand-blue leading-none">{score}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ActionIcon({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex flex-col items-center p-2 transition-all hover:scale-125 active:scale-90", color)}
    >
      {icon}
      <span className="hidden sm:block text-[10px] font-bold uppercase tracking-tighter leading-none mt-1">{label}</span>
    </button>
  );
}
