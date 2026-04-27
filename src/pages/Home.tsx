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
        whileHover={{ y: -4 }}
        className="card-bento bg-white p-5 h-full cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]" />
          <span className="font-display text-sm uppercase text-red-600 tracking-widest">AO VIVO</span>
        </div>

        <h3 className="font-display text-3xl uppercase leading-none tracking-tighter text-brand-blue mb-1 truncate">
          {bar.name}
        </h3>
        {bar.address && (
          <p className="font-body text-xs font-bold uppercase opacity-50 italic mb-3 flex items-center gap-1 truncate">
            <MapPin size={10} />
            {bar.address.split(",").slice(-2).join(",").trim()}
          </p>
        )}

        {nowPlaying ? (
          <div className="flex items-center gap-3 border-4 border-brand-blue p-3 bg-brand-cream/40">
            {nowPlaying.thumbnail_url ? (
              <img
                src={nowPlaying.thumbnail_url}
                alt={nowPlaying.title}
                className="h-10 w-10 object-cover border-2 border-brand-blue flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 flex items-center justify-center bg-brand-blue flex-shrink-0">
                <Disc size={20} className="text-brand-lime" />
              </div>
            )}
            <div className="min-w-0">
              <OverflowMarquee
                text={nowPlaying.title}
                className="font-display text-base leading-none uppercase"
              />
              <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{nowPlaying.artist}</p>
            </div>
          </div>
        ) : (
          <div className="border-4 border-dashed border-brand-blue/30 p-3 text-center">
            <p className="font-body text-xs font-bold uppercase opacity-40">Nenhuma música tocando</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="bg-brand-lime text-brand-blue border-2 border-brand-blue px-2 py-0.5 font-display text-sm uppercase">
            {queueCount} na fila
          </span>
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
      className="flex-shrink-0 w-52 card-bento bg-white p-4"
    >
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.title}
          className="w-full aspect-square object-cover border-4 border-brand-blue mb-3"
        />
      ) : (
        <div className="w-full aspect-square bg-brand-blue flex items-center justify-center mb-3">
          <Music size={32} className="text-brand-lime" />
        </div>
      )}
      <p className="font-display text-base leading-none uppercase truncate">{item.title}</p>
      <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{item.artist}</p>
      {item.bar_name && (
        <p className="font-body text-[10px] font-bold uppercase mt-1 opacity-40 truncate flex items-center gap-1">
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
      {/* Hero */}
      <section className="relative flex w-full flex-col items-center justify-center border-b-8 border-brand-blue bg-white px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-4xl"
        >
          <div className="bg-brand-blue px-6 py-2 inline-block mb-4 shadow-[6px_6px_0px_var(--color-brand-lime)]">
            <span className="text-brand-lime font-display text-2xl tracking-widest uppercase">TOCA AÍ, MERMÃO!</span>
          </div>
          <h1 className="mb-6 text-8xl md:text-[10rem] font-display text-brand-blue leading-none tracking-tighter">
            TOCA<span className="text-brand-lime text-stroke-blue">Í</span>
          </h1>
          <p className="mb-10 font-body text-2xl md:text-4xl font-black leading-none uppercase text-brand-blue/80 italic tracking-tight">
            A trilha sonora do seu bar, <br />
            comandada pela <span className="bg-brand-lime px-3 shadow-[4px_4px_0px_var(--color-brand-blue)]">galera do balcão.</span>
          </p>
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
            <Link to="/cadastro" className="btn-bento flex items-center gap-3 text-3xl">
              ABRIR MEU BAR <ArrowRight size={32} strokeWidth={3} />
            </Link>
          </div>
          <div className="mt-12 flex justify-center gap-8 opacity-40">
            <div className="w-12 h-12 border-4 border-brand-blue rounded-full flex items-center justify-center text-2xl">🎵</div>
            <div className="w-12 h-12 border-4 border-brand-blue rounded-full flex items-center justify-center text-2xl">🍻</div>
            <div className="w-12 h-12 border-4 border-brand-blue rounded-full flex items-center justify-center text-2xl">🔥</div>
          </div>
        </motion.div>
      </section>

      {/* Contadores animados */}
      {statsLoaded && (
        <section className="w-full border-b-8 border-brand-blue bg-brand-blue py-12 px-6">
          <div className="mx-auto grid max-w-4xl grid-cols-3 gap-6">
            <StatCard label="bares na rede" value={stats.bars} icon={<Beer size={36} strokeWidth={2.5} />} />
            <StatCard label="pedidos hoje" value={stats.todayRequests} icon={<Music size={36} strokeWidth={2.5} />} />
            <StatCard label="ao vivo agora" value={stats.liveNow} icon={<Radio size={36} strokeWidth={2.5} />} />
          </div>
        </section>
      )}

      {/* Ao Vivo Agora */}
      {liveBars.length > 0 && (
        <section className="w-full border-b-8 border-brand-blue bg-brand-cream py-12 px-6">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex items-center gap-4">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_red]" />
              <h2 className="font-display text-5xl md:text-6xl text-brand-blue uppercase leading-none tracking-tighter">
                AO VIVO AGORA
              </h2>
              <span className="bg-brand-blue text-brand-lime font-display text-lg px-3 py-1 uppercase">
                {liveBars.length} {liveBars.length === 1 ? "bar" : "bares"}
              </span>
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
        </section>
      )}

      {/* O que está tocando — carousel */}
      {carousel.length > 0 && (
        <section className="w-full border-b-8 border-brand-blue bg-white py-10 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 mb-5">
            <h2 className="font-display text-4xl md:text-5xl text-brand-blue uppercase leading-none tracking-tighter">
              O QUE ESTÁ TOCANDO
            </h2>
            <p className="font-body text-sm font-bold uppercase opacity-50 italic mt-1">
              Pedidos em tempo real em toda a rede TocaÍ
            </p>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-5 overflow-x-auto px-6 pb-4"
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
        <section className="w-full border-b-8 border-brand-blue">
          <div className="border-b-4 border-brand-blue bg-white px-6 py-6 flex items-center gap-4">
            <MapPin size={28} className="text-brand-blue" />
            <div>
              <h2 className="font-display text-4xl md:text-5xl text-brand-blue uppercase leading-none tracking-tighter">
                BARES NO MAPA
              </h2>
              <p className="font-body text-xs font-bold uppercase opacity-50 italic">
                Pins amarelos = ao vivo agora · Clique para ver o bar
              </p>
            </div>
          </div>
          <div className="w-full">
            <LiveMap bars={mapBars} />
          </div>
        </section>
      )}

      {/* Features */}
      <section id="como-funciona" className="grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-28 md:grid-cols-3">
        <FeatureCard
          icon={<Music size={50} strokeWidth={3} />}
          title="FILA INTELIGENTE"
          description="Algoritmo que prioriza o tema da noite e quem mais frequenta a casa. Democracia de bar levada a sério."
        />
        <FeatureCard
          icon={<Users size={50} strokeWidth={3} />}
          title="VOTAÇÃO EM TEMPO REAL"
          description="A galera vota nos próximos sucessos. O que o bar quer ouvir agora, toca primeiro!"
        />
        <FeatureCard
          icon={<Beer size={50} strokeWidth={3} />}
          title="ESTILO BENTO GRID"
          description="Interface brutalista e informativa. Tudo o que importa num lance de olhos, direto no seu celular."
        />
      </section>

      {/* Footer */}
      <footer className="w-full border-t-4 border-brand-blue bg-white py-12 text-center">
        <p className="font-display text-2xl">TOCAÍ © 2026 — MADE IN BRASIL 🇧🇷</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="card-bento flex flex-col p-8 bg-white"
    >
      <div className="mb-6 text-brand-blue drop-shadow-[3px_3px_0px_var(--color-brand-lime)]">{icon}</div>
      <h3 className="mb-4 text-4xl font-display uppercase italic tracking-tighter leading-none">{title}</h3>
      <p className="font-body text-xl leading-tight font-bold opacity-70">{description}</p>
    </motion.div>
  );
}
