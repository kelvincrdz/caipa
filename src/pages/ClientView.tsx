import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Music, Check, Plus, Sparkles, Info, Heart, History, Zap, Play, Pause, Camera,
  Volume2, VolumeX, X
} from "lucide-react";
import { searchMusic, getSimilarTracks, getTrackInfo } from "../services/musicService";
import { useQueue, tagMatchesTheme } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { setSharedToken } from "../services/spotifyAuth";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Track {
  id: string;
  title: string;
  artist: string;
  thumb?: string;
  preview_url?: string;
  spotify_uri?: string;
  external_urls?: any;
}

// ── Utilitários ──────────────────────────────────────────────────────────────
function normalizeTag(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getRequestCount(slug: string, phone: string): number {
  const hoje = new Date().toISOString().split("T")[0];
  return parseInt(localStorage.getItem(`caipa_reqs_${slug}_${phone}_${hoje}`) || "0");
}

function incrementRequestCount(slug: string, phone: string) {
  const hoje = new Date().toISOString().split("T")[0];
  const key = `caipa_reqs_${slug}_${phone}_${hoje}`;
  localStorage.setItem(key, String(parseInt(localStorage.getItem(key) || "0") + 1));
}

function getFavorites(): Track[] {
  return JSON.parse(localStorage.getItem("caipa_favorites") || "[]");
}

function toggleFavorite(track: Track): boolean {
  const favs = getFavorites();
  const idx = favs.findIndex((f: Track) => f.id === track.id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem("caipa_favorites", JSON.stringify(favs));
    return false;
  } else {
    const entry = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      thumb: track.thumb,
      preview_url: track.preview_url,
      spotify_uri: track.spotify_uri,
      external_urls: track.external_urls,
    };
    localStorage.setItem("caipa_favorites", JSON.stringify([entry, ...favs].slice(0, 30)));
    return true;
  }
}

function isFavorite(trackId: string): boolean {
  return getFavorites().some((f: Track) => f.id === trackId);
}

// ── Componente de cartão "Tocando Agora" ─────────────────────────────────────
function TocandoAgora({ tocandoAgora, modoFesta }: { tocandoAgora: any; modoFesta: boolean }) {
  if (!tocandoAgora) {
    return (
      <div className="now-playing">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <Music size={32} className="mx-auto mb-2 text-text-muted" />
            <p className="font-label text-sm text-text-muted">Nenhuma música tocando</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="flex items-center gap-4">
        {/* Album Art - Circular, 120px, spinning */}
        <div className="vinyl-container">
          {tocandoAgora.thumbnail_url ? (
            <img
              src={tocandoAgora.thumbnail_url}
              alt={tocandoAgora.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-surface-darker flex items-center justify-center">
              <Music size={40} className="text-primary" />
            </div>
          )}
        </div>

        {/* Marquee Text */}
        <div className="flex-1 overflow-hidden">
          <div className="marquee">
            <div className="marquee-track">
              <span className="font-body text-lg font-bold text-white pr-8">
                {tocandoAgora.title}
              </span>
              <span className="font-label text-sm text-text-muted pr-8">
                por {tocandoAgora.artist}
              </span>
              <span className="font-body text-lg font-bold text-white pr-8">
                {tocandoAgora.title}
              </span>
              <span className="font-label text-sm text-text-muted pr-8">
                por {tocandoAgora.artist}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente de cartão de música ───────────────────────────────────────────
function CartaoMusica({
  track,
  onAdd,
  isAdded,
  showAddButton = true,
  modoFesta = false
}: {
  track: Track;
  onAdd?: () => void;
  isAdded?: boolean;
  showAddButton?: boolean;
  modoFesta?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const ehFavorito = isFavorite(track.id);

  const handleAdd = async () => {
    if (isLoading || isAdded) return;
    setIsLoading(true);
    await onAdd?.();
    setIsLoading(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track);
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        "track-card group",
        modoFesta && "neon-border"
      )}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded overflow-hidden flex-shrink-0">
        {track.thumb ? (
          <img
            src={track.thumb}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-darker flex items-center justify-center">
            <Music size={20} className="text-primary" />
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0 px-3">
        <h4 className="font-label font-medium text-white text-sm truncate">
          {track.title}
        </h4>
        <p className="font-body text-xs text-text-muted truncate">
          {track.artist}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={cn(
            "p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100",
            ehFavorito ? "text-red-500" : "text-text-muted hover:text-red-500"
          )}
        >
          <Heart size={16} fill={ehFavorito ? "currentColor" : "none"} />
        </button>

        {/* Add Button */}
        {showAddButton && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAdd}
            disabled={isLoading || isAdded}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isAdded
                ? "bg-green-500 text-white"
                : "bg-primary text-secondary hover:bg-primary/90",
              isLoading && "animate-spin",
              modoFesta && isAdded && "neon-text"
            )}
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : isAdded ? (
              <Check size={16} />
            ) : (
              <Plus size={16} />
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Barra de pesquisa ────────────────────────────────────────────────────────
function BarraPesquisa({
  onSearch,
  isLoading,
  modoFesta
}: {
  onSearch: (query: string) => void;
  isLoading: boolean;
  modoFesta: boolean;
}) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <div className={cn("search-bar", modoFesta && "neon-border")}>
      <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
        <Search size={20} className="text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pesquisar música ou artista..."
          className="search-input"
          disabled={isLoading}
        />
        {isLoading && <div className="loading-spinner" />}
      </form>
    </div>
  );
}

// ── Toast de notificação ─────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-asymmetric shadow-hard"
    >
      <div className="flex items-center gap-2">
        <Check size={16} />
        <span className="font-body font-medium text-sm">{message}</span>
      </div>
    </motion.div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ClientView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [addedTracks, setAddedTracks] = useState<Set<string>>(new Set());
  const [showFavorites, setShowFavorites] = useState(false);
  const [telefone, setTelefone] = useState("");

  const { session, loading: sessionLoading } = useSession(slug || "");
  const { queue, nowPlaying, addToQueue, updateScore, loading: queueLoading } = useQueue(slug || "");

  const modoFesta = session?.party_mode || false;

  // Solicitar telefone se não estiver definido
  useEffect(() => {
    const telefoneLocal = localStorage.getItem(`caipa_phone_${slug}`);
    if (!telefoneLocal) {
      const novoTelefone = prompt("Digite seu número de telefone (apenas números):");
      if (novoTelefone && /^\d{10,11}$/.test(novoTelefone)) {
        setTelefone(novoTelefone);
        localStorage.setItem(`caipa_phone_${slug}`, novoTelefone);
      }
    } else {
      setTelefone(telefoneLocal);
    }
  }, [slug]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchMusic(query);
      setSearchResults(results);
    } catch (error) {
      console.error("Erro na pesquisa:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrack = async (track: Track) => {
    if (!session || !telefone) return;

    try {
      await addToQueue({
        title: track.title,
        artist: track.artist,
        spotify_uri: track.spotify_uri,
        thumbnail_url: track.thumb,
        external_urls: track.external_urls,
        requested_by: telefone,
      });

      setAddedTracks(prev => new Set(prev).add(track.id));
      incrementRequestCount(slug || "", telefone);

      setToastMessage("Adicionado à fila");
      setShowToast(true);

      // Remover do estado após 3 segundos
      setTimeout(() => {
        setAddedTracks(prev => {
          const novo = new Set(prev);
          novo.delete(track.id);
          return novo;
        });
      }, 3000);
    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      setToastMessage("Erro ao adicionar música");
      setShowToast(true);
    }
  };

  // Loading state
  if (sessionLoading || queueLoading) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4 w-8 h-8" />
          <p className="font-body text-text-muted">Carregando...</p>
        </div>
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl text-white mb-4">Bar não encontrado</h1>
          <p className="font-body text-text-muted">
            Este bar pode não estar ativo ou o link pode estar incorreto.
          </p>
        </div>
      </div>
    );
  }

  const filaVazia = queue.length === 0;
  const resultadosParaMostrar = showFavorites ? getFavorites() : searchResults;

  return (
    <div
      className={cn(
        "min-h-screen bg-secondary",
        "md:client-container", // Aplicar constraint de desktop
        modoFesta && "party-mode"
      )}
    >
      {/* Toast de notificação */}
      <AnimatePresence>
        {showToast && (
          <Toast
            message={toastMessage}
            onClose={() => setShowToast(false)}
          />
        )}
      </AnimatePresence>

      {/* Tocando Agora - Sticky Top */}
      <TocandoAgora tocandoAgora={nowPlaying} modoFesta={modoFesta} />

      {/* Queue List - Scrolling Middle */}
      <div className="queue-container queue-scroll">
        {/* Info do bar */}
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl text-white mb-1">{session.bar_name}</h1>
          {session.theme && (
            <p className="font-label text-xs text-primary uppercase tracking-wider">
              {session.theme}
            </p>
          )}
        </div>

        {/* Toggle entre busca e favoritos */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowFavorites(false)}
            className={cn(
              "flex-1 py-2 px-4 rounded text-sm font-body font-medium transition-colors",
              !showFavorites
                ? "bg-primary text-secondary"
                : "bg-surface-dark text-text-muted hover:text-white"
            )}
          >
            Pesquisar
          </button>
          <button
            onClick={() => setShowFavorites(true)}
            className={cn(
              "flex-1 py-2 px-4 rounded text-sm font-body font-medium transition-colors",
              showFavorites
                ? "bg-primary text-secondary"
                : "bg-surface-dark text-text-muted hover:text-white"
            )}
          >
            Favoritos
          </button>
        </div>

        {/* Fila atual */}
        {queue.length > 0 && (
          <div className="mb-6">
            <h2 className="font-body font-bold text-white text-lg mb-3">Na Fila</h2>
            <div className="space-y-2">
              {queue.slice(0, 5).map((item, index) => (
                <div key={item.id} className="track-card">
                  <span className="text-primary font-bold text-sm w-6 text-center">
                    {index + 1}
                  </span>
                  <div className="w-10 h-10 rounded overflow-hidden">
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
                  <div className="flex-1 min-w-0 px-3">
                    <p className="font-label font-medium text-white text-sm truncate">
                      {item.title}
                    </p>
                    <p className="font-body text-xs text-text-muted truncate">
                      {item.artist}
                    </p>
                  </div>
                  <button
                    onClick={() => updateScore(item.id, 1)}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <Zap size={16} />
                  </button>
                </div>
              ))}
              {queue.length > 5 && (
                <p className="text-center font-label text-xs text-text-muted">
                  +{queue.length - 5} mais na fila
                </p>
              )}
            </div>
          </div>
        )}

        {/* Estado vazio da fila */}
        {filaVazia && !showFavorites && searchResults.length === 0 && (
          <div className="text-center py-16 opacity-50">
            <Music size={48} className="mx-auto mb-4 text-text-muted" />
            <p className="font-body text-lg text-text-muted">Música na fila.</p>
            <p className="font-label text-sm text-text-muted mt-1">
              Pesquise e adicione suas músicas favoritas
            </p>
          </div>
        )}

        {/* Resultados de pesquisa ou favoritos */}
        {resultadosParaMostrar.length > 0 && (
          <div>
            <h2 className="font-body font-bold text-white text-lg mb-3">
              {showFavorites ? "Suas Favoritas" : "Resultados"}
            </h2>
            <div className="space-y-2">
              {resultadosParaMostrar.map((track) => (
                <CartaoMusica
                  key={track.id}
                  track={track}
                  onAdd={() => handleAddTrack(track)}
                  isAdded={addedTracks.has(track.id)}
                  modoFesta={modoFesta}
                />
              ))}
            </div>
          </div>
        )}

        {/* Estado de favoritos vazio */}
        {showFavorites && resultadosParaMostrar.length === 0 && (
          <div className="text-center py-16 opacity-50">
            <Heart size={48} className="mx-auto mb-4 text-text-muted" />
            <p className="font-body text-lg text-text-muted">Nenhuma favorita ainda.</p>
            <p className="font-label text-sm text-text-muted mt-1">
              Curta músicas para salvá-las aqui
            </p>
          </div>
        )}
      </div>

      {/* Search Bar - Fixed Bottom */}
      {!showFavorites && (
        <BarraPesquisa
          onSearch={handleSearch}
          isLoading={isSearching}
          modoFesta={modoFesta}
        />
      )}
    </div>
  );
}