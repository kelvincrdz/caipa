import { useState, useEffect, useRef, useCallback, type MutableRefObject } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Disc, Pause, Disc3, Clock, TrendingUp, Flame, Heart, User, HeartHandshake } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQueue } from "../hooks/useQueue";
import { usePlayer } from "../hooks/usePlayer";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";
import { applyTheme } from "../lib/themes";

type StingerVariant = "classic" | "gol_de_placa" | "ritmo_noite" | "palco_rock";

function resolveStingerVariant(theme?: string): StingerVariant {
  const t = (theme ?? "").toLowerCase();
  if (/(futebol|arena|torcida|gol|esporte)/.test(t)) return "gol_de_placa";
  if (/(samba|pagode|forr|ax[ée]|funk|mpb)/.test(t)) return "ritmo_noite";
  if (/(rock|metal|indie|punk)/.test(t)) return "palco_rock";
  return "classic";
}

function playStingerSfx(ctxRef: MutableRefObject<AudioContext | null>, variant: StingerVariant) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!ctxRef.current) ctxRef.current = new Ctx();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.connect(gain);

    if (variant === "gol_de_placa") {
      osc.type = "square";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.2);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      const horn = ctx.createOscillator();
      const hornGain = ctx.createGain();
      horn.type = "sawtooth";
      horn.frequency.setValueAtTime(340, now + 0.06);
      horn.frequency.exponentialRampToValueAtTime(520, now + 0.28);
      hornGain.gain.setValueAtTime(0.0001, now + 0.06);
      hornGain.gain.exponentialRampToValueAtTime(0.04, now + 0.12);
      hornGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      horn.connect(hornGain);
      hornGain.connect(ctx.destination);
      horn.start(now + 0.06);
      horn.stop(now + 0.43);
    } else if (variant === "ritmo_noite") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(460, now + 0.18);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    } else if (variant === "palco_rock") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.22);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.2);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    }

    osc.start(now);
    osc.stop(now + 0.48);
  } catch {
    // Avoid breaking visual transition if audio is blocked by the environment.
  }
}

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
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [coverSpotlightIdx, setCoverSpotlightIdx] = useState(0);
  const [stingerTrack, setStingerTrack] = useState<any | null>(null);
  const [showStinger, setShowStinger] = useState(false);
  const prevNowPlayingIdRef = useRef<string | null>(null);
  const stingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stingerAudioCtxRef = useRef<AudioContext | null>(null);

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
    supabase.from("bars").select("theme_primary,theme_accent,logo_url,visual_theme").eq("slug", slug).maybeSingle()
      .then(({ data }) => {
        applyTheme(data?.visual_theme ?? 'boteco');
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
      applyTheme('boteco');
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
  const coverRail = [...recentTracks.slice(0, 3), ...queue.slice(0, 6)].filter(Boolean);
  const stingerVariant = resolveStingerVariant(config.theme);

  useEffect(() => {
    if (!nowPlaying?.id) return;
    const previousId = prevNowPlayingIdRef.current;
    if (previousId && previousId !== nowPlaying.id) {
      const previousTrack = queue.find(item => item.id === previousId);
      if (previousTrack) {
        setRecentTracks(prev => [previousTrack, ...prev.filter(item => item.id !== previousTrack.id)].slice(0, 8));
      }
      setStingerTrack(nowPlaying);
      setShowStinger(true);
      playStingerSfx(stingerAudioCtxRef, stingerVariant);
      if (stingerTimerRef.current) clearTimeout(stingerTimerRef.current);
      stingerTimerRef.current = setTimeout(() => setShowStinger(false), 1300);
    }
    prevNowPlayingIdRef.current = nowPlaying.id;
  }, [nowPlaying, queue, stingerVariant]);

  useEffect(() => {
    if (coverRail.length < 2) return;
    const t = setInterval(() => {
      setCoverSpotlightIdx(i => (i + 1) % coverRail.length);
    }, 2600);
    return () => clearInterval(t);
  }, [coverRail.length]);

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
    `* ${item.title} -- ${item.artist}${item.dedication_to ? ` [para: ${item.dedication_to}]` : ""}  @${item.client_name}`
  );
  const tickerText = tickerItems.length > 0
    ? tickerItems.join("   /   ")
    : "* Nenhuma musica na fila -- seja o primeiro a pedir!";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "flex h-screen w-full flex-col overflow-hidden bg-brand-cream border-[8px] border-brand-blue/20 shadow-[0_6px_24px_rgba(0,80,157,0.15)] selection:bg-brand-lime",
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

      <AnimatePresence>
        {showStinger && stingerTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="pointer-events-none fixed inset-0 z-[120]"
          >
            {stingerVariant === "gol_de_placa" ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 0.86, times: [0, 0.18, 1] }}
                  className="absolute inset-0 bg-white"
                />
                <motion.div
                  initial={{ x: "-120%", skewX: -12 }}
                  animate={{ x: ["-120%", "0%", "0%", "110%"], skewX: [-12, 0, 0, 12] }}
                  transition={{ duration: 1.28, times: [0, 0.22, 0.72, 1], ease: "easeInOut" }}
                  className="absolute top-[32%] left-0 right-0 border-y-8 border-brand-lime bg-brand-blue px-8 py-7"
                >
                  <p className="font-display text-brand-lime text-3xl lg:text-6xl uppercase tracking-tight">GOL DE PLACA</p>
                  <p className="font-display text-white text-xl lg:text-4xl uppercase truncate">{stingerTrack.title}</p>
                </motion.div>
              </>
            ) : stingerVariant === "ritmo_noite" ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.7, 0] }}
                  transition={{ duration: 0.9, times: [0, 0.24, 1] }}
                  className="absolute inset-0 bg-gradient-to-r from-brand-blue via-brand-lime/70 to-brand-blue"
                />
                <motion.div
                  initial={{ y: 120, opacity: 0 }}
                  animate={{ y: [120, 0, 0, -120], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 1.22, times: [0, 0.2, 0.72, 1], ease: "easeInOut" }}
                  className="absolute top-[36%] left-[8%] right-[8%] border-8 border-brand-lime bg-brand-blue/95 px-8 py-6"
                >
                  <p className="font-display text-brand-lime text-2xl lg:text-5xl uppercase tracking-tight">RITMO DA NOITE</p>
                  <p className="font-display text-white text-xl lg:text-4xl uppercase truncate">{stingerTrack.title}</p>
                </motion.div>
              </>
            ) : stingerVariant === "palco_rock" ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.9, 0] }}
                  transition={{ duration: 0.82, times: [0, 0.16, 1] }}
                  className="absolute inset-0 bg-black"
                />
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: [0.8, 1.03, 1], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.15, times: [0, 0.26, 1], ease: "easeOut" }}
                  className="absolute top-[34%] left-[10%] right-[10%] border-8 border-brand-lime bg-brand-blue px-8 py-6"
                >
                  <p className="font-display text-brand-lime text-2xl lg:text-5xl uppercase tracking-tight">PALCO ABERTO</p>
                  <p className="font-display text-white text-xl lg:text-4xl uppercase truncate">{stingerTrack.title}</p>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0] }}
                  transition={{ duration: 0.8, times: [0, 0.2, 1] }}
                  className="absolute inset-0 bg-white"
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: ["-100%", "0%", "0%", "100%"] }}
                  transition={{ duration: 1.2, times: [0, 0.22, 0.72, 1], ease: "easeInOut" }}
                  className="absolute top-[35%] left-0 right-0 border-y-8 border-brand-lime bg-brand-blue px-8 py-6"
                >
                  <p className="font-display text-brand-lime text-3xl lg:text-6xl uppercase tracking-tight">TOCANDO AGORA</p>
                  <p className="font-display text-white text-xl lg:text-4xl uppercase truncate">{stingerTrack.title}</p>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-brand-blue/15 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-6 py-3 lg:px-10 lg:py-4 text-charcoal z-10">
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
          <p className="font-body text-xs font-black italic uppercase opacity-85">
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
                  <HeartHandshake size={24} className="text-brand-lime flex-shrink-0" />
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
          "flex flex-1 flex-col border-l border-brand-blue/15 shadow-[-2px_0_8px_rgba(0,0,0,0.06)] py-4 lg:py-6 min-h-0 overflow-hidden",
          partyMode ? "bg-black" : "bg-brand-cream",
        )}>
          <div className="mb-4 px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-[3px] items-end h-6">
                {[0.9, 0.5, 0.75, 0.35, 0.6].map((base, i) => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [base, 1, base * 0.4, 1, base] }}
                    transition={{ duration: 1.1 + i * 0.18, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
                    className={cn("w-1.5 origin-bottom rounded-sm", partyMode ? "bg-brand-lime" : "bg-brand-lime")}
                    style={{ height: "100%" }}
                  />
                ))}
              </div>
              <h3 className={cn(
                "font-display text-xl lg:text-2xl uppercase italic tracking-tighter border-b-4 border-brand-lime",
                partyMode ? "text-brand-lime neon-text" : "text-brand-blue",
              )}>
                PRÓXIMOS DA FILA
              </h3>
            </div>
            {upNext.length > 0 && (
              <motion.span
                key={upNext.length}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className={cn(
                  "font-display text-xl leading-none px-2.5 py-0.5 border-4",
                  partyMode ? "border-brand-lime text-brand-lime neon-text" : "bg-brand-lime text-on-accent border-brand-blue shadow-[3px_3px_0px_var(--color-brand-blue)]",
                )}
              >
                {upNext.length}
              </motion.span>
            )}
          </div>

          {coverRail.length > 0 && (
            <div className="px-8 mb-4 flex-shrink-0">
              <div className="flex gap-2 overflow-hidden">
                {coverRail.slice(0, 6).map((item, idx) => {
                  const isActive = idx === (coverSpotlightIdx % Math.max(coverRail.length, 1));
                  return (
                    <motion.div
                      key={item.id + "-thumb-" + idx}
                      animate={{
                        scale: isActive ? 1.14 : 1,
                        opacity: isActive ? 1 : 0.45,
                        y: isActive ? -3 : 0,
                      }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className={cn(
                        "h-14 w-14 flex-shrink-0 border-2 overflow-hidden relative",
                        isActive
                          ? partyMode
                            ? "border-brand-lime shadow-[0_0_14px_var(--color-brand-lime)]"
                            : "border-brand-lime shadow-[3px_3px_0px_var(--color-brand-blue)]"
                          : "border-transparent",
                      )}
                    >
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className={cn("h-full w-full flex items-center justify-center", partyMode ? "bg-black" : "bg-brand-blue/10")}>
                          <Music size={16} className={cn(partyMode ? "text-brand-lime/70" : "text-brand-blue/50")} />
                        </div>
                      )}
                      {isActive && (
                        <motion.div
                          layoutId="cover-active-dot"
                          className="absolute bottom-0.5 left-0 right-0 flex justify-center"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-lime" />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 space-y-2 overflow-hidden px-8">
            <AnimatePresence mode="popLayout">
            {upNext.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
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
                  thumbnailUrl={item.thumbnail_url}
                  title={item.title}
                  artist={item.artist}
                  client={item.client_name}
                  dedicationTo={item.dedication_to}
                  score={item.score ?? 0}
                  reactions={item.reactions}
                  tags={item.tags}
                  estimatedMinutes={Math.round((idx + 1) * 3.5)}
                  delay={idx * 0.08}
                  party={partyMode}
                />
              ))
            )}            </AnimatePresence>          </div>

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
                <p className="font-body text-xs font-bold uppercase opacity-90">
                  Aumente o volume, quem manda no bar hoje é você.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Marquee ticker */}
      <div className={cn(
        "flex-shrink-0 border-t border-brand-blue/15 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] overflow-hidden py-2",
        partyMode ? "bg-black text-brand-lime" : "bg-brand-blue text-brand-lime",
      )}>
        <div className="marquee-track whitespace-nowrap font-display font-black text-sm lg:text-base uppercase tracking-wide">
          <span className="marquee-content">{tickerText}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{tickerText}</span>
        </div>
      </div>
    </motion.div>
  );
}

function TVQueueItem({
  rank, thumbnailUrl, title, artist, client, dedicationTo, score, reactions, tags, estimatedMinutes, delay = 0, party,
}: {
  key?: string;
  rank: number;
  thumbnailUrl?: string;
  title: string;
  artist: string;
  client: string;
  dedicationTo?: string;
  score?: number;
  reactions?: { fire?: number; heart?: number } | null;
  tags?: string[];
  estimatedMinutes?: number;
  delay?: number;
  party: boolean;
}) {
  const fire = reactions?.fire ?? 0;
  const heart = reactions?.heart ?? 0;
  const hasReactions = fire > 0 || heart > 0;
  const isSuperVoted = (score ?? 0) >= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40, transition: { duration: 0.25 } }}
      transition={{ delay, duration: 0.38, ease: "easeOut" }}
      whileHover={{ x: -3, transition: { duration: 0.12 } }}
      className={cn(
        "flex items-stretch gap-0 relative overflow-hidden border-l-[6px] border-brand-lime",
        party
          ? "bg-black border-r border-r-brand-lime/20"
          : "bg-white border-4 border-l-[6px] border-brand-blue shadow-[4px_4px_0px_var(--color-brand-lime)]",
      )}
    >
      {/* Rank column */}
      <div className={cn(
        "flex-shrink-0 w-8 flex flex-col items-center justify-center",
        party ? "bg-brand-lime/10" : "bg-brand-lime/15",
      )}>
        <span className={cn(
          "font-display text-xl leading-none tracking-tighter",
          party ? "text-brand-lime neon-text" : "text-brand-blue",
        )}>{rank}º</span>
      </div>

      {/* Thumbnail */}
      <div className={cn(
        "h-16 w-16 flex-shrink-0 overflow-hidden border-r-2",
        party ? "border-brand-lime/30" : "border-brand-blue/20",
      )}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className={cn("h-full w-full flex items-center justify-center", party ? "bg-black" : "bg-brand-blue/5")}>
            <Music size={20} className={cn(party ? "text-brand-lime/60" : "text-brand-blue/30")} />
          </div>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 overflow-hidden px-2.5 py-1.5 flex flex-col justify-between">
        {/* Title row */}
        <h4 className={cn(
          "truncate text-sm lg:text-base font-display uppercase leading-none tracking-tighter",
          party ? "text-brand-lime" : "text-brand-blue",
        )}>
          {title}
        </h4>

        {/* Artist + tags */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <p className={cn(
            "truncate font-body text-[11px] font-black uppercase italic tracking-tight",
            party ? "text-brand-lime/70" : "text-brand-blue/65",
          )}>{artist}</p>
          {tags && tags.length > 0 && (
            <span className={cn(
              "flex-shrink-0 font-body text-[9px] font-black uppercase px-1 py-0.5 border leading-none",
              party ? "border-brand-lime/40 text-brand-lime/60" : "border-brand-blue/30 text-brand-blue/50",
            )}>{tags[0]}</span>
          )}
        </div>

        {/* Meta row: requester + estimated time */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1 overflow-hidden">
            <User size={9} className={cn(party ? "text-brand-lime/50 flex-shrink-0" : "text-brand-blue/40 flex-shrink-0")} />
            <span className={cn(
              "font-body text-[10px] font-black uppercase truncate",
              party ? "text-brand-lime/70" : "text-brand-blue/60",
            )}>@{client}</span>
          </div>
          {estimatedMinutes !== undefined && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Clock size={9} className={cn(party ? "text-brand-lime/50" : "text-brand-blue/40")} />
              <span className={cn(
                "font-body text-[10px] font-black uppercase",
                party ? "text-brand-lime/70" : "text-brand-blue/60",
              )}>~{estimatedMinutes}min</span>
            </div>
          )}
        </div>

        {/* Dedication */}
        {dedicationTo && (
          <p className="font-body text-[10px] font-bold uppercase text-pink-400 italic truncate flex items-center gap-0.5">
            <Heart size={9} className="flex-shrink-0 fill-pink-400 text-pink-400" />
            {dedicationTo}
          </p>
        )}
      </div>

      {/* Right stats column */}
      <div className={cn(
        "flex-shrink-0 flex flex-col items-center justify-center gap-1.5 px-2 border-l-2",
        party ? "border-brand-lime/20" : "border-brand-blue/15",
      )}>
        {/* Score / votes */}
        <div className={cn(
          "flex flex-col items-center gap-0.5 px-1.5 py-1 border",
          isSuperVoted
            ? party
              ? "border-yellow-400 bg-yellow-400/10"
              : "border-yellow-500 bg-yellow-50"
            : party
              ? "border-brand-lime/30 bg-transparent"
              : "border-brand-blue/20 bg-transparent",
        )}>
          <TrendingUp
            size={12}
            className={cn(isSuperVoted ? "text-yellow-400" : party ? "text-brand-lime/70" : "text-brand-blue/60")}
          />
          <span className={cn(
            "font-display text-sm leading-none",
            isSuperVoted ? "text-yellow-400" : party ? "text-brand-lime neon-text" : "text-brand-blue",
          )}>{score ?? 0}</span>
        </div>

        {/* Reactions */}
        {hasReactions && (
          <div className="flex flex-col items-center gap-0.5">
            {fire > 0 && (
              <div className="flex items-center gap-0.5">
                <Flame size={10} className="text-orange-400" />
                <span className={cn("font-display text-xs leading-none", party ? "text-orange-400" : "text-orange-500")}>{fire}</span>
              </div>
            )}
            {heart > 0 && (
              <div className="flex items-center gap-0.5">
                <Heart size={10} className="text-pink-400" />
                <span className={cn("font-display text-xs leading-none", party ? "text-pink-400" : "text-pink-500")}>{heart}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
