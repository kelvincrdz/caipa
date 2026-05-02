import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Beer, Users, ArrowRight, MapPin, Disc, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { OverflowMarquee } from "../components/OverflowMarquee";

// ── Animated counter ─────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target === 0 || started.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        started.current = true;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(eased * target));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const { value: displayed, ref } = useCountUp(value);
  return (
    <div ref={ref} className="card-bento bg-white p-8 flex flex-col items-center text-center">
      <div className="mb-4 text-brand-blue drop-shadow-[3px_3px_0px_var(--color-brand-lime)]">{icon}</div>
      <p
        key={displayed}
        className="font-display text-7xl md:text-8xl leading-none text-brand-blue tabular-nums"
        style={{ animation: "count-up 0.2s ease-out both" }}
      >
        {displayed.toLocaleString("pt-BR")}
      </p>
      <p className="mt-2 font-body text-base font-bold uppercase opacity-60 italic">{label}</p>
    </div>
  );
}

// ── Live bar card ─────────────────────────────────────────────────────────────
function LiveBarCard({ bar, nowPlaying, queueCount }: {
  bar: any;
  nowPlaying: any;
  queueCount: number;
}) {
  return (
    <Link to={`/${bar.slug}`} className="block flex-shrink-0 w-72">
      <motion.div
        whileHover={{ y: -4, transition: { duration: 0.1 } }}
        className="bg-white border border-brand-blue/25 border-t-[6px] border-t-brand-blue shadow-[0_2px_8px_rgba(0,80,157,0.08)] p-4 flex flex-col gap-4 cursor-pointer"
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-display text-xl font-black text-charcoal uppercase leading-tight">{bar.name}</h3>
            {bar.address && (
              <p className="font-body text-xs font-bold text-muted-steel flex items-center gap-1 truncate mt-0.5">
                <MapPin size={10} />
                {bar.address.split(",").slice(-2).join(",").trim()}
              </p>
            )}
          </div>
          <span className="bg-brand-lime text-charcoal font-body font-black px-2 py-1 border-2 border-brand-blue/20 shadow-[0_1px_6px_rgba(0,80,157,0.08)] text-xs uppercase whitespace-nowrap">
            {queueCount} FILA
          </span>
        </div>

        {nowPlaying ? (
          <div className="flex items-center gap-3 bg-brand-cream/40 p-2 border-2 border-brand-blue/20 shadow-[0_1px_6px_rgba(0,80,157,0.08)]">
            {nowPlaying.thumbnail_url ? (
              <img
                src={nowPlaying.thumbnail_url}
                alt={nowPlaying.title}
                className="h-10 w-10 object-cover border-2 border-brand-blue flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 flex items-center justify-center bg-brand-blue flex-shrink-0">
                <Disc size={18} className="text-brand-lime" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-body text-[10px] font-black uppercase text-brand-blue mb-0.5">TOCANDO AGORA</p>
              <OverflowMarquee
                text={nowPlaying.title}
                className="font-display text-sm font-black leading-none uppercase"
              />
              <p className="font-body text-xs font-bold text-muted-steel truncate">{nowPlaying.artist}</p>
            </div>
          </div>
        ) : (
          <div className="border border-brand-blue/25/30 p-3 text-center">
            <p className="font-body text-xs font-bold uppercase text-muted-steel/60">Nenhuma música tocando</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-display text-sm font-black uppercase text-red-600 tracking-widest">AO VIVO</span>
          </div>
          <ArrowRight size={16} className="text-brand-blue/40" />
        </div>
      </motion.div>
    </Link>
  );
}

// ── Realtime carousel card ───────────────────────────────────────────────────
function CarouselCard({ item }: { item: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      className="flex-shrink-0 w-48 bg-white border border-brand-blue/25 shadow-[0_2px_8px_rgba(0,80,157,0.08)] p-4"
    >
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className="w-full aspect-square object-cover border-2 border-brand-blue/20 mb-3"
        />
      ) : (
        <div className="w-full aspect-square bg-brand-blue flex items-center justify-center mb-3">
          <Music size={28} className="text-brand-lime" />
        </div>
      )}
      <p className="font-display text-sm font-black leading-none uppercase truncate">{item.title}</p>
      <p className="font-body text-xs font-bold text-muted-steel truncate">{item.artist}</p>
      {item.bar_name && (
        <p className="font-body text-[10px] font-bold uppercase mt-1 text-muted-steel/60 truncate flex items-center gap-1">
          <Radio size={8} />
          {item.bar_name}
        </p>
      )}
    </motion.div>
  );
}

// ── Leaflet map ───────────────────────────────────────────────────────────────
function LiveMap({ bars }: { bars: Array<{ slug: string; name: string; lat: number; lng: number; address?: string; isLive: boolean }> }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const initMap = useCallback(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || instanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([-15.78, -47.93], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    instanceRef.current = map;
  }, []);

  useEffect(() => {
    initMap();
    // CDN might not be ready yet — retry
    const t = setInterval(() => {
      if ((window as any).L) { initMap(); clearInterval(t); }
    }, 300);
    return () => {
      clearInterval(t);
      if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; }
    };
  }, [initMap]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !instanceRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    bars.forEach(bar => {
      const color = bar.isLive ? "#FFB800" : "#807A6D";
      const border = bar.isLive ? "#FFB800" : "#252525";
      const anim = bar.isLive ? "animation:map-pulse 1.5s ease-in-out infinite;" : "";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;background:${color};border:3px solid ${border};border-radius:50%;${anim}cursor:pointer"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([bar.lat, bar.lng], { icon })
        .addTo(instanceRef.current)
        .bindPopup(
          `<div style="font-family:sans-serif;min-width:160px">
            ${bar.isLive ? '<span style="color:red;font-weight:bold;font-size:11px">● AO VIVO</span><br>' : ""}
            <b style="font-size:15px">${bar.name}</b>
            ${bar.address ? `<br><small>${bar.address}</small>` : ""}
            <br><a href="/${bar.slug}" style="display:inline-block;margin-top:6px;background:#FFB800;color:#0A0A0A;padding:4px 10px;font-weight:bold;font-size:12px;text-decoration:none">VER BAR →</a>
          </div>`,
          { maxWidth: 220 },
        );

      markersRef.current.push(marker);
    });
  }, [bars]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-none border-0"
      style={{ height: 420 }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [stats, setStats] = useState({ bars: 0, todayRequests: 0, liveNow: 0 });
  const [liveBars, setLiveBars] = useState<any[]>([]);
  const [carousel, setCarousel] = useState<any[]>([]);
  const [mapBars, setMapBars] = useState<any[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Load stats
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from("bars").select("id", { count: "exact", head: true }).eq("is_approved", true),
      supabase.from("queue_items").select("id", { count: "exact", head: true }).gte("requested_at", today.toISOString()),
      supabase.from("queue_items").select("bar_slug").eq("status", "pending"),
    ]).then(([barsRes, reqsRes, liveRes]) => {
      const liveBarSlugs = new Set((liveRes.data ?? []).map((r: any) => r.bar_slug));
      setStats({
        bars: barsRes.count ?? 0,
        todayRequests: reqsRes.count ?? 0,
        liveNow: liveBarSlugs.size,
      });
      setStatsLoaded(true);
    });
  }, []);

  // Load live bars + map bars
  useEffect(() => {
    supabase
      .from("queue_items")
      .select("bar_slug, title, artist, thumbnail_url")
      .eq("status", "pending")
      .order("score", { ascending: false })
      .limit(200)
      .then(async ({ data: qItems }) => {
        if (!qItems) return;

        const grouped: Record<string, any[]> = {};
        for (const item of qItems) {
          if (!grouped[item.bar_slug]) grouped[item.bar_slug] = [];
          grouped[item.bar_slug].push(item);
        }

        const slugs = Object.keys(grouped);
        if (slugs.length === 0) return;

        const { data: bars } = await supabase
          .from("bars")
          .select("slug, name, address, lat, lng")
          .in("slug", slugs)
          .eq("is_approved", true);

        if (!bars) return;

        const liveData = bars.map(bar => ({
          bar,
          nowPlaying: grouped[bar.slug]?.[0] ?? null,
          queueCount: grouped[bar.slug]?.length ?? 0,
        }));

        setLiveBars(liveData);
      });
  }, []);

  // Load map bars (all approved with coordinates)
  useEffect(() => {
    supabase
      .from("bars")
      .select("slug, name, address, lat, lng")
      .eq("is_approved", true)
      .not("lat", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const liveSlugSet = new Set(liveBars.map(l => l.bar.slug));
        setMapBars(data.map(b => ({ ...b, isLive: liveSlugSet.has(b.slug) })));
      });
  }, [liveBars]);

  // Realtime carousel — recent requests across all bars
  useEffect(() => {
    supabase
      .from("queue_items")
      .select("id, title, artist, thumbnail_url, bar_slug, requested_at")
      .neq("status", "played")
      .order("requested_at", { ascending: false })
      .limit(20)
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;

        const slugs = [...new Set(data.map(d => d.bar_slug))];
        const { data: bars } = await supabase
          .from("bars")
          .select("slug, name")
          .in("slug", slugs);

        const barNames: Record<string, string> = {};
        (bars ?? []).forEach((b: any) => { barNames[b.slug] = b.name; });

        setCarousel(data.map(d => ({ ...d, bar_name: barNames[d.bar_slug] })));
      });

    const ch = supabase
      .channel("home_carousel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "queue_items" },
        async (payload) => {
          const item = payload.new as any;
          const { data: bar } = await supabase
            .from("bars")
            .select("name")
            .eq("slug", item.bar_slug)
            .maybeSingle();
          setCarousel(prev =>
            [{ ...item, bar_name: bar?.name }, ...prev].slice(0, 20),
          );
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <main className="flex flex-col items-center">
      {/* TopAppBar */}
      <header className="bg-white border-b border-brand-blue/15 shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex justify-between items-center w-full px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="font-display text-2xl font-black text-brand-blue tracking-wider uppercase">TOCAÍ</span>
        </div>
        <nav className="hidden md:flex gap-6">
          <a className="font-display font-black uppercase tracking-tight text-brand-blue border-b-4 border-brand-blue hover:bg-zinc-100 transition-all duration-75 px-2 py-1" href="#">INÍCIO</a>
          <Link className="font-display font-black uppercase tracking-tight text-zinc-500 hover:bg-zinc-100 transition-all duration-75 px-2 py-1" to="/cadastro">CADASTRAR BAR</Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="bg-azulejo w-full min-h-[600px] flex flex-col items-center justify-center px-5 md:px-10 py-16 relative overflow-hidden border-b border-brand-blue/15">
        <div className="absolute inset-0 bg-white/40" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto space-y-6 bg-white/95 p-8 border-2 border-brand-blue shadow-[0_4px_20px_rgba(0,80,157,0.12)]"
        >
          <h1 className="font-display text-[80px] md:text-[120px] leading-none font-black text-brand-blue tracking-tighter">
            TOCAÍ
          </h1>
          <p className="font-display text-2xl md:text-4xl font-black text-charcoal max-w-2xl bg-brand-lime px-4 py-3 border border-brand-blue/20 shadow-[0_2px_12px_rgba(0,80,157,0.10)] uppercase leading-tight">
            A MÚSICA É SUA.<br />O BOTECO TAMBÉM.
          </p>
          <div className="pt-4">
            <Link
              to="/cadastro"
              className="btn-bento flex items-center gap-3 text-xl md:text-2xl px-8 py-4"
            >
              ABRIR MEU BAR <ArrowRight size={28} strokeWidth={3} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stat Strip Marquee */}
      <section className="w-full bg-brand-blue border-y-4 border-brand-blue/20 py-4 overflow-hidden flex whitespace-nowrap">
        <div className="flex gap-16 px-8 marquee-content">
          {statsLoaded && (<>
            <div className="flex items-center gap-4">
              <Beer size={28} className="text-brand-lime flex-shrink-0" strokeWidth={2.5} />
              <span className="font-display text-white text-2xl uppercase tracking-tighter font-bold">{stats.bars.toLocaleString("pt-BR")} BARES NA REDE</span>
            </div>
            <div className="flex items-center gap-4">
              <Music size={28} className="text-brand-lime flex-shrink-0" strokeWidth={2.5} />
              <span className="font-display text-white text-2xl uppercase tracking-tighter font-bold">{stats.todayRequests.toLocaleString("pt-BR")} PEDIDOS HOJE</span>
            </div>
            <div className="flex items-center gap-4">
              <Radio size={28} className="text-brand-lime flex-shrink-0" strokeWidth={2.5} />
              <span className="font-display text-white text-2xl uppercase tracking-tighter font-bold">{stats.liveNow} AO VIVO AGORA</span>
            </div>
            <div className="flex items-center gap-4">
              <Beer size={28} className="text-brand-lime flex-shrink-0" strokeWidth={2.5} />
              <span className="font-display text-white text-2xl uppercase tracking-tighter font-bold">{stats.bars.toLocaleString("pt-BR")} BARES NA REDE</span>
            </div>
          </>)}
          {!statsLoaded && (
            <span className="font-display text-white text-2xl uppercase tracking-tighter font-bold opacity-40">CARREGANDO...</span>
          )}
        </div>
      </section>

      {/* Ao Vivo Agora */}
      {liveBars.length > 0 && (
        <section className="w-full bg-brand-cream bg-azulejo py-12 px-5 md:px-10 border-b border-brand-blue/15">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white p-8 border-2 border-brand-blue shadow-[0_4px_20px_rgba(0,80,157,0.12)]">
              <div className="flex items-center gap-4 mb-8">
                <h2 className="font-display font-black text-4xl md:text-5xl text-charcoal uppercase bg-brand-lime px-4 py-2 border border-brand-blue/20 shadow-[0_2px_12px_rgba(0,80,157,0.10)] inline-block leading-none">AO VIVO AGORA</h2>
                <div className="h-4 w-4 bg-red-500 rounded-full animate-pulse border-2 border-charcoal" />
              </div>
              <div className="flex gap-5 overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
                {liveBars.map(({ bar, nowPlaying, queueCount }) => (
                  <LiveBarCard
                    key={bar.slug}
                    bar={bar}
                    nowPlaying={nowPlaying}
                    queueCount={queueCount}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* O que está tocando — carousel */}
      {carousel.length > 0 && (
        <section className="w-full bg-white border-b border-brand-blue/15 py-10 overflow-hidden">
          <div className="mx-auto max-w-7xl px-5 md:px-10 mb-5">
            <h2 className="font-display text-3xl md:text-5xl text-brand-blue font-black uppercase leading-none tracking-tighter">
              O QUE ESTÁ TOCANDO
            </h2>
            <p className="font-body text-sm font-bold uppercase text-muted-steel mt-1">
              Pedidos em tempo real em toda a rede TocaÍ
            </p>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-auto px-5 md:px-10 pb-4"
            style={{ scrollbarWidth: "none" }}
          >
            <AnimatePresence mode="popLayout">
              {carousel.map(item => (
                <CarouselCard key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Mapa interativo */}
      {mapBars.length > 0 && (
        <section className="w-full bg-brand-cream bg-azulejo border-b border-brand-blue/15 py-12 px-5 md:px-10">
          <div className="max-w-7xl mx-auto">
            <div className="bg-white p-8 border-2 border-brand-blue shadow-[0_4px_20px_rgba(0,80,157,0.12)]">
              <div className="flex flex-col lg:flex-row gap-8">
                <div className="lg:w-1/3 flex flex-col justify-center space-y-4">
                  <h2 className="font-display font-black text-4xl md:text-5xl text-charcoal uppercase leading-tight">
                    ONDE TEM<br />
                    <span className="text-brand-blue bg-brand-lime px-2 border border-brand-blue/20 shadow-[0_2px_12px_rgba(0,80,157,0.10)] inline-block mt-2">TOCAÍ</span>
                  </h2>
                  <p className="font-body text-base font-bold text-charcoal">
                    Encontre o boteco mais próximo com fila aberta. Peça sua música antes mesmo de pedir a cerveja.
                  </p>
                  <div className="flex items-center gap-2 text-muted-steel text-sm font-body font-bold uppercase">
                    <MapPin size={14} />
                    <span>Pins amarelos = ao vivo agora</span>
                  </div>
                </div>
                <div className="lg:w-2/3 border border-brand-blue/20 shadow-[0_2px_12px_rgba(0,80,157,0.10)] overflow-hidden">
                  <LiveMap bars={mapBars} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section id="como-funciona" className="w-full bg-white border-b border-brand-blue/15 py-16 px-5 md:px-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Music size={40} strokeWidth={2.5} />}
            title="FILA INTELIGENTE"
            description="Algoritmo que prioriza o tema da noite e quem mais frequenta a casa. Democracia de bar levada a sério."
          />
          <FeatureCard
            icon={<Users size={40} strokeWidth={2.5} />}
            title="VOTAÇÃO EM TEMPO REAL"
            description="A galera vota nos próximos sucessos. O que o bar quer ouvir agora, toca primeiro!"
          />
          <FeatureCard
            icon={<Beer size={40} strokeWidth={2.5} />}
            title="BRUTALISMO POPULAR"
            description="Interface direta ao ponto. Tudo o que importa num lance de olhos, direto no celular da galera."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-12 px-8 flex flex-col md:flex-row justify-between items-center bg-zinc-900 border-t-2 border-brand-blue">
        <span className="font-display text-xl font-black text-white uppercase tracking-wider mb-4 md:mb-0">TOCAÍ</span>
        <div className="flex gap-6 mb-4 md:mb-0">
          <Link className="font-body font-bold text-xs uppercase tracking-widest text-zinc-400 hover:text-white transition-colors" to="/cadastro">Cadastrar Bar</Link>
        </div>
        <span className="font-body font-bold text-xs uppercase tracking-widest text-zinc-400 text-center">© 2026 TOCAÍ — MADE IN BRASIL 🇧🇷</span>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.1 } }}
      className="card-bento flex flex-col p-8 bg-white"
    >
      <div className="mb-5 text-brand-blue">{icon}</div>
      <h3 className="mb-3 text-2xl font-display font-black uppercase tracking-tight leading-none">{title}</h3>
      <p className="font-body text-base font-bold text-charcoal/70">{description}</p>
    </motion.div>
  );
}
