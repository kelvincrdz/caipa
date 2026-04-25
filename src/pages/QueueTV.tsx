import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Music, Play, Disc, Pause } from "lucide-react";
import { useQueue } from "../hooks/useQueue";
import { usePlayer } from "../hooks/usePlayer";

function EqBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-8 w-10 flex-shrink-0">
      <div
        className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-1" : ""}`}
        style={{ height: active ? undefined : "30%" }}
      />
      <div
        className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-2" : ""}`}
        style={{ height: active ? undefined : "30%" }}
      />
      <div
        className={`w-2 bg-brand-lime rounded-sm transition-all duration-300 ${active ? "eq-bar-3" : ""}`}
        style={{ height: active ? undefined : "30%" }}
      />
    </div>
  );
}

export default function QueueTV() {
  const { slug } = useParams<{ slug: string }>();
  const [time, setTime] = useState(new Date());
  const { queue, advanceQueue } = useQueue(slug);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nowPlaying = queue[0] ?? null;
  const upNext = queue.slice(1, 5);

  const { isPlaying, progress, autoplayBlocked, togglePlay } = usePlayer(
    nowPlaying?.preview_url,
    advanceQueue,
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex h-screen w-full flex-col overflow-hidden bg-brand-cream border-[16px] border-brand-blue selection:bg-brand-lime"
    >
      {/* Top Banner */}
      <header className="flex items-center justify-between border-b-[12px] border-brand-blue bg-white p-8 lg:p-12 text-brand-blue">
        <div>
          <h1 className="text-7xl lg:text-9xl font-display leading-none tracking-tighter uppercase">
            TOCA<span className="text-brand-lime text-stroke-blue">Í</span>
          </h1>
          <p className="font-body text-2xl font-black italic uppercase opacity-60">
            Sintonizado em: tocai.com/{slug}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-3">
          <p className="font-display text-7xl lg:text-9xl leading-none tracking-tighter animate-pulse">
            {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="flex items-center gap-4">
            {nowPlaying?.preview_url && (
              <button
                onClick={togglePlay}
                className="bg-brand-blue text-brand-lime border-4 border-brand-blue px-6 py-2 font-display text-2xl flex items-center gap-2 shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {isPlaying
                  ? <><Pause size={24} fill="currentColor" /> PAUSAR</>
                  : <><Play size={24} fill="currentColor" />{autoplayBlocked ? "TOQUE PARA OUVIR" : "TOCAR"}</>
                }
              </button>
            )}
            <div className="bg-brand-lime px-4 py-1 border-4 border-brand-blue inline-block shadow-[4px_4px_0px_var(--color-brand-blue)]">
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
              <div className="relative mb-16">
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-16 rounded-full border-8 border-dashed border-brand-lime opacity-20"
                />
                <div className="relative flex h-80 w-80 lg:h-[28rem] lg:w-[28rem] items-center justify-center border-[12px] border-brand-cream bg-black shadow-[32px_32px_0px_0px_var(--color-brand-lime)] overflow-hidden">
                  {nowPlaying.thumbnail_url ? (
                    <img src={nowPlaying.thumbnail_url} className="h-full w-full object-cover" alt={nowPlaying.title} />
                  ) : (
                    <Disc size={160} className="text-brand-lime" />
                  )}
                  <div className="absolute top-8 left-8 flex items-center gap-3 bg-brand-lime px-8 py-3 font-display text-3xl text-brand-blue shadow-[-8px_8px_0px_var(--color-brand-blue)]">
                    {isPlaying
                      ? <><EqBars active={true} /> TOCANDO AGORA</>
                      : <><Music size={28} /> PRÓXIMA FAIXA</>
                    }
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {nowPlaying.preview_url && (
                <div className="w-full max-w-lg mb-8 h-2 bg-white/20 relative">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-y-0 left-0 bg-brand-lime"
                  />
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.h2
                  key={nowPlaying.id + "-title"}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="mb-4 text-7xl lg:text-[8rem] font-display uppercase leading-none tracking-tighter"
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
                  className="text-4xl lg:text-6xl font-body font-black uppercase tracking-widest text-brand-lime leading-none italic"
                >
                  {nowPlaying.artist}
                </motion.p>
              </AnimatePresence>

              <div className="mt-12 flex items-center gap-6 border-[8px] border-brand-cream bg-white/5 px-12 py-6 backdrop-blur-sm">
                <div className="h-8 w-8 animate-pulse rounded-full bg-red-600 shadow-[0_0_20px_red]" />
                <p className="font-display text-4xl italic uppercase leading-none text-brand-cream">
                  REQUISITADO POR{" "}
                  <span className="text-brand-lime">@{nowPlaying.client_name}</span>
                </p>
              </div>
            </>
          ) : (
            <div className="font-display text-7xl opacity-30 animate-bounce text-center leading-tight">
              AGUARDANDO O PRÓXIMO HIT...
            </div>
          )}
        </section>

        {/* Right: Up Next */}
        <section className="flex flex-1 flex-col border-l-[12px] border-brand-blue bg-white py-12">
          <div className="mb-12 px-12">
            <h3 className="mb-6 inline-block border-b-8 border-brand-lime font-display text-6xl uppercase italic tracking-tighter">
              PRÓXIMOS DA FILA
            </h3>
          </div>

          <div className="flex-1 space-y-6 overflow-hidden px-12">
            {upNext.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20 space-y-4">
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
                  delay={idx * 0.1}
                />
              ))
            )}
          </div>

          <div className="mt-auto bg-brand-lime p-12 text-brand-blue border-t-[12px] border-brand-blue shadow-[-8px_-8px_0px_var(--color-brand-blue)]">
            <p className="font-display text-5xl leading-none uppercase tracking-tighter">PEÇA PELO CELULAR:</p>
            <div className="mt-8 flex items-center gap-8">
              <div className="aspect-square w-40 border-[8px] border-brand-blue bg-white flex items-center justify-center">
                <p className="font-display text-center text-lg text-brand-blue leading-tight uppercase p-2">
                  ACESSE<br />tocai.com<br />/{slug}
                </p>
              </div>
              <div className="space-y-2">
                <p className="font-body text-3xl font-black uppercase leading-none italic">
                  TOCAÍ.COM/{slug}
                </p>
                <p className="font-body text-xl font-bold uppercase opacity-70">
                  Aumente o volume, quem manda no bar hoje é você.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function TVQueueItem({ rank, title, artist, client, delay = 0 }: { rank: number; title: string; artist: string; client: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ x: -4, transition: { duration: 0.15 } }}
      className="flex items-center gap-8 border-4 border-brand-blue bg-white p-8 shadow-[8px_8px_0px_var(--color-brand-lime)]"
    >
      <span className="font-display text-7xl text-brand-blue leading-none tracking-tighter">{rank}º</span>
      <div className="flex-1 overflow-hidden">
        <h4 className="truncate text-5xl font-display uppercase leading-none tracking-tighter text-brand-blue">{title}</h4>
        <p className="truncate font-body text-2xl font-black uppercase text-brand-blue/60 italic tracking-tight">{artist}</p>
      </div>
      <div className="text-right border-l-4 border-brand-lime pl-8">
        <span className="font-body text-xs font-black uppercase text-brand-blue/50 leading-none block mb-2 tracking-widest">
          PARA @{client}
        </span>
        <p className="font-display text-4xl text-brand-blue leading-none">UP NEXT</p>
      </div>
    </motion.div>
  );
}
