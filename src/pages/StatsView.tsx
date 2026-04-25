import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { BarChart2, Music, Users, ThumbsUp, Disc, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Stats {
  totalInQueue: number;
  totalVotes: number;
  topSongs: { title: string; artist: string; score: number; thumbnail_url?: string }[];
  topRequesters: { name: string; count: number }[];
  topGenres: { tag: string; count: number }[];
}

export default function StatsView() {
  const { slug } = useParams<{ slug: string }>();
  const isAdmin = sessionStorage.getItem(`caipa_admin_auth_${slug}`) === "true";

  const [stats, setStats] = useState<Stats>({
    totalInQueue: 0,
    totalVotes: 0,
    topSongs: [],
    topRequesters: [],
    topGenres: [],
  });
  const [loading, setLoading] = useState(true);
  const [barName, setBarName] = useState("");

  useEffect(() => {
    if (!slug) return;

    supabase.from("bars").select("name").eq("slug", slug).maybeSingle()
      .then(({ data }) => { if (data?.name) setBarName(data.name); });

    supabase.from("queue_items")
      .select("*")
      .eq("bar_slug", slug)
      .neq("status", "played")
      .then(({ data }) => {
        const items = data ?? [];

        const totalInQueue = items.length;
        const totalVotes = items.reduce((sum, i) => sum + (i.score ?? 0), 0);

        const topSongs = [...items]
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, 10)
          .map(i => ({ title: i.title, artist: i.artist, score: i.score ?? 0, thumbnail_url: i.thumbnail_url }));

        const requesterMap: Record<string, number> = {};
        items.forEach(i => {
          if (i.client_name) requesterMap[i.client_name] = (requesterMap[i.client_name] ?? 0) + 1;
        });
        const topRequesters = Object.entries(requesterMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        const tagMap: Record<string, number> = {};
        items.forEach(i => {
          (i.tags ?? []).forEach((tag: string) => {
            tagMap[tag] = (tagMap[tag] ?? 0) + 1;
          });
        });
        const topGenres = Object.entries(tagMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([tag, count]) => ({ tag, count }));

        setStats({ totalInQueue, totalVotes, topSongs, topRequesters, topGenres });
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="h-16 w-16 animate-spin rounded-full border-8 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  const maxSongScore = stats.topSongs[0]?.score ?? 1;
  const maxRequesterCount = stats.topRequesters[0]?.count ?? 1;
  const maxGenreCount = stats.topGenres[0]?.count ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-brand-cream p-4 lg:p-8"
    >
      {/* Header */}
      <header className="mb-8 border-b-8 border-brand-blue pb-6">
        <div className="flex items-start justify-between">
          <div>
            <Link
              to={`/${slug}`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase text-brand-blue/60 hover:text-brand-blue mb-3"
            >
              <ArrowLeft size={14} /> VOLTAR
            </Link>
            <h1 className="text-7xl lg:text-8xl font-display uppercase tracking-tighter leading-none text-brand-blue">
              ESTAT<span className="text-brand-lime text-stroke-blue">Í</span>STICAS
            </h1>
            <p className="text-xl font-body font-bold italic uppercase opacity-70">
              {barName || slug} · tocai.com/{slug}
            </p>
          </div>
          <BarChart2 size={64} className="text-brand-blue/20 hidden lg:block" />
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={<Music size={32} />}
          label="Na Fila"
          value={stats.totalInQueue}
          delay={0}
        />
        <StatCard
          icon={<ThumbsUp size={32} />}
          label="Total de Votos"
          value={stats.totalVotes}
          delay={0.1}
        />
        <StatCard
          icon={<Disc size={32} />}
          label="Gêneros"
          value={stats.topGenres.length}
          delay={0.2}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Songs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="card-bento p-6 lg:p-8"
        >
          <h2 className="text-4xl font-display uppercase tracking-tighter border-b-4 border-brand-blue pb-2 mb-6 leading-none">
            TOP MÚSICAS
          </h2>
          {stats.topSongs.length === 0 ? (
            <p className="font-body text-lg font-bold uppercase opacity-40 text-center py-8">Sem dados ainda</p>
          ) : (
            <div className="space-y-4">
              {stats.topSongs.map((song, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="font-display text-4xl text-brand-blue/30 leading-none w-10 text-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  {song.thumbnail_url && (
                    <img src={song.thumbnail_url} alt={song.title} className="h-10 w-10 object-cover border-2 border-brand-blue flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-xl leading-none uppercase truncate">{song.title}</p>
                    <p className="font-body text-xs font-bold uppercase opacity-60 italic truncate">{song.artist}</p>
                    <div className="mt-1 h-1.5 bg-brand-blue/10">
                      <div
                        className="h-full bg-brand-lime"
                        style={{ width: `${(song.score / maxSongScore) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-display text-2xl text-brand-blue leading-none flex-shrink-0">
                    +{song.score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <div className="space-y-6">
          {/* Top Genres */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="card-bento p-6 lg:p-8"
          >
            <h2 className="text-4xl font-display uppercase tracking-tighter border-b-4 border-brand-blue pb-2 mb-6 leading-none">
              GÊNEROS
            </h2>
            {stats.topGenres.length === 0 ? (
              <p className="font-body text-lg font-bold uppercase opacity-40 text-center py-4">Sem dados ainda</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.topGenres.map(({ tag, count }, idx) => (
                  <div
                    key={tag}
                    className="border-4 border-brand-blue px-3 py-1.5 flex items-center gap-2"
                    style={{ opacity: 1 - (idx / stats.topGenres.length) * 0.5 }}
                  >
                    <span className="font-display text-xl uppercase leading-none">{tag}</span>
                    <span className="font-body text-xs font-bold text-brand-blue/60">{count}</span>
                    <div
                      className="h-1.5 bg-brand-lime"
                      style={{ width: `${Math.max(12, (count / maxGenreCount) * 40)}px` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Top Requesters — admin only */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="card-bento p-6 lg:p-8"
            >
              <h2 className="text-4xl font-display uppercase tracking-tighter border-b-4 border-brand-blue pb-2 mb-6 leading-none flex items-center gap-3">
                <Users size={28} className="text-brand-blue/60" /> TOP PEDINTES
              </h2>
              {stats.topRequesters.length === 0 ? (
                <p className="font-body text-lg font-bold uppercase opacity-40 text-center py-4">Sem dados ainda</p>
              ) : (
                <div className="space-y-3">
                  {stats.topRequesters.map(({ name, count }, idx) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="font-display text-3xl text-brand-blue/30 leading-none w-8 text-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-2xl leading-none uppercase truncate">@{name}</p>
                        <div className="mt-1 h-1.5 bg-brand-blue/10">
                          <div
                            className="h-full bg-brand-lime"
                            style={{ width: `${(count / maxRequesterCount) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-display text-2xl text-brand-blue leading-none flex-shrink-0">
                        {count} pedido{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <footer className="mt-12 border-t-8 border-brand-blue pt-6 text-center">
        <p className="font-body text-sm font-bold uppercase opacity-40">
          Tocaí · {slug} · Dados em tempo real
        </p>
      </footer>
    </motion.div>
  );
}

function StatCard({
  icon, label, value, delay = 0, className = "",
}: {
  icon: React.ReactNode; label: string; value: number; delay?: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`card-bento-lime p-6 flex flex-col justify-between ${className}`}
    >
      <div className="text-brand-blue/60 mb-3">{icon}</div>
      <div>
        <p className="font-display text-6xl lg:text-7xl leading-none text-brand-blue">{value}</p>
        <p className="font-body text-sm font-bold uppercase text-brand-blue/60 mt-1">{label}</p>
      </div>
    </motion.div>
  );
}
