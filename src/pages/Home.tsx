import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Music, Users, Radio, MapPin, Play, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ── Hook para contador animado ───────────────────────────────────────────────
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

// ── Componente de estatística ────────────────────────────────────────────────
function StatisticaContador({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const { value: displayed, ref } = useCountUp(value);

  return (
    <div ref={ref} className="text-center">
      <div className="mb-2 text-primary/80">{icon}</div>
      <div
        key={displayed}
        className="font-body text-stats font-bold text-primary tabular-nums animate-count-up"
      >
        {displayed.toLocaleString("pt-BR")}
      </div>
      <div className="stat-label mt-1">{label}</div>
    </div>
  );
}

// ── Card de bar ao vivo ──────────────────────────────────────────────────────
function CardBarAoVivo({ bar, tocandoAgora, contagemFila }: {
  bar: any;
  tocandoAgora: any;
  contagemFila: number;
}) {
  return (
    <Link to={`/${bar.slug}`} className="block flex-shrink-0 w-80">
      <motion.div
        whileHover={{ y: -4, scale: 1.02 }}
        className="bg-surface-dark rounded-asymmetric p-6 h-full border border-primary/20 hover:border-primary/50 transition-all duration-300"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-body text-xs uppercase text-red-500 font-bold tracking-wider">AO VIVO</span>
        </div>

        <h3 className="font-display text-2xl text-white mb-2 truncate">
          {bar.name}
        </h3>

        {bar.address && (
          <p className="font-label text-xs text-text-muted mb-4 flex items-center gap-1 truncate">
            <MapPin size={10} />
            {bar.address.split(",").slice(-2).join(",").trim()}
          </p>
        )}

        {tocandoAgora ? (
          <div className="track-card mb-4">
            {tocandoAgora.thumbnail_url ? (
              <img
                src={tocandoAgora.thumbnail_url}
                alt={tocandoAgora.title}
                className="w-12 h-12 object-cover rounded"
              />
            ) : (
              <div className="w-12 h-12 bg-primary/20 rounded flex items-center justify-center">
                <Music size={20} className="text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-body font-medium text-white text-sm truncate">{tocandoAgora.title}</p>
              <p className="font-label text-xs text-text-muted truncate">{tocandoAgora.artist}</p>
            </div>
          </div>
        ) : (
          <div className="h-16 border border-dashed border-text-muted/30 rounded flex items-center justify-center mb-4">
            <p className="font-label text-xs text-text-muted">Nenhuma música tocando</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="bg-primary text-secondary px-3 py-1 rounded text-sm font-body font-bold">
            {contagemFila} na fila
          </span>
          <ExternalLink size={16} className="text-text-muted" />
        </div>
      </motion.div>
    </Link>
  );
}

// ── Mapa interativo ──────────────────────────────────────────────────────────
function MapaInterativo({ bares }: { bares: Array<{
  slug: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  isLive: boolean;
  tocandoAgora?: any;
}> }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const initMap = useCallback(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current || instanceRef.current) return;

    // Criar mapa com estilo escuro
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      preferCanvas: true
    }).setView([-15.78, -47.93], 4);

    // Usar tile layer escuro
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    instanceRef.current = map;
  }, []);

  useEffect(() => {
    // Carregue o script do Leaflet se não estiver carregado
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.js";
      script.onload = initMap;
      document.head.appendChild(script);

      const link = document.createElement('link');
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css";
      document.head.appendChild(link);
    } else {
      initMap();
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !instanceRef.current) return;

    // Limpar marcadores existentes
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    bares.forEach(bar => {
      const isLive = bar.isLive;
      const pulseAnimation = isLive ? "animation: 2s ease-in-out infinite pulse-amber;" : "";

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width: 16px;
          height: 16px;
          background: ${isLive ? '#FFB800' : '#807A6D'};
          border: 2px solid #0A0A0A;
          border-radius: 50%;
          ${pulseAnimation}
          cursor: pointer;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const popupContent = `
        <div style="
          font-family: 'Space Grotesk', sans-serif;
          min-width: 200px;
          background: #1A1A1A;
          color: white;
          padding: 12px;
          border-radius: 8px;
        ">
          ${isLive ? '<span style="color: #FFB800; font-weight: bold; font-size: 11px;">● AO VIVO</span><br>' : ""}
          <strong style="font-size: 16px; font-family: Calistoga;">${bar.name}</strong>
          ${bar.address ? `<br><small style="color: #807A6D;">${bar.address}</small>` : ""}
          ${bar.tocandoAgora ? `<br><div style="margin-top: 8px; font-size: 12px;"><strong>Tocando:</strong><br>${bar.tocandoAgora.title} - ${bar.tocandoAgora.artist}</div>` : ""}
          <br><a href="/${bar.slug}" style="
            display: inline-block;
            margin-top: 8px;
            background: #FFB800;
            color: #0A0A0A;
            padding: 6px 12px;
            font-weight: bold;
            font-size: 12px;
            text-decoration: none;
            border-radius: 4px;
          ">VER BAR →</a>
        </div>
      `;

      const marker = L.marker([bar.lat, bar.lng], { icon })
        .addTo(instanceRef.current)
        .bindPopup(popupContent, {
          maxWidth: 250,
          className: 'mapa-popup-escuro'
        });

      markersRef.current.push(marker);
    });
  }, [bares]);

  return (
    <div
      ref={mapRef}
      className="w-full live-map"
      style={{ minHeight: '420px' }}
    />
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Home() {
  const [estatisticas, setEstatisticas] = useState({
    bares: 0,
    pedidosHoje: 0,
    aoVivoAgora: 0
  });
  const [baresAoVivo, setBaresAoVivo] = useState<any[]>([]);
  const [baresMapa, setBaresMapa] = useState<any[]>([]);
  const [estatisticasCarregadas, setEstatisticasCarregadas] = useState(false);

  // Carregar estatísticas
  useEffect(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    Promise.all([
      supabase.from("bars").select("id", { count: "exact", head: true }).eq("is_approved", true),
      supabase.from("queue_items").select("id", { count: "exact", head: true }).gte("requested_at", hoje.toISOString()),
      supabase.from("queue_items").select("bar_slug").eq("status", "pending"),
    ]).then(([barsRes, reqsRes, liveRes]) => {
      const slugsBaresAoVivo = new Set((liveRes.data ?? []).map((r: any) => r.bar_slug));
      setEstatisticas({
        bares: barsRes.count ?? 0,
        pedidosHoje: reqsRes.count ?? 0,
        aoVivoAgora: slugsBaresAoVivo.size,
      });
      setEstatisticasCarregadas(true);
    });
  }, []);

  // Carregar bares ao vivo
  useEffect(() => {
    supabase
      .from("queue_items")
      .select("bar_slug, title, artist, thumbnail_url")
      .eq("status", "pending")
      .order("score", { ascending: false })
      .limit(200)
      .then(async ({ data: itensFilá }) => {
        if (!itensFilá) return;

        const agrupados: Record<string, any[]> = {};
        for (const item of itensFilá) {
          if (!agrupados[item.bar_slug]) agrupados[item.bar_slug] = [];
          agrupados[item.bar_slug].push(item);
        }

        const slugs = Object.keys(agrupados);
        if (slugs.length === 0) return;

        const { data: bares } = await supabase
          .from("bars")
          .select("slug, name, address, lat, lng")
          .in("slug", slugs)
          .eq("is_approved", true);

        if (!bares) return;

        const dadosAoVivo = bares.map(bar => ({
          bar,
          tocandoAgora: agrupados[bar.slug]?.[0] ?? null,
          contagemFila: agrupados[bar.slug]?.length ?? 0,
        }));

        setBaresAoVivo(dadosAoVivo);
      });
  }, []);

  // Carregar todos os bares para o mapa
  useEffect(() => {
    supabase
      .from("bars")
      .select("slug, name, address, lat, lng")
      .eq("is_approved", true)
      .not("lat", "is", null)
      .then(async ({ data }) => {
        if (!data) return;

        const slugsAoVivo = new Set(baresAoVivo.map(l => l.bar.slug));

        // Buscar informação de música tocando para cada bar ao vivo
        const baresComMusica = await Promise.all(
          data.map(async (bar) => {
            let tocandoAgora = null;
            if (slugsAoVivo.has(bar.slug)) {
              const { data: musicaAtual } = await supabase
                .from("queue_items")
                .select("title, artist, thumbnail_url")
                .eq("bar_slug", bar.slug)
                .eq("status", "pending")
                .order("score", { ascending: false })
                .limit(1)
                .maybeSingle();
              tocandoAgora = musicaAtual;
            }

            return {
              ...bar,
              isLive: slugsAoVivo.has(bar.slug),
              tocandoAgora
            };
          })
        );

        setBaresMapa(baresComMusica);
      });
  }, [baresAoVivo]);

  return (
    <div className="min-h-screen bg-secondary text-white">
      {/* Hero Section - 100vh */}
      <section className="hero-section">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center px-6"
        >
          <h1 className="hero-title mb-8">
            Qual a Vibe.
          </h1>
          <p className="font-body text-xl md:text-2xl text-text-muted mb-12 max-w-2xl mx-auto">
            A trilha sonora do seu bar comandada pela galera.
            Conecte seu estabelecimento e deixe os clientes escolherem o som.
          </p>
          <Link to="/cadastro" className="btn-primary text-xl">
            Criar Seu Bar
          </Link>
        </motion.div>
      </section>

      {/* Stats Band - Full Width */}
      {estatisticasCarregadas && (
        <section className="stats-band">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-3 gap-8 md:gap-16">
              <StatisticaContador
                label="bares conectados"
                value={estatisticas.bares}
                icon={<Radio size={32} />}
              />
              <StatisticaContador
                label="músicas pedidas hoje"
                value={estatisticas.pedidosHoje}
                icon={<Music size={32} />}
              />
              <StatisticaContador
                label="ao vivo agora"
                value={estatisticas.aoVivoAgora}
                icon={<Play size={32} />}
              />
            </div>
          </div>
        </section>
      )}

      {/* Featured Bars - Se houver bares ao vivo */}
      {baresAoVivo.length > 0 && (
        <section className="py-16 px-6 bg-surface-dark">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-display text-4xl md:text-5xl text-white">
                Ao Vivo Agora
              </h2>
              <span className="bg-primary text-secondary font-body font-bold text-sm px-3 py-1 rounded">
                {baresAoVivo.length} {baresAoVivo.length === 1 ? "bar" : "bares"}
              </span>
            </div>

            <div className="hidden lg:block">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {baresAoVivo.slice(0, 6).map(({ bar, tocandoAgora, contagemFila }) => (
                  <CardBarAoVivo
                    key={bar.slug}
                    bar={bar}
                    tocandoAgora={tocandoAgora}
                    contagemFila={contagemFila}
                  />
                ))}
              </div>
            </div>

            <div className="lg:hidden overflow-x-auto">
              <div className="flex gap-6 pb-4">
                {baresAoVivo.map(({ bar, tocandoAgora, contagemFila }) => (
                  <CardBarAoVivo
                    key={bar.slug}
                    bar={bar}
                    tocandoAgora={tocandoAgora}
                    contagemFila={contagemFila}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Map - Bottom */}
      {baresMapa.length > 0 && (
        <section>
          <div className="bg-surface-dark border-t border-primary/20 px-6 py-6 flex items-center gap-4">
            <MapPin size={28} className="text-primary" />
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-white">
                Bares no Mapa
              </h2>
              <p className="font-label text-sm text-text-muted">
                Marcadores âmbar = ao vivo agora • Clique para ver detalhes
              </p>
            </div>
          </div>
          <MapaInterativo bares={baresMapa} />
        </section>
      )}

      {/* Footer simples */}
      <footer className="bg-secondary py-8 px-6 text-center border-t border-surface-dark">
        <p className="font-display text-lg text-text-muted">
          CAIPA © 2026 — Feito no Brasil 🇧🇷
        </p>
      </footer>
    </div>
  );
}