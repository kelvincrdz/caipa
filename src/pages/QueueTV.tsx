import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Disc, Pause, Disc3 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQueue } from "../hooks/useQueue";
import { usePlayer } from "../hooks/usePlayer";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.45 ? "#0A0A0A" : "#F5F5F5";
}

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
          ctx.fillStyle = "#FFB800";
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

  const [barLogo, setBarLogo] = useState<string | null>(null);

  // Session config for photo display mode
  const { session: config } = useSession(slug);

  // Approved photos for slideshow/background
  const [approvedPhotos, setApprovedPhotos] = useState<any[]>([]);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("bar_photos")
      .select("*")
      .eq("bar_slug", slug)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setApprovedPhotos(data ?? []));

    const ch = supabase
      .channel(`tv_photos_${slug}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bar_photos", filter: `bar_slug=eq.${slug}` },
        (payload) => {
          const p = payload.new as any;
          if (p.status === "approved") setApprovedPhotos(prev => [p, ...prev]);
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bar_photos", filter: `bar_slug=eq.${slug}` },
        (payload) => {
          const p = payload.new as any;
          if (p.status === "approved") setApprovedPhotos(prev => {
            const exists = prev.find(x => x.id === p.id);
            return exists ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev];
          });
          else setApprovedPhotos(prev => prev.filter(x => x.id !== p.id));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bar_photos", filter: `bar_slug=eq.${slug}` },
        (payload) => setApprovedPhotos(prev => prev.filter(x => x.id !== (payload.old as any).id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [slug]);

  // Photo slideshow timer (8s per photo)
  useEffect(() => {
    if (approvedPhotos.length < 2 || config.photo_display_mode === "none") return;
    const t = setInterval(() => {
      setCurrentPhotoIdx(i => (i + 1) % approvedPhotos.length);
    }, config.photo_display_mode === "background" ? 25000 : 8000);
    return () => clearInterval(t);
  }, [approvedPhotos.length, config.photo_display_mode]);

  // Bar custom theme + logo
  useEffect(() => {
    if (!slug) return;
    supabase.from("bars").select("theme_primary,theme_accent,logo_url").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        if (data?.theme_primary) {
          document.documentElement.style.setProperty("--color-brand-blue", data.theme_primary);
          document.documentElement.style.setProperty("--color-on-primary", getContrastColor(data.theme_primary));
        }
        if (data?.theme_accent) {
          document.documentElement.style.setProperty("--color-brand-lime", data.theme_accent);
          document.documentElement.style.setProperty("--color-on-accent", getContrastColor(data.theme_accent));
        }
        if (data?.logo_url) setBarLogo(data.logo_url);
      });
    return () => {
      document.documentElement.style.removeProperty("--color-brand-blue");
      document.documentElement.style.removeProperty("--color-brand-lime");
      document.documentElement.style.removeProperty("--color-on-primary");
      document.documentElement.style.removeProperty("--color-on-accent");
    };
  }, [slug]);

  useEffect(() => {
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
      <header className="flex flex-shrink-0 items-center justify-between border-b-[8px] border-brand-blue bg-white px-6 py-3 lg:px-10 lg:py-4 text-brand-blue">
        <div>
          {barLogo ? (
            <img
              src={barLogo}
              alt={slug}
              onDoubleClick={toggleParty}
              title="Duplo clique para modo festa"
              className={cn(
                "h-14 lg:h-20 object-contain max-w-[200px] lg:max-w-[280px]",
                partyMode && "neon-text",
              )}
              style={{ cursor: "default" }}
            />
          ) : (
            <h1
              className={cn(
                "text-3xl lg:text-4xl font-display leading-none tracking-tighter uppercase",
                partyMode && "neon-text",
              )}
              onDoubleClick={toggleParty}
              title="Duplo clique para modo festa"
              style={{ cursor: "default" }}
            >
              TOCA<span className={cn("text-brand-lime", !partyMode && "text-stroke-blue")}>Í</span>
            </h1>
          )}
          <p className="font-body text-xs font-black italic uppercase opacity-60">
            Sintonizado em: tocai.com/{slug}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p
            className={cn(
              "font-display text-3xl lg:text-4xl leading-none tracking-tighter",
              partyMode ? "neon-text color-cycle" : "animate-pulse",
            )}
            onDoubleClick={toggleParty}
            style={{ cursor: "default" }}
          >
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="flex items-center gap-3">
            {nowPlaying?.preview_url && (
              <button
                onClick={handleTogglePlay}
                className={cn(
                  "bg-brand-blue text-on-primary border-4 border-brand-blue px-3 py-1 font-display text-sm flex items-center gap-2 transition-all",
                  partyMode
                    ? "neon-border shadow-none"
                    : "shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px]",
                )}
              >
                {isPlaying
                  ? <><Pause size={18} fill="currentColor" /> PAUSAR</>
                  : <><Play size={18} fill="currentColor" />{autoplayBlocked ? "TOQUE PARA OUVIR" : "TOCAR"}</>
                }
              </button>
            )}
            <div className={cn(
              "bg-brand-lime px-3 py-1 border-4 border-brand-blue inline-block",
              partyMode ? "neon-border" : "shadow-[4px_4px_0px_var(--color-brand-blue)]",
            )}>
              <span className="font-display text-sm uppercase tracking-widest text-on-accent">LIVE SESSION</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Now Playing */}
        <section className="flex flex-[1.5] flex-col items-center justify-center px-8 py-6 lg:px-16 lg:py-10 text-center bg-brand-blue text-on-primary relative overflow-hidden min-h-0">
          <div className="absolute inset-0 bg-grainy opacity-10" />

          {/* Photo overlay covering the entire Now Playing section — 2 photos stacked */}
          {config.photo_display_mode === "background" && approvedPhotos.length > 0 && (
            <>
              {/* Back photo */}
              <AnimatePresence>
                <motion.img
                  key={approvedPhotos[(currentPhotoIdx + 1) % approvedPhotos.length]?.id + "-back"}
                  src={approvedPhotos[(currentPhotoIdx + 1) % approvedPhotos.length]?.photo_url}
                  alt=""
                  initial={{ opacity: 0, rotate: 4, scale: 0.88 }}
                  animate={{ opacity: 0.55, rotate: 4, scale: 0.88 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ zIndex: 10, transformOrigin: "center" }}
                />
              </AnimatePresence>
              {/* Front photo */}
              <AnimatePresence>
                <motion.img
                  key={approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.id + "-front"}
                  src={approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.photo_url}
                  alt="Foto da noite"
                  initial={{ opacity: 0, rotate: -3, scale: 0.94 }}
                  animate={{ opacity: 0.9, rotate: -3, scale: 0.94 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ zIndex: 11, transformOrigin: "center" }}
                />
              </AnimatePresence>
            </>
          )}
          {config.photo_display_mode === "background" && approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-4 py-2 z-20 pointer-events-none">
              <p className="font-display text-brand-lime text-lg uppercase truncate">
                {approvedPhotos[currentPhotoIdx % approvedPhotos.length].caption}
              </p>
            </div>
          )}

          {nowPlaying ? (
            <>
              <div className="relative mb-4 z-30">
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: partyMode ? 8 : 30, repeat: Infinity, ease: "linear" }}
                  className={cn(
                    "absolute -inset-8 rounded-full border-4 border-dashed opacity-20",
                    partyMode ? "border-brand-lime" : "border-brand-lime",
                  )}
                />
                <div className="relative flex h-40 w-40 md:h-48 md:w-48 lg:h-56 lg:w-56 items-center justify-center border-8 border-brand-cream bg-black shadow-[12px_12px_0px_0px_var(--color-brand-lime)] overflow-hidden">
                  {nowPlaying.thumbnail_url ? (
                    <img src={nowPlaying.thumbnail_url} className="h-full w-full object-cover" alt={nowPlaying.title} />
                  ) : (
                    <Disc size={100} className="text-brand-lime" />
                  )}
                  <div className={cn(
                    "absolute top-2 left-2 flex items-center gap-1 bg-brand-lime px-2 py-1 font-display text-sm text-on-accent",
                    partyMode ? "neon-border" : "shadow-[-4px_4px_0px_var(--color-brand-blue)]",
                  )}>
                    {isPlaying
                      ? <><EqBars active={true} party={partyMode} /> TOCANDO AGORA</>
                      : <><Music size={18} /> PRÓXIMA FAIXA</>
                    }
                  </div>
                </div>
              </div>

              {/* Audio Visualizer or Progress Bar */}
              <div className="relative z-30 w-full max-w-md mb-3">
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
                    "relative z-30 mb-1 text-3xl lg:text-4xl font-display uppercase leading-none tracking-tighter",
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
                    "relative z-30 text-xl lg:text-2xl font-body font-black uppercase tracking-widest text-brand-lime leading-none italic",
                    partyMode && "color-cycle",
                  )}
                >
                  {nowPlaying.artist}
                </motion.p>
              </AnimatePresence>

              <div className={cn(
                "relative z-30 mt-3 flex items-center gap-3 border-4 border-brand-cream bg-white/5 px-4 py-2 backdrop-blur-sm",
                partyMode && "neon-border",
              )}>
                <div className="h-3.5 w-3.5 animate-pulse rounded-full bg-red-600 shadow-[0_0_8px_red]" />
                <p className="font-display text-base italic uppercase leading-none text-on-primary">
                  REQUISITADO POR{" "}
                  <span className="text-brand-lime">@{nowPlaying.client_name}</span>
                </p>
              </div>

              {nowPlaying.dedication_to && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative z-30 mt-3 flex items-center gap-3 border-4 border-brand-lime bg-brand-lime/10 px-6 py-3"
                >
                  <span className="text-2xl">❤️</span>
                  <p className="font-display text-base italic uppercase leading-none text-on-primary">
                    PARA{" "}
                    <span className="text-brand-lime">{nowPlaying.dedication_to}</span>
                  </p>
                </motion.div>
              )}
            </>
          ) : (
            <div className={cn(
              "font-display text-2xl lg:text-3xl opacity-30 animate-bounce text-center leading-tight",
              partyMode && "neon-text opacity-60",
            )}>
              AGUARDANDO O PRÓXIMO HIT...
            </div>
          )}
        </section>

        {/* Right: Up Next + QR */}
        <section className={cn(
          "flex flex-1 flex-col border-l-8 border-brand-blue py-4 lg:py-6 min-h-0 overflow-hidden",
          partyMode ? "bg-black" : "bg-white",
        )}>
          <div className="mb-4 px-8">
            <h3 className={cn(
              "inline-block border-b-4 border-brand-lime font-display text-xl lg:text-2xl uppercase italic tracking-tighter",
              partyMode ? "text-brand-lime neon-text" : "text-brand-blue",
            )}>
              PRÓXIMOS DA FILA
            </h3>
          </div>

          <div className="flex-1 min-h-0 space-y-3 overflow-hidden px-8">
            {upNext.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className={cn(
                  "h-full flex flex-col items-center justify-center text-center opacity-20 space-y-4",
                  partyMode ? "text-brand-lime" : "text-brand-blue",
                )}
              >
                <motion.div
                  animate={{ y: [0, -14, 0] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Music size={64} />
                </motion.div>
                <p className="font-display text-xl">FILA VAZIA</p>
              </motion.div>
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

          {/* Photo slideshow panel */}
          {config.photo_display_mode === "slideshow" && approvedPhotos.length > 0 && (
            <div className="px-8 mt-3 flex-shrink-0">
              <div className="border-4 border-brand-blue overflow-hidden relative" style={{ height: 120 }}>
                <AnimatePresence mode="crossfade">
                  <motion.img
                    key={approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.id}
                    src={approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.photo_url}
                    alt="Foto da noite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                </AnimatePresence>
                {approvedPhotos[currentPhotoIdx % approvedPhotos.length]?.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                    <p className="font-display text-brand-lime text-lg uppercase truncate">
                      {approvedPhotos[currentPhotoIdx % approvedPhotos.length].caption}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={cn(
            "flex-shrink-0 mt-auto px-6 py-3 border-t-8 border-brand-blue",
            partyMode
              ? "bg-black text-brand-lime neon-border"
              : "bg-brand-lime text-on-accent shadow-[-4px_-4px_0px_var(--color-brand-blue)]",
          )}>
            <p className="font-display text-base leading-none uppercase tracking-tighter mb-2">PEÇA PELO CELULAR:</p>
            <div className="flex items-center gap-4">
              <div className={cn(
                "aspect-square w-24 border-4 bg-white p-1 flex-shrink-0",
                partyMode ? "border-brand-lime neon-border" : "border-brand-blue shadow-[4px_4px_0px_var(--color-brand-blue)]",
              )}>
                <QRCodeSVG
                  value={clientUrl}
                  size={82}
                  bgColor="#1A1A1A"
                  fgColor="#FFB800"
                  level="H"
                />
              </div>
              <div className="space-y-1">
                <p className="font-body text-sm font-black uppercase leading-none italic">
                  TOCAÍ.COM/{slug}
                </p>
                <p className="font-body text-xs font-bold uppercase opacity-70">
                  Aumente o volume, quem manda no bar hoje é você.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Marquee ticker */}
      <div className={cn(
        "flex-shrink-0 border-t-4 border-brand-blue overflow-hidden py-2",
        partyMode ? "bg-black text-brand-lime" : "bg-brand-blue text-brand-lime",
      )}>
        <div className="marquee-track whitespace-nowrap font-display text-sm lg:text-base uppercase tracking-wide">
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
        "flex items-center gap-4 border-4 border-brand-blue p-3",
        party
          ? "bg-black text-brand-lime neon-border"
          : "bg-white shadow-[4px_4px_0px_var(--color-brand-lime)]",
      )}
    >
      <span className={cn("font-display text-2xl leading-none tracking-tighter flex-shrink-0", party ? "text-brand-lime neon-text" : "text-brand-blue")}>
        {rank}º
      </span>
      <div className="flex-1 overflow-hidden">
        <h4 className={cn("truncate text-lg lg:text-xl font-display uppercase leading-none tracking-tighter", party ? "text-brand-lime" : "text-brand-blue")}>
          {title}
        </h4>
        <p className={cn("truncate font-body text-sm font-black uppercase italic tracking-tight", party ? "text-brand-lime/70" : "text-brand-blue/60")}>
          {artist}
        </p>
        {dedicationTo && (
          <p className="font-body text-sm font-bold uppercase text-pink-500 italic truncate">❤️ para {dedicationTo}</p>
        )}
      </div>
      <div className={cn("text-right border-l-4 pl-5 flex-shrink-0", party ? "border-brand-lime" : "border-brand-lime")}>
        <span className={cn("font-body text-[10px] font-black uppercase leading-none block mb-1 tracking-widest", party ? "text-brand-lime/50" : "text-brand-blue/50")}>
          PARA @{client}
        </span>
        <p className={cn("font-display text-lg leading-none", party ? "text-brand-lime neon-text" : "text-brand-blue")}>
          PRÓXIMA
        </p>
      </div>
    </motion.div>
  );
}
