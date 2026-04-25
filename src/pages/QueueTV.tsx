import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Disc, Pause, QrCode, Disc3 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQueue } from "../hooks/useQueue";
import { usePlayer } from "../hooks/usePlayer";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

function EqBars({ active, party }: { active: boolean; party: boolean }) {
  if (party) {
    return (
      <div className="flex items-end gap-[2px] h-8 w-14 flex-shrink-0">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${active ? `party-eq-${i}` : ""}`}
            style={{
              backgroundColor: "var(--color-brand-lime)",
              height: active ? undefined : "20%",
            }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-[3px] h-8 w-10 flex-shrink-0">
      <div className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-1" : ""}`} style={{ height: active ? undefined : "30%" }} />
      <div className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-2" : ""}`} style={{ height: active ? undefined : "30%" }} />
      <div className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-3" : ""}`} style={{ height: active ? undefined : "30%" }} />
    </div>
  );
}

function AudioVisualizer({ analyser, isPlaying, party }: { analyser: AnalyserNode | null; isPlaying: boolean; party: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || !analyser || !canvasRef.current) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = Math.min(32, data.length);
      const barW = canvas.width / barCount;

      for (let i = 0; i < barCount; i++) {
        const h = (data[i] / 255) * canvas.height;
        if (party) {
          const hue = (i / barCount) * 360;
          ctx.fillStyle = `hsl(${hue}, 100%, 55%)`;
        } else {
          ctx.fillStyle = "#D1DC5A";
        }
        ctx.fillRect(i * barW + 1, canvas.height - h, barW - 2, h);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, analyser, party]);

  if (!isPlaying || !analyser) return null;

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={64}
      className="w-full h-16 opacity-90"
    />
  );
}

export default function QueueTV() {
  const { slug } = useParams<{ slug: string }>();
  const [time, setTime] = useState(new Date());
  const { queue, advanceQueue } = useQueue(slug);

  const [showQR, setShowQR] = useState(true);
  const qrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Party mode
  const [partyMode, setPartyMode] = useState(() => sessionStorage.getItem("caipa_party") === "1");
  const toggleParty = useCallback(() => {
    setPartyMode(prev => {
      const next = !prev;
      sessionStorage.setItem("caipa_party", next ? "1" : "0");
      return next;
    });
  }, []);

  // Web Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // Bar custom theme
  useEffect(() => {
    if (!slug) return;
    supabase.from("bars").select("theme_primary,theme_accent").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        if (data?.theme_primary) document.documentElement.style.setProperty("--color-brand-blue", data.theme_primary);
        if (data?.theme_accent)  document.documentElement.style.setProperty("--color-brand-lime", data.theme_accent);
      });
    return () => {
      document.documentElement.style.removeProperty("--color-brand-blue");
      document.documentElement.style.removeProperty("--color-brand-lime");
    };
  }, [slug]);

  const showQRTemporarily = () => {
    if (qrTimerRef.current) clearTimeout(qrTimerRef.current);
    setShowQR(true);
    qrTimerRef.current = setTimeout(() => setShowQR(false), 3000);
  };

  useEffect(() => {
    qrTimerRef.current = setTimeout(() => setShowQR(false), 3000);
    return () => { if (qrTimerRef.current) clearTimeout(qrTimerRef.current); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowPlaying = queue[0] ?? null;
  const upNext = queue.slice(1, 5);

  const { isPlaying, progress, autoplayBlocked, togglePlay, audioRef } = usePlayer(
    nowPlaying?.preview_url,
    advanceQueue,
  );

  // Re-connect analyser when audio element changes (new preview URL)
  useEffect(() => {
    if (!audioCtxRef.current || !audioRef.current) return;

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      sourceNodeRef.current = source;
      setAnalyserNode(analyser);
    } catch {
      setAnalyserNode(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowPlaying?.preview_url]);

  const handleTogglePlay = () => {
    // Initialize Web Audio on first user interaction
    if (!audioCtxRef.current && audioRef.current) {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceNodeRef.current = source;
        setAnalyserNode(analyser);
      } catch {
        setAnalyserNode(null);
      }
    }
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
    togglePlay();
  };

  const clientUrl = `${window.location.origin}/${slug}`;

  const tickerItems = queue.map(item =>
    `♪ ${item.title} — ${item.artist}${item.dedication_to ? ` (❤️ ${item.dedication_to})` : ""}  @${item.client_name}`
  );
  const tickerText = tickerItems.length > 0
    ? tickerItems.join("   ·   ")
    : "♪ Nenhuma música na fila — seja o primeiro a pedir!";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex h-screen w-full flex-col overflow-hidden bg-brand-cream border-[16px] border-brand-blue selection:bg-brand-lime",
        partyMode && "party-mode",
      )}
    >
      {/* Party mode indicator */}
      {partyMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black border-2 border-brand-lime px-3 py-1.5 neon-border">
          <Disc3 size={16} className="text-brand-lime animate-spin color-cycle" style={{ animationDuration: "2s" }} />
          <span className="font-display text-brand-lime text-lg uppercase neon-text">FESTA</span>
        </div>
      )}

      {/* Top Banner */}
      <header className="flex items-center justify-between border-b-[12px] border-brand-blue bg-white p-8 lg:p-12 text-brand-blue">
        <div>
          <h1
            className={cn(
              "text-7xl lg:text-9xl font-display leading-none tracking-tighter uppercase",
              partyMode && "neon-text",
            )}
            onDoubleClick={toggleParty}
            title="Duplo clique para modo festa"
            style={{ cursor: "default" }}
          >
            TOCA<span className={cn("text-brand-lime", !partyMode && "text-stroke-blue")}>Í</span>
          </h1>
          <p className="font-body text-2xl font-black italic uppercase opacity-60">
            Sintonizado em: tocai.com/{slug}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-3">
          <p
            className={cn(
              "font-display text-7xl lg:text-9xl leading-none tracking-tighter",
              partyMode ? "neon-text color-cycle" : "animate-pulse",
            )}
            onDoubleClick={toggleParty}
            style={{ cursor: "default" }}
          >
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="flex items-center gap-4">
            {nowPlaying?.preview_url && (
              <button
                onClick={handleTogglePlay}
                className={cn(
                  "bg-brand-blue text-brand-lime border-4 border-brand-blue px-6 py-2 font-display text-2xl flex items-center gap-2 transition-all",
                  partyMode
                    ? "neon-border shadow-none"
                    : "shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px]",
                )}
              >
                {isPlaying
                  ? <><Pause size={24} fill="currentColor" /> PAUSAR</>
                  : <><Play size={24} fill="currentColor" />{autoplayBlocked ? "TOQUE PARA OUVIR" : "TOCAR"}</>
                }
              </button>
            )}
            <div className={cn(
              "bg-brand-lime px-4 py-1 border-4 border-brand-blue inline-block",
              partyMode ? "neon-border" : "shadow-[4px_4px_0px_var(--color-brand-blue)]",
            )}>
              <span className="font-display text-2xl uppercase tracking-widest text-brand-blue">LIVE SESSION</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Now Playing */}
        <section className="flex flex-[1.5] flex-col items-center justify-center p-12 lg:p-24 text-center bg-brand-blue text-brand-cream relative overflow-hidden">
          <div className="absolute inset-0 bg-grainy opacity-10" />

          {nowPlaying ? (
            <>
              <div className="relative mb-8">
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: partyMode ? 8 : 30, repeat: Infinity, ease: "linear" }}
                  className={cn(
                    "absolute -inset-16 rounded-full border-8 border-dashed opacity-20",
                    partyMode ? "border-brand-lime" : "border-brand-lime",
                  )}
                />
                <div className="relative flex h-80 w-80 lg:h-[28rem] lg:w-[28rem] items-center justify-center border-[12px] border-brand-cream bg-black shadow-[32px_32px_0px_0px_var(--color-brand-lime)] overflow-hidden">
                  {nowPlaying.thumbnail_url ? (
                    <img src={nowPlaying.thumbnail_url} className="h-full w-full object-cover" alt={nowPlaying.title} />
                  ) : (
                    <Disc size={160} className="text-brand-lime" />
                  )}
                  <div className={cn(
                    "absolute top-8 left-8 flex items-center gap-3 bg-brand-lime px-8 py-3 font-display text-3xl text-brand-blue",
                    partyMode ? "neon-border" : "shadow-[-8px_8px_0px_var(--color-brand-blue)]",
                  )}>
                    {isPlaying
                      ? <><EqBars active={true} party={partyMode} /> TOCANDO AGORA</>
                      : <><Music size={28} /> PRÓXIMA FAIXA</>
                    }
                  </div>
                </div>
              </div>

              {/* Audio Visualizer or Progress Bar */}
              <div className="w-full max-w-lg mb-6">
                {analyserNode && isPlaying ? (
                  <AudioVisualizer analyser={analyserNode} isPlaying={isPlaying} party={partyMode} />
                ) : nowPlaying.preview_url ? (
                  <div className="h-2 bg-white/20 relative">
                    <motion.div
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-y-0 left-0 bg-brand-lime"
                    />
                  </div>
                ) : null}
              </div>

              <AnimatePresence mode="wait">
                <motion.h2
                  key={nowPlaying.id + "-title"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className={cn(
                    "mb-4 text-7xl lg:text-[8rem] font-display uppercase leading-none tracking-tighter",
                    partyMode && "neon-text",
                  )}
                >
                  {nowPlaying.title}
                </motion.h2>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={nowPlaying.id + "-artist"}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className={cn(
                    "text-4xl lg:text-6xl font-body font-black uppercase tracking-widest text-brand-lime leading-none italic",
                    partyMode && "color-cycle",
                  )}
                >
                  {nowPlaying.artist}
                </motion.p>
              </AnimatePresence>

              <div className={cn(
                "mt-8 flex items-center gap-6 border-[8px] border-brand-cream bg-white/5 px-12 py-6 backdrop-blur-sm",
                partyMode && "neon-border",
              )}>
                <div className="h-8 w-8 animate-pulse rounded-full bg-red-600 shadow-[0_0_20px_red]" />
                <p className="font-display text-4xl italic uppercase leading-none text-brand-cream">
                  REQUISITADO POR{" "}
                  <span className="text-brand-lime">@{nowPlaying.client_name}</span>
                </p>
              </div>

              {nowPlaying.dedication_to && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 flex items-center gap-4 border-[8px] border-brand-lime bg-brand-lime/10 px-10 py-5"
                >
                  <span className="text-4xl">❤️</span>
                  <p className="font-display text-4xl italic uppercase leading-none text-brand-cream">
                    PARA{" "}
                    <span className="text-brand-lime">{nowPlaying.dedication_to}</span>
                  </p>
                </motion.div>
              )}
            </>
          ) : (
            <div className={cn(
              "font-display text-7xl opacity-30 animate-bounce text-center leading-tight",
              partyMode && "neon-text opacity-60",
            )}>
              AGUARDANDO O PRÓXIMO HIT...
            </div>
          )}
        </section>

        {/* Right: Up Next + QR */}
        <section className={cn(
          "flex flex-1 flex-col border-l-[12px] border-brand-blue py-12",
          partyMode ? "bg-black" : "bg-white",
        )}>
          <div className="mb-12 px-12">
            <h3 className={cn(
              "mb-6 inline-block border-b-8 border-brand-lime font-display text-6xl uppercase italic tracking-tighter",
              partyMode ? "text-brand-lime neon-text" : "text-brand-blue",
            )}>
              PRÓXIMOS DA FILA
            </h3>
          </div>

          <div className="flex-1 space-y-6 overflow-hidden px-12">
            {upNext.length === 0 ? (
              <div className={cn(
                "h-full flex flex-col items-center justify-center text-center opacity-20 space-y-4",
                partyMode ? "text-brand-lime" : "text-brand-blue",
              )}>
                <Music size={100} />
                <p className="font-display text-4xl">FILA VAZIA</p>
              </div>
            ) : (
              upNext.map((item, idx) => (
                <TVQueueItem
                  key={item.id}
                  rank={idx + 2}
                  title={item.title}
                  artist={item.artist}
                  client={item.client_name}
                  dedicationTo={item.dedication_to}
                  delay={idx * 0.1}
                  party={partyMode}
                />
              ))
            )}
          </div>

          {/* QR Code + CTA */}
          <div className={cn(
            "mt-auto p-10 border-t-[12px] border-brand-blue",
            partyMode
              ? "bg-black text-brand-lime neon-border"
              : "bg-brand-lime text-brand-blue shadow-[-8px_-8px_0px_var(--color-brand-blue)]",
          )}>
            <p className="font-display text-4xl leading-none uppercase tracking-tighter mb-6">PEÇA PELO CELULAR:</p>
            <div className="flex items-center gap-8">
              <AnimatePresence mode="wait">
                {showQR ? (
                  <motion.div
                    key="qr"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "aspect-square w-32 border-[6px] bg-white p-1 flex-shrink-0",
                      partyMode ? "border-brand-lime neon-border" : "border-brand-blue",
                    )}
                  >
                    <QRCodeSVG
                      value={clientUrl}
                      size={108}
                      bgColor="#ffffff"
                      fgColor="#0a1628"
                      level="H"
                    />
                  </motion.div>
                ) : (
                  <motion.button
                    key="show-qr"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={showQRTemporarily}
                    className={cn(
                      "aspect-square w-32 border-[6px] flex flex-col items-center justify-center gap-2 flex-shrink-0 transition-colors",
                      partyMode
                        ? "border-brand-lime bg-black text-brand-lime hover:bg-brand-lime/10"
                        : "border-brand-blue bg-brand-blue text-brand-lime hover:bg-brand-blue/80",
                    )}
                  >
                    <QrCode size={36} />
                    <span className="font-display text-sm uppercase leading-none">VER QR</span>
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="space-y-2">
                <p className="font-body text-2xl font-black uppercase leading-none italic">
                  TOCAÍ.COM/{slug}
                </p>
                <p className="font-body text-lg font-bold uppercase opacity-70">
                  Aumente o volume, quem manda no bar hoje é você.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Marquee ticker */}
      <div className={cn(
        "border-t-[8px] border-brand-blue overflow-hidden py-3",
        partyMode ? "bg-black text-brand-lime" : "bg-brand-blue text-brand-lime",
      )}>
        <div className="marquee-track whitespace-nowrap font-display text-2xl uppercase tracking-wide">
          <span className="marquee-content">{tickerText}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{tickerText}</span>
        </div>
      </div>
    </motion.div>
  );
}

function TVQueueItem({
  rank, title, artist, client, dedicationTo, delay = 0, party,
}: {
  key?: string; rank: number; title: string; artist: string; client: string; dedicationTo?: string; delay?: number; party: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ x: -4, transition: { duration: 0.15 } }}
      className={cn(
        "flex items-center gap-8 border-4 border-brand-blue p-6",
        party
          ? "bg-black text-brand-lime neon-border"
          : "bg-white shadow-[8px_8px_0px_var(--color-brand-lime)]",
      )}
    >
      <span className={cn("font-display text-7xl leading-none tracking-tighter", party ? "text-brand-lime neon-text" : "text-brand-blue")}>
        {rank}º
      </span>
      <div className="flex-1 overflow-hidden">
        <h4 className={cn("truncate text-5xl font-display uppercase leading-none tracking-tighter", party ? "text-brand-lime" : "text-brand-blue")}>
          {title}
        </h4>
        <p className={cn("truncate font-body text-2xl font-black uppercase italic tracking-tight", party ? "text-brand-lime/70" : "text-brand-blue/60")}>
          {artist}
        </p>
        {dedicationTo && (
          <p className="font-body text-lg font-bold uppercase text-pink-500 italic truncate">❤️ para {dedicationTo}</p>
        )}
      </div>
      <div className={cn("text-right border-l-4 pl-8", party ? "border-brand-lime" : "border-brand-lime")}>
        <span className={cn("font-body text-xs font-black uppercase leading-none block mb-2 tracking-widest", party ? "text-brand-lime/50" : "text-brand-blue/50")}>
          PARA @{client}
        </span>
        <p className={cn("font-display text-4xl leading-none", party ? "text-brand-lime neon-text" : "text-brand-blue")}>
          UP NEXT
        </p>
      </div>
    </motion.div>
  );
}
