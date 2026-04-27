import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Music, Users, Clock, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQueue } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";

// ── Visualizador de áudio ────────────────────────────────────────────────────
function VisualizadorAudio({ isPlaying, modoFesta }: { isPlaying: boolean; modoFesta: boolean }) {
  const bars = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="visualizer">
      {bars.map((_, index) => (
        <motion.div
          key={index}
          className={`visualizer-bar ${modoFesta ? 'party-mode' : ''}`}
          animate={{
            height: isPlaying ? [
              `${20 + Math.random() * 60}%`,
              `${30 + Math.random() * 70}%`,
              `${10 + Math.random() * 80}%`,
              `${40 + Math.random() * 60}%`
            ] : "20%"
          }}
          transition={{
            duration: 0.5 + Math.random() * 0.5,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: index * 0.1
          }}
        />
      ))}
    </div>
  );
}

// ── Item da próxima música ───────────────────────────────────────────────────
function ProximaMusica({ item, index }: { item: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.1 }}
      className="flex items-center gap-4 p-4 bg-surface-dark/50 rounded-lg border border-primary/10"
    >
      <div className="text-primary font-bold text-xl w-8">
        {index + 1}
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-darker flex items-center justify-center">
            <Music size={20} className="text-primary" />
          </div>
        )}
      </div>

      {/* Informações da música */}
      <div className="flex-1 min-w-0">
        <h4 className="font-body font-bold text-white text-lg truncate">
          {item.title}
        </h4>
        <p className="font-label text-text-muted text-sm truncate">
          {item.artist}
        </p>
        {item.requested_by && (
          <p className="font-label text-xs text-primary/70 mt-1">
            Pedida por ****{item.requested_by.slice(-4)}
          </p>
        )}
      </div>

      {/* Score */}
      {item.score > 0 && (
        <div className="flex items-center gap-1 text-primary">
          <span className="text-lg font-bold">⚡</span>
          <span className="font-body font-bold">{item.score}</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Screensaver mode ─────────────────────────────────────────────────────────
function ModoEsperaPadrao({ nomeBar, slug }: { nomeBar: string; slug: string }) {
  const urlCompleta = `${window.location.origin}/${slug}`;

  return (
    <div className="queue-tv-layout">
      {/* Lado esquerdo - Logo e texto */}
      <div className="queue-tv-left">
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            x: [0, -20, 0, 20, 0],
            y: [0, -10, 0, 10, 0]
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-center"
        >
          <h1 className="font-display text-8xl text-white mb-8 text-gradient">
            {nomeBar}
          </h1>
          <p className="font-body text-2xl text-text-muted">
            Escaneie o QR Code para comandar a música
          </p>
        </motion.div>
      </div>

      {/* Lado direito - QR Code */}
      <div className="queue-tv-right justify-center">
        <div className="text-center">
          <h2 className="font-display text-3xl text-white mb-8">
            Comande a Música
          </h2>

          <div className="qr-container mx-auto mb-6">
            <QRCodeSVG
              value={urlCompleta}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="font-body text-lg text-primary font-bold mb-2">
            Escaneie para DJ
          </p>
          <p className="font-label text-sm text-text-muted">
            ou acesse: {slug}.caipa.app
          </p>

          <div className="mt-12 space-y-4 text-left">
            <div className="flex items-center gap-3 text-white">
              <Smartphone size={24} className="text-primary" />
              <span className="font-body">Use seu celular</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <Music size={24} className="text-primary" />
              <span className="font-body">Escolha suas músicas</span>
            </div>
            <div className="flex items-center gap-3 text-white">
              <Users size={24} className="text-primary" />
              <span className="font-body">Vote nas favoritas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function QueueTV() {
  const { slug } = useParams<{ slug: string }>();
  const [urlQR, setUrlQR] = useState("");

  const { session, loading: sessionLoading } = useSession(slug || "");
  const { queue, nowPlaying, loading: queueLoading } = useQueue(slug || "");

  const modoFesta = session?.party_mode || false;
  const temMusicaTocando = !!nowPlaying;
  const proximasFaixas = queue.slice(0, 8); // Mostrar até 8 próximas

  // Configurar URL do QR Code
  useEffect(() => {
    if (slug) {
      setUrlQR(`${window.location.origin}/${slug}`);
    }
  }, [slug]);

  // Loading state
  if (sessionLoading || queueLoading) {
    return (
      <div className="queue-tv-layout bg-secondary">
        <div className="queue-tv-left">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4 w-12 h-12" />
            <p className="font-body text-2xl text-text-muted">Carregando...</p>
          </div>
        </div>
        <div className="queue-tv-right" />
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="queue-tv-layout bg-secondary">
        <div className="queue-tv-left">
          <div className="text-center">
            <h1 className="font-display text-6xl text-white mb-8">Bar não encontrado</h1>
            <p className="font-body text-2xl text-text-muted">
              Verifique se o link está correto
            </p>
          </div>
        </div>
        <div className="queue-tv-right" />
      </div>
    );
  }

  // Modo idle (sem música tocando)
  if (!temMusicaTocando) {
    return <ModoEsperaPadrao nomeBar={session.bar_name} slug={slug || ""} />;
  }

  return (
    <div className={`queue-tv-layout ${modoFesta ? 'party-mode' : ''}`}>
      {/* Lado esquerdo - Now Playing (60%) */}
      <motion.div
        key={nowPlaying?.id}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{
          type: "spring",
          stiffness: 100,
          damping: 20
        }}
        className="queue-tv-left"
      >
        <div className="flex flex-col items-center justify-center h-full p-16">
          {/* Album Art principal */}
          <div className="hero-album-art mb-8">
            {nowPlaying?.thumbnail_url ? (
              <img
                src={nowPlaying.thumbnail_url}
                alt={nowPlaying.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-surface-darker flex items-center justify-center">
                <Music size={80} className="text-primary" />
              </div>
            )}
          </div>

          {/* Informações da música atual */}
          <div className="text-center mb-8">
            <h1 className="font-display text-5xl text-white mb-4 leading-tight">
              {nowPlaying?.title}
            </h1>
            <p className="font-body text-3xl text-text-muted">
              por {nowPlaying?.artist}
            </p>
            {nowPlaying?.requested_by && (
              <p className="font-label text-lg text-primary/70 mt-4">
                Pedida por ****{nowPlaying.requested_by.slice(-4)}
              </p>
            )}
          </div>

          {/* Visualizador de áudio */}
          <div className="mt-auto mb-8">
            <VisualizadorAudio isPlaying={true} modoFesta={modoFesta} />
          </div>
        </div>
      </motion.div>

      {/* Lado direito - Up Next + QR (40%) */}
      <div className="queue-tv-right">
        {/* Header */}
        <div className="mb-8">
          <h2 className="font-display text-4xl text-white mb-2">
            Próximas
          </h2>
          <p className="font-label text-lg text-text-muted">
            {proximasFaixas.length} na fila
          </p>
        </div>

        {/* Lista das próximas */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-8">
          <AnimatePresence>
            {proximasFaixas.map((item, index) => (
              <ProximaMusica
                key={item.id}
                item={item}
                index={index}
              />
            ))}
          </AnimatePresence>

          {proximasFaixas.length === 0 && (
            <div className="text-center py-16">
              <Music size={48} className="mx-auto mb-4 text-text-muted" />
              <p className="font-body text-xl text-text-muted">
                Fila vazia
              </p>
              <p className="font-label text-sm text-text-muted mt-2">
                Escaneie o QR para adicionar músicas
              </p>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="text-center">
          <div className="qr-container mx-auto mb-4">
            <QRCodeSVG
              value={urlQR}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
          <p className="font-body text-xl text-primary font-bold">
            Escaneie para DJ
          </p>
          <p className="font-label text-sm text-text-muted mt-1">
            {slug}.caipa.app
          </p>
        </div>
      </div>
    </div>
  );
}