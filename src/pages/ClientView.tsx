import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Music, ThumbsUp, Check, X, Sparkles, ExternalLink, Clock, Smartphone,
} from "lucide-react";
import { searchMusic, getSimilarTracks } from "../services/musicService";
import { useQueue } from "../hooks/useQueue";
import { useSession } from "../hooks/useSession";
import { setSharedToken } from "../services/spotifyAuth";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

type ThemeAccent = { title: string; badge: string };

const THEME_ACCENTS: Record<string, ThemeAccent> = {
  samba:  { title: "text-brand-lime",  badge: "bg-brand-lime"  },
  mpb:    { title: "text-violet-500",  badge: "bg-violet-400"  },
  "forró":{ title: "text-orange-500",  badge: "bg-orange-400"  },
  forro:  { title: "text-orange-500",  badge: "bg-orange-400"  },
  pagode: { title: "text-green-500",   badge: "bg-green-400"   },
  axé:    { title: "text-yellow-500",  badge: "bg-yellow-400"  },
  axe:    { title: "text-yellow-500",  badge: "bg-yellow-400"  },
  rock:   { title: "text-red-500",     badge: "bg-red-400"     },
  funk:   { title: "text-pink-500",    badge: "bg-pink-400"    },
};

const DEFAULT_ACCENT: ThemeAccent = { title: "text-brand-blue", badge: "bg-brand-lime" };

function getThemeAccent(theme: string): ThemeAccent {
  return THEME_ACCENTS[theme.toLowerCase()] ?? DEFAULT_ACCENT;
}

const MAX_REQUESTS = 5;

function getRequestCount(slug: string, phone: string): number {
  const today = new Date().toISOString().split("T")[0];
  return parseInt(localStorage.getItem(`caipa_reqs_${slug}_${phone}_${today}`) || "0");
}

function incrementRequestCount(slug: string, phone: string) {
  const today = new Date().toISOString().split("T")[0];
  const key = `caipa_reqs_${slug}_${phone}_${today}`;
  localStorage.setItem(key, String(parseInt(localStorage.getItem(key) || "0") + 1));
}

function getUserBadge(count: number): string {
  if (count === 0) return "Visitante";
  if (count <= 2) return "Frequentador";
  return "Habitué";
}

export default function ClientView() {
  const { slug } = useParams<{ slug: string }>();
  const [barStatus, setBarStatus] = useState<"loading" | "approved" | "pending" | "not_found">("loading");
  const [phone, setPhone] = useState<string | null>(localStorage.getItem("caipa_phone"));
  const [clientName, setClientName] = useState<string | null>(localStorage.getItem("caipa_name"));
  const [showIdentify, setShowIdentify] = useState(!localStorage.getItem("caipa_phone"));

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [suggested, setSuggested] = useState<any[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [votedItems, setVotedItems] = useState<Set<string>>(new Set());

  const [requestCount, setRequestCount] = useState(0);

  const { session } = useSession(barStatus === "approved" ? slug : undefined);
  const { queue, addMusic, vote } = useQueue(barStatus === "approved" ? slug : undefined);

  // Check bar approval
  useEffect(() => {
    if (!slug) { setBarStatus("not_found"); return; }
    supabase
      .from("bars")
      .select("is_approved")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setBarStatus("not_found");
        else if (data.is_approved) setBarStatus("approved");
        else setBarStatus("pending");
      });
  }, [slug]);

  const nowPlaying = queue[0] ?? null;
  const upNext = queue.slice(1);

  // Share admin's Spotify token so clients can search
  useEffect(() => {
    setSharedToken(session.spotify_token ?? null);
  }, [session.spotify_token]);

  useEffect(() => {
    if (phone && slug) setRequestCount(getRequestCount(slug, phone));
  }, [phone, slug]);


  // Loading / not found / pending screens
  if (barStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        <div className="h-16 w-16 animate-spin rounded-full border-8 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (barStatus === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream text-center p-8">
        <h1 className="font-display text-8xl text-brand-blue mb-4">404</h1>
        <p className="font-display text-4xl uppercase text-brand-blue/60">Bar não encontrado</p>
      </div>
    );
  }

  if (barStatus === "pending") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream text-center p-8 gap-8">
        <div className="card-bento bg-white p-12 max-w-md">
          <Clock size={80} className="mx-auto text-yellow-500 mb-6" />
          <h1 className="font-display text-5xl text-brand-blue leading-none mb-4">EM ANÁLISE</h1>
          <p className="font-body text-xl font-black uppercase italic opacity-60">
            Este bar ainda não foi aprovado pela equipe Tocaí. Volte em breve!
          </p>
        </div>
      </div>
    );
  }

  const themeAccent = getThemeAccent(session.theme);
  const remaining = MAX_REQUESTS - requestCount;
  const waitMinutes = Math.round(upNext.length * 3.5);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await searchMusic(searchQuery);
    setSearchResults(results);
    setIsSearching(false);
    setShowSearch(true);
  };

  const handleRequest = async (music: any) => {
    if (remaining <= 0) {
      alert(`Você já fez ${MAX_REQUESTS} pedidos hoje. Tente amanhã!`);
      return;
    }
    try {
      await addMusic(music, phone || "anon", clientName || "Cliente", session);
      setShowSearch(false);
      setSearchQuery("");
      setShowSuccess(true);
      if (phone && slug) {
        incrementRequestCount(slug, phone);
        setRequestCount(c => c + 1);
      }
      const similar = await getSimilarTracks(music.artist, music.title);
      setSuggested(similar);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleVote = (id: string) => {
    vote(id, phone || "anon");
    setVotedItems(prev => new Set([...prev, id]));
    setTimeout(() => {
      setVotedItems(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream p-4 lg:p-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-8 border-brand-blue pb-6">
        <div>
          <h1 className="text-7xl lg:text-8xl font-display uppercase tracking-tighter leading-none text-brand-blue">
            TOCA<span className="text-brand-lime text-stroke-blue">Í</span>
          </h1>
          <p className="text-xl font-body font-bold italic uppercase opacity-70">
            tocai.com/{slug}
          </p>
        </div>
        <div className="text-left md:text-right mt-4 md:mt-0">
          <div className={cn("px-4 py-1 border-4 border-brand-blue inline-block mb-2 shadow-[4px_4px_0px_var(--color-brand-blue)]", themeAccent.badge)}>
            <span className="text-sm font-bold uppercase tracking-widest text-brand-blue">Tema da Noite</span>
          </div>
          <h2 className={cn("text-4xl lg:text-5xl font-display uppercase tracking-tight leading-none", themeAccent.title)}>
            {session.theme}
          </h2>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-grow relative">

        {/* Search Results Overlay */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-50 bg-brand-cream/95 backdrop-blur-md p-4 lg:p-8 overflow-y-auto"
            >
              <div className="card-bento p-6 lg:p-10 min-h-full">
                <div className="mb-8 flex items-center justify-between border-b-4 border-brand-blue pb-4">
                  <h4 className="font-display text-4xl lg:text-5xl uppercase tracking-tighter">O QUE VAMOS OUVIR?</h4>
                  <button onClick={() => setShowSearch(false)} className="text-brand-blue hover:rotate-90 transition-transform p-1">
                    <X size={40} strokeWidth={3} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((item) => (
                    <div key={item.id} className="card-bento p-4 flex flex-col gap-4 group">
                      <img
                        src={item.thumb}
                        alt={item.title}
                        className="w-full aspect-video border-2 border-brand-blue object-cover shadow-[4px_4px_0px_var(--color-brand-blue)] group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all"
                      />
                      <div className="flex-1 overflow-hidden">
                        <h5 className="truncate font-display text-2xl uppercase leading-none">{item.title}</h5>
                        <p className="font-body text-sm font-bold uppercase opacity-60 italic">{item.artist}</p>
                        {item.preview_url && (
                          <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 mt-1 inline-block">
                            ♪ Preview disponível
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleRequest(item)} className="btn-bento w-full text-base py-2">
                        PEDIR
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Modal */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-blue/90 p-6 backdrop-blur-md"
            >
              <div className="card-bento max-w-sm bg-white p-10 text-center shadow-[12px_12px_0px_var(--color-brand-lime)]">
                <div className="mb-6 flex justify-center text-brand-lime">
                  <Sparkles size={80} strokeWidth={3} className="drop-shadow-[4px_4px_0px_var(--color-brand-blue)]" />
                </div>
                <h3 className="text-5xl font-display leading-none mb-2">PEDIDO ENVIADO!</h3>
                <p className="mb-8 font-body text-2xl font-black uppercase leading-tight italic opacity-60">
                  Sua música já está na fila.
                </p>

                {suggested.length > 0 && (
                  <div className="mb-8 text-left">
                    <p className="mb-4 font-display text-xl tracking-widest text-brand-blue/60 underline decoration-brand-lime decoration-4 underline-offset-4 uppercase">
                      PODE TE INTERESSAR:
                    </p>
                    <div className="space-y-3">
                      {suggested.map((s, i) => (
                        <div key={i} className="border-b-2 border-brand-blue/10 pb-2">
                          <p className="font-display text-lg leading-none uppercase">{s.title}</p>
                          <p className="font-body text-xs font-bold uppercase opacity-50 italic">{s.artist}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={() => setShowSuccess(false)} className="btn-bento w-full text-3xl">FECHAR</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* NOW PLAYING card */}
        <motion.div
          layout
          className="md:col-span-7 md:row-span-4 card-bento bg-brand-blue text-brand-cream p-6 lg:p-10 flex flex-col relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 bg-brand-lime text-brand-blue font-display px-6 py-2 text-2xl lg:text-3xl tracking-tighter shadow-[-4px_4px_0px_var(--color-brand-blue)] z-10">
            NO AR AGORA
          </div>

          {nowPlaying ? (
            <div className="flex flex-col lg:flex-row gap-8 items-center h-full">
              {/* Album Art */}
              <div className="relative w-48 h-48 lg:w-64 lg:h-64 flex-shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-4 rounded-full border-4 border-dashed border-brand-lime opacity-20"
                />
                <div className="w-full h-full border-4 border-brand-cream relative overflow-hidden shadow-[8px_8px_0px_var(--color-brand-lime)]">
                  {nowPlaying.thumbnail_url ? (
                    <img
                      src={nowPlaying.thumbnail_url}
                      alt={nowPlaying.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <Music size={80} className="text-brand-lime opacity-40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/40 to-transparent" />
                </div>
              </div>

              <div className="flex flex-col justify-center text-center lg:text-left flex-1 min-w-0">
                <h3 className="text-4xl lg:text-6xl font-display leading-none mb-2 uppercase italic tracking-tighter truncate">
                  {nowPlaying.title}
                </h3>
                <p className="text-xl lg:text-2xl font-body font-bold text-brand-lime mb-3 uppercase tracking-widest leading-none">
                  {nowPlaying.artist}
                </p>

                {/* Device playing */}
                {session.spotify_device_name ? (
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <Smartphone size={13} className="text-brand-lime/70 flex-shrink-0" />
                    <span className="text-[10px] font-body font-bold uppercase opacity-60 tracking-widest">
                      tocando em: {session.spotify_device_name}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-3 justify-center lg:justify-start">
                    <span className="text-[10px] font-body font-bold uppercase text-yellow-400/80 tracking-widest">
                      ⚠ admin sem dispositivo conectado
                    </span>
                  </div>
                )}

                {nowPlaying.external_urls?.spotify && (
                  <a
                    href={nowPlaying.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-brand-lime/70 font-body text-xs font-bold uppercase underline mb-4 justify-center lg:justify-start"
                  >
                    <ExternalLink size={12} /> Ouvir no Spotify
                  </a>
                )}

                <div className="flex items-center justify-center lg:justify-start gap-3 mt-2">
                  <div className="w-10 h-10 rounded-full bg-brand-lime border-4 border-brand-cream flex items-center justify-center text-lg shadow-[4px_4px_0px_var(--color-brand-blue)]">
                    🎶
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest">Requisitado por</p>
                    <p className="text-lg lg:text-xl font-display uppercase tracking-tight leading-none">
                      @{nowPlaying.client_name}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6 opacity-40">
              <Music size={80} className="text-brand-lime" />
              <p className="font-display text-4xl uppercase">FILA VAZIA</p>
              <p className="font-body text-xl font-bold uppercase italic">Faça o primeiro pedido!</p>
            </div>
          )}

          {/* Progress indicator — pulses while something is in the queue */}
          <div className="absolute bottom-0 left-0 w-full h-3 bg-brand-cream/10">
            {nowPlaying && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="h-full bg-brand-lime w-full"
              />
            )}
          </div>
        </motion.div>

        {/* Queue Card */}
        <div className="md:col-span-5 md:row-span-6 card-bento p-6 lg:p-8 flex flex-col bg-white">
          <h4 className="text-3xl lg:text-4xl font-display uppercase mb-6 border-b-4 border-brand-blue pb-3 flex justify-between items-baseline italic">
            <span>Fila de Espera</span>
            <span className="text-base font-body font-bold opacity-60 tracking-tighter normal-case italic">
              {upNext.length} hits
            </span>
          </h4>

          <div className="flex-grow space-y-4 overflow-y-auto pr-2">
            {upNext.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 opacity-30 text-center gap-3">
                <Music size={48} />
                <p className="font-display text-2xl uppercase">Nenhuma música na fila</p>
              </div>
            )}
            {upNext.map((item, idx) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-center gap-4 p-4 border-4 border-brand-blue shadow-[4px_4px_0px_var(--color-brand-blue)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-blue)]",
                  idx === 0 ? "bg-brand-cream" : "bg-white",
                  votedItems.has(item.id) && "bg-green-50",
                )}
              >
                <span className={cn("font-display text-4xl lg:text-5xl leading-none opacity-40", themeAccent.title)}>
                  {(idx + 2).toString().padStart(2, "0")}
                </span>
                <div className="flex-grow min-w-0">
                  <p className="font-display text-2xl lg:text-3xl leading-none uppercase truncate tracking-tighter">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] lg:text-xs font-body font-bold uppercase opacity-70 truncate italic">
                      {item.artist}
                    </p>
                    {item.client_id === phone && (
                      <span className="bg-brand-lime text-[10px] px-1 font-bold border border-brand-blue leading-none">VOCÊ</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex flex-col items-center">
                  <button
                    onClick={() => handleVote(item.id)}
                    className="group flex flex-col items-center transition-all active:scale-125"
                  >
                    <span className={cn("font-display text-2xl lg:text-3xl leading-none transition-colors duration-300", votedItems.has(item.id) ? "text-green-500" : "text-brand-blue")}>
                      +{item.score}
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      {votedItems.has(item.id) ? (
                        <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <Check size={16} className="text-green-500" />
                        </motion.div>
                      ) : (
                        <motion.div key="thumb" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <ThumbsUp size={16} className="text-brand-blue group-hover:text-green-600" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  <p className="text-[9px] font-bold uppercase opacity-60 mt-1">@{item.client_name}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="QUER OUVIR O QUÊ?"
                className="w-full border-4 border-brand-blue bg-brand-cream px-6 py-4 font-display text-2xl lg:text-3xl uppercase tracking-tighter placeholder:text-brand-blue/30 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-lime/30"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
              />
              <button
                onClick={handleSearch}
                className="absolute right-4 bg-brand-blue p-2 text-brand-lime shadow-[2px_2px_0px_var(--color-brand-lime)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:translate-x-0 active:translate-y-0 transition-all"
              >
                {isSearching
                  ? <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-lime border-t-transparent" />
                  : <Search size={28} strokeWidth={3} />
                }
              </button>
            </div>
          </div>
        </div>

        {/* Identity Card */}
        <div className="md:col-span-3 md:row-span-2 card-bento-lime p-5 flex flex-col justify-between group">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/60 group-hover:text-brand-blue transition-colors">
              Sua Identidade
            </span>
            <span className="text-xs font-display bg-brand-blue text-brand-cream px-3 py-1 uppercase italic tracking-tighter">
              {getUserBadge(requestCount)}
            </span>
          </div>
          <div>
            <p className="text-4xl lg:text-5xl font-display uppercase italic text-brand-blue leading-none tracking-tight">
              {clientName || "VISITANTE"}
            </p>
            <p className="text-sm font-body font-bold text-brand-blue opacity-60">
              CLIENTE_ID: {phone?.slice(-4) || "????"}
            </p>
          </div>
          <div className="flex gap-1 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={cn("h-3 w-full", i < (MAX_REQUESTS - remaining) ? "bg-brand-blue" : "bg-brand-blue/20")}
              />
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase text-brand-blue opacity-60 mt-2">
            {remaining > 0 ? `${remaining} pedido${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""} hoje` : "Limite diário atingido"}
          </p>
        </div>

        {/* Wait Time Card */}
        <div className="md:col-span-4 md:row-span-2 border-4 border-brand-blue p-6 flex flex-col justify-center items-center text-center bg-brand-cream shadow-[8px_8px_0px_var(--color-brand-blue)]">
          <p className="text-xs font-bold uppercase mb-2 opacity-60 tracking-widest">TEMPO ESTIMADO</p>
          <div className="flex items-baseline gap-1">
            <p className="text-7xl lg:text-8xl font-display tracking-tighter text-brand-blue leading-none">
              {waitMinutes}
            </p>
            <span className="text-3xl font-display text-brand-blue">MIN</span>
          </div>
          <p className="text-[10px] font-bold uppercase mt-3 bg-brand-blue text-brand-lime px-4 py-1 italic tracking-widest">
            {upNext.length === 0 ? "Fila livre!" : upNext.length <= 3 ? "Fila andando rápido" : "Fila movimentada"}
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 flex flex-col md:flex-row justify-between items-center gap-6 border-t-8 border-brand-blue pt-8">
        <div className="flex flex-wrap justify-center md:justify-start gap-4">
          <span className="text-xs font-bold border-4 border-brand-blue bg-white px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)]">
            tocai.com/{slug}
          </span>
          <span className="text-xs font-bold border-4 border-brand-blue bg-brand-lime px-3 py-2 uppercase shadow-[4px_4px_0px_var(--color-brand-blue)]">
            PAGUE NO BALCÃO
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-red-600 animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
          <span className="text-lg font-display uppercase tracking-widest text-brand-blue italic">Real-time Sync Active</span>
        </div>
      </footer>

      {/* Identification Modal */}
      <AnimatePresence>
        {showIdentify && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-brand-blue/80 p-6 backdrop-blur-sm"
          >
            <form
              onSubmit={e => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = fd.get("name") as string;
                const p = fd.get("phone") as string;
                localStorage.setItem("caipa_phone", p);
                localStorage.setItem("caipa_name", name);
                setPhone(p);
                setClientName(name);
                if (slug) setRequestCount(getRequestCount(slug, p));
                setShowIdentify(false);
              }}
              className="card-bento w-full max-w-sm p-8 bg-white"
            >
              <h3 className="mb-2 text-4xl font-display text-brand-blue">CADÊ O PAGODE?</h3>
              <p className="mb-6 font-body text-lg font-bold uppercase leading-tight italic text-brand-blue/60">
                Antes de pedir, como devemos te chamar na fila?
              </p>

              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase text-brand-blue/50 italic">Nome/Apelido</label>
                  <input
                    name="name"
                    required
                    type="text"
                    placeholder="EX: KELVIN DO SAMBA"
                    className="w-full border-2 border-brand-blue p-3 font-display text-2xl uppercase focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-body text-xs font-bold uppercase text-brand-blue/50 italic">Celular</label>
                  <input
                    name="phone"
                    required
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full border-2 border-brand-blue p-3 font-display text-2xl focus:outline-none"
                  />
                </div>
                <button type="submit" className="btn-bento w-full text-2xl mt-4 uppercase">
                  ENTRAR NO FLOW
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
