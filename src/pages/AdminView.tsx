import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  List, Settings, BarChart2, Share2, History, Shield,
  Play, Pause, SkipForward, Volume2, VolumeX, Power,
  Trash2, GripVertical, Plus, Search, Music, User,
  ExternalLink, Copy, CheckCircle, XCircle, X
} from "lucide-react";
import { useQueue } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { initiateLogin, isAdminLoggedIn, logout, getSpotifyProfile } from "../services/spotifyAuth";
import { play as spotifyPlay, pause as spotifyPause, skip as spotifySkip } from "../services/spotifyPlayback";
import { supabase } from "../lib/supabase";
import { searchMusic } from "../services/musicService";

// ── Types ────────────────────────────────────────────────────────────────────
type TabType = "queue" | "settings" | "stats" | "share";

interface QueueItem {
  id: string;
  title: string;
  artist: string;
  thumbnail_url?: string;
  score: number;
  requested_by: string;
  requested_at: string;
}

// ── Componente de Sidebar ────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab, modoFesta, session }: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  modoFesta: boolean;
  session: any;
}) {
  const navItems: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: "queue", label: "Fila", icon: <List size={20} /> },
    { id: "stats", label: "Stats", icon: <BarChart2 size={20} /> },
    { id: "share", label: "Compartilhar", icon: <Share2 size={20} /> },
    { id: "settings", label: "Configurações", icon: <Settings size={20} /> },
  ];

  return (
    <div className="admin-sidebar">
      {/* Header */}
      <div className="p-6 border-b border-text-muted/20">
        <h1 className="font-display text-2xl text-white truncate">
          {session?.bar_name || "Admin"}
        </h1>
        <p className="font-label text-sm text-text-muted">
          Painel de controle
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span className="nav-text">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-text-muted/20">
        <Link
          to={`/${session?.slug}`}
          className="flex items-center gap-3 p-3 text-text-muted hover:text-white transition-colors"
        >
          <ExternalLink size={16} />
          <span className="nav-text font-label text-sm">Ver como cliente</span>
        </Link>
      </div>
    </div>
  );
}

// ── Componente de Item da Fila ───────────────────────────────────────────────
function ItemFila({
  item,
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isDragging,
  modoFesta
}: {
  item: QueueItem;
  index: number;
  onRemove: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isDragging?: boolean;
  modoFesta: boolean;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      layout
      className={`queue-row ${isDragging ? 'dragging' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Drag Handle */}
      <div className="flex items-center gap-3 flex-1">
        <GripVertical size={16} className="text-text-muted cursor-move" />

        <span className="text-primary font-bold text-sm w-8">
          {index + 1}
        </span>

        {/* Thumbnail */}
        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-surface-darker flex items-center justify-center">
              <Music size={16} className="text-primary" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-body font-medium text-white text-sm truncate">
            {item.title}
          </h4>
          <p className="font-label text-xs text-text-muted truncate">
            {item.artist}
          </p>
        </div>

        {/* Score */}
        {item.score > 0 && (
          <div className="flex items-center gap-1 text-primary">
            <span className="text-sm">⚡</span>
            <span className="font-body font-bold text-sm">{item.score}</span>
          </div>
        )}

        {/* Requested by */}
        <p className="font-label text-xs text-text-muted hidden md:block">
          ****{item.requested_by.slice(-4)}
        </p>
      </div>

      {/* Actions */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center gap-2"
          >
            <button
              onClick={() => onRemove(item.id)}
              className="p-2 text-red-500 hover:text-red-400 transition-colors"
              title="Remover da fila"
            >
              <Trash2 size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Componente do Player Spotify ─────────────────────────────────────────────
function PlayerSpotify({
  isPlaying,
  onPlayPause,
  onSkip,
  volume,
  onVolumeChange,
  modoFesta,
  onTogglePartyMode,
  spotifyConnected
}: {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSkip: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  modoFesta: boolean;
  onTogglePartyMode: () => void;
  spotifyConnected: boolean;
}) {
  if (!spotifyConnected) {
    return (
      <div className="spotify-controller">
        <div className="flex items-center justify-center flex-1">
          <button
            onClick={() => initiateLogin()}
            className="btn-primary text-lg"
          >
            Conectar Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="spotify-controller">
      {/* Playback Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={onPlayPause}
          className="p-3 bg-primary text-secondary rounded-full hover:bg-primary/90 transition-colors"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={onSkip}
          className="p-2 text-white hover:text-primary transition-colors"
        >
          <SkipForward size={20} />
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <Volume2 size={16} className="text-text-muted" />
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 h-2 bg-surface-dark rounded-lg appearance-none cursor-pointer"
        />
        <span className="font-label text-xs text-text-muted w-8">
          {volume}%
        </span>
      </div>

      {/* Party Mode Toggle */}
      <div className="flex items-center gap-3">
        <span className="font-label text-sm text-white">Modo Festa</span>
        <button
          onClick={onTogglePartyMode}
          className={`party-toggle ${modoFesta ? 'active' : ''}`}
        >
          <div className="party-toggle-thumb" />
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function AdminView() {
  const { slug } = useParams<{ slug: string }>();

  // Estados de autenticação
  const [adminAuthed, setAdminAuthed] = useState(() =>
    sessionStorage.getItem(`caipa_admin_auth_${slug}`) === "true"
  );
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Estados da interface
  const [activeTab, setActiveTab] = useState<TabType>("queue");
  const [spotifyConnected, setSpotifyConnected] = useState(isAdminLoggedIn());
  const [spotifyProfile, setSpotifyProfile] = useState<any>(null);

  // Estados do player
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);

  // Estados de pesquisa
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Hooks
  const { session, updateSession, loading: sessionLoading } = useSession(slug || "");
  const { queue, nowPlaying, removeFromQueue, addToQueue, updateScore } = useQueue(slug || "");
  const player = useSpotifyPlayer();

  const modoFesta = session?.party_mode || false;

  // Login de admin
  const handleAdminLogin = async () => {
    if (!slug) return;
    setLoginLoading(true);
    setLoginError(false);

    try {
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
    } catch (error) {
      setLoginError(true);
    } finally {
      setLoginLoading(false);
    }
  };

  // Toggle party mode
  const handleTogglePartyMode = async () => {
    if (!session) return;
    try {
      await updateSession({ party_mode: !modoFesta });
    } catch (error) {
      console.error("Erro ao alterar modo festa:", error);
    }
  };

  // Controles do Spotify
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await spotifyPause();
        setIsPlaying(false);
      } else {
        // Se há uma música na fila, tocar ela
        if (nowPlaying) {
          await spotifyPlay(nowPlaying.spotify_uri);
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Erro no play/pause:", error);
    }
  };

  const handleSkip = async () => {
    if (nowPlaying) {
      try {
        // Marcar como tocada
        await supabase
          .from("queue_items")
          .update({ status: "played" })
          .eq("id", nowPlaying.id);

        // Tocar próxima se houver
        const nextTrack = queue[0];
        if (nextTrack) {
          await spotifyPlay(nextTrack.spotify_uri);
        }
      } catch (error) {
        console.error("Erro ao pular música:", error);
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    // TODO: Implementar controle de volume do Spotify
  };

  // Pesquisar músicas
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchMusic(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Erro na pesquisa:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Adicionar música diretamente
  const handleAddTrack = async (track: any) => {
    if (!session) return;

    try {
      await addToQueue({
        title: track.title,
        artist: track.artist,
        spotify_uri: track.spotify_uri,
        thumbnail_url: track.thumb,
        external_urls: track.external_urls,
        requested_by: "admin",
      });
    } catch (error) {
      console.error("Erro ao adicionar música:", error);
    }
  };

  // Carregar perfil do Spotify
  useEffect(() => {
    if (spotifyConnected) {
      getSpotifyProfile().then(setSpotifyProfile).catch(console.error);
    }
  }, [spotifyConnected]);

  // Tela de login
  if (!adminAuthed) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-surface-dark rounded-asymmetric p-8 shadow-surface">
            <h1 className="font-display text-3xl text-white mb-8 text-center">
              Admin {slug}
            </h1>

            <div className="space-y-4">
              <div>
                <label className="block font-label text-sm text-text-muted mb-2">
                  Usuário
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="register-input"
                  placeholder="Nome do bar"
                />
              </div>

              <div>
                <label className="block font-label text-sm text-text-muted mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="register-input"
                  placeholder="Senha de admin"
                  onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                />
              </div>

              {loginError && (
                <p className="text-red-500 font-label text-sm">
                  Credenciais inválidas
                </p>
              )}

              <button
                onClick={handleAdminLogin}
                disabled={loginLoading}
                className="btn-primary w-full"
              >
                {loginLoading ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4 w-8 h-8" />
          <p className="font-body text-text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-secondary flex ${modoFesta ? 'party-mode' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        modoFesta={modoFesta}
        session={session}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {/* Queue Tab */}
          {activeTab === "queue" && (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="font-display text-3xl text-white mb-2">
                  Gerenciar Fila
                </h2>
                <p className="font-label text-text-muted">
                  {queue.length} músicas na fila
                </p>
              </div>

              {/* Add Track Section */}
              <div className="bg-surface-dark rounded-asymmetric p-6 mb-6">
                <h3 className="font-body text-lg text-white mb-4">
                  Adicionar Música
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar música ou artista..."
                    className="flex-1 bg-transparent border-b-2 border-text-muted/50 focus:border-primary pb-2 text-white outline-none"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="btn-primary"
                  >
                    {isSearching ? "..." : "Buscar"}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((track) => (
                      <div key={track.id} className="flex items-center gap-3 p-3 bg-surface-darker rounded">
                        <div className="w-10 h-10 rounded overflow-hidden">
                          {track.thumb ? (
                            <img src={track.thumb} alt={track.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-surface-dark flex items-center justify-center">
                              <Music size={16} className="text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-body text-white text-sm">{track.title}</p>
                          <p className="font-label text-xs text-text-muted">{track.artist}</p>
                        </div>
                        <button
                          onClick={() => handleAddTrack(track)}
                          className="p-2 bg-primary text-secondary rounded hover:bg-primary/90"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Queue List */}
              <div className="bg-surface-dark rounded-asymmetric overflow-hidden">
                <div className="p-4 border-b border-text-muted/20">
                  <h3 className="font-body text-lg text-white">Fila Atual</h3>
                </div>

                <div className="queue-manager">
                  {queue.length === 0 ? (
                    <div className="p-16 text-center">
                      <Music size={48} className="mx-auto mb-4 text-text-muted" />
                      <p className="font-body text-lg text-text-muted">Fila vazia</p>
                    </div>
                  ) : (
                    queue.map((item, index) => (
                      <ItemFila
                        key={item.id}
                        item={item}
                        index={index}
                        onRemove={removeFromQueue}
                        modoFesta={modoFesta}
                        canMoveUp={index > 0}
                        canMoveDown={index < queue.length - 1}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Other tabs... */}
          {activeTab === "stats" && (
            <div className="p-6">
              <h2 className="font-display text-3xl text-white mb-6">Estatísticas</h2>
              <p className="font-body text-text-muted">Em desenvolvimento...</p>
            </div>
          )}

          {activeTab === "share" && (
            <div className="p-6">
              <h2 className="font-display text-3xl text-white mb-6">Compartilhar</h2>
              <p className="font-body text-text-muted">Em desenvolvimento...</p>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="p-6">
              <h2 className="font-display text-3xl text-white mb-6">Configurações</h2>
              <p className="font-body text-text-muted">Em desenvolvimento...</p>
            </div>
          )}
        </main>

        {/* Spotify Player - Bottom */}
        <PlayerSpotify
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          modoFesta={modoFesta}
          onTogglePartyMode={handleTogglePartyMode}
          spotifyConnected={spotifyConnected}
        />
      </div>
    </div>
  );
}