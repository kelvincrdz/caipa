import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Power, Settings, List, Trash2, ShieldAlert, ArrowUpCircle,
  Play, Music, SkipForward, Pause, Wifi, WifiOff, LogIn, LogOut,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useQueue } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { initiateLogin, isAdminLoggedIn, logout, getValidToken } from "../services/spotifyAuth";
import { play as spotifyPlay, pause as spotifyPause, resume as spotifyResume } from "../services/spotifyPlayback";

export default function AdminView() {
  const { slug } = useParams<{ slug: string }>();
  const [isActive, setIsActive] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "settings">("queue");
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn());

  const { queue, veto, vote, removeItem, jumpToTop, advanceQueue } = useQueue(slug);
  const { session: config, updateSession: updateConfig } = useSession(slug);
  const { deviceId, isReady, playerState, togglePlay, nextTrack } = useSpotifyPlayer(loggedIn);

  const nowPlaying = queue[0] ?? null;
  const others = queue.slice(1);
  const barName = slug?.toUpperCase().replace("-", " ") || "MEU BAR";

  // Auto-play when top of queue changes
  useEffect(() => {
    if (!isReady || !deviceId || !nowPlaying?.spotify_uri) return;
    spotifyPlay(nowPlaying.spotify_uri, deviceId).catch(console.error);
  }, [nowPlaying?.id, isReady, deviceId]);

  // Sync device name + token to session when SDK is ready
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

  // Clear device from session on logout
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

  async function handleSkip() {
    await advanceQueue();
    // next song auto-plays via useEffect above
  }

  async function handleTogglePlay() {
    if (!deviceId) return;
    if (isPlaying) {
      await spotifyPause(deviceId).catch(console.error);
    } else {
      await spotifyResume(deviceId).catch(console.error);
    }
    togglePlay(); // optimistic local state via SDK
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
          <NavBtn active={activeTab === "settings"} icon={<Settings />} label="TEMA" onClick={() => setActiveTab("settings")} />

          <div className="hidden lg:mt-auto lg:block space-y-3">
            {/* Spotify Auth */}
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

            <button
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "flex w-full items-center gap-3 border-4 p-4 font-display text-xl transition-all uppercase leading-none",
                isActive ? "border-red-500 text-red-500 bg-red-50" : "border-green-500 text-green-500 bg-green-50",
              )}
            >
              <Power size={24} /> {isActive ? "FECHAR" : "ABRIR"}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-4 pb-24 lg:p-8">
        <header className="mb-8 flex items-center justify-between border-b-4 border-brand-blue pb-4">
          <h2 className="text-5xl font-display text-brand-blue leading-none">{barName}</h2>
          <div className="flex items-center gap-3">
            {/* Mobile Spotify status */}
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
                onClick={() => setIsActive(!isActive)}
                className={cn("rounded-full p-3 transition-all", isActive ? "bg-red-500 text-white" : "bg-green-500 text-white")}
              >
                <Power size={24} />
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

                    {/* Spotify progress */}
                    {isReady && (
                      <div className="mt-3 h-2 bg-brand-blue/20 w-full">
                        <motion.div
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3 }}
                          className="h-full bg-brand-lime"
                        />
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

            {/* Queue */}
            <div className="space-y-6">
              <h3 className="text-4xl font-display uppercase italic border-l-8 border-brand-blue pl-4">
                Próximos da Fila ({others.length})
              </h3>
              {others.map(item => (
                <AdminQueueItem
                  key={item.id}
                  {...item}
                  onVeto={() => veto(item.id)}
                  onVote={() => vote(item.id, "admin")}
                  onRemove={() => removeItem(item.id)}
                  onJumpToTop={() => jumpToTop(item.id)}
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

        {activeTab === "settings" && (
          <div className="space-y-8 max-w-3xl">
            <div className="card-bento p-8">
              <h3 className="mb-6 text-4xl font-display leading-none tracking-tighter border-b-4 border-brand-blue pb-2 inline-block">
                TEMA DA NOITE
              </h3>
              <input
                className="w-full border-4 border-brand-blue p-6 font-display text-4xl uppercase focus:ring-8 focus:ring-brand-lime/30 outline-none bg-brand-cream/50"
                placeholder="EX: SAMBA E MPB"
                value={config.theme}
                onChange={e => updateConfig({ theme: e.target.value })}
                onBlur={e => updateConfig({ theme: e.target.value })}
              />
              <p className="mt-4 font-body text-base font-black uppercase opacity-60 italic">
                *Músicas do tema ganham +3 pontos automaticamente.
              </p>
            </div>

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
                    onChange={e =>
                      updateConfig({
                        blocked_artists: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })
                    }
                    onBlur={e =>
                      updateConfig({
                        blocked_artists: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })
                    }
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
                    onChange={e =>
                      updateConfig({
                        blocked_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })
                    }
                    onBlur={e =>
                      updateConfig({
                        blocked_keywords: e.target.value.split(",").map(s => s.trim()).filter(Boolean),
                      })
                    }
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
  title, artist, score, client_name, thumbnail_url,
  onVeto, onVote, onRemove, onJumpToTop,
}: any) {
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
        <div className="overflow-hidden">
          <h5 className="text-3xl font-display leading-none uppercase truncate tracking-tighter">
            {title}
          </h5>
          <p className="font-body text-base font-black uppercase leading-tight truncate italic opacity-60">
            {artist} • @{client_name}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <div className="flex items-center gap-1">
          <ActionIcon icon={<Play size={24} fill="currentColor" />} label="TOCAR" color="text-brand-blue" onClick={onJumpToTop} />
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
      <span className="text-[10px] font-bold uppercase tracking-tighter leading-none mt-1">{label}</span>
    </button>
  );
}
