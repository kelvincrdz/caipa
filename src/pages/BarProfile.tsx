import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  MapPin, Phone, ExternalLink, Clock, Music, Tag, DollarSign,
  ArrowRight, Instagram,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Bar } from "../types";
import { cn } from "../lib/utils";
import { applyTheme } from "../lib/themes";

const DAYS: { key: string; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const GENRE_COLORS: Record<string, string> = {
  Forró: "border-orange-400 text-orange-700 bg-orange-50",
  Samba: "border-green-500 text-green-700 bg-green-50",
  Pagode: "border-emerald-500 text-emerald-700 bg-emerald-50",
  MPB: "border-violet-500 text-violet-700 bg-violet-50",
  Axé: "border-yellow-500 text-yellow-700 bg-yellow-50",
  Rock: "border-red-500 text-red-700 bg-red-50",
  Pop: "border-pink-500 text-pink-700 bg-pink-50",
  Funk: "border-fuchsia-500 text-fuchsia-700 bg-fuchsia-50",
  Eletrônica: "border-blue-500 text-blue-700 bg-blue-50",
  Reggae: "border-lime-500 text-lime-700 bg-lime-50",
  "Bossa Nova": "border-amber-500 text-amber-700 bg-amber-50",
  Sertanejo: "border-stone-500 text-stone-700 bg-stone-50",
  "Hip-Hop": "border-indigo-500 text-indigo-700 bg-indigo-50",
  Jazz: "border-cyan-500 text-cyan-700 bg-cyan-50",
};

function todayKey(): string {
  const map = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  return map[new Date().getDay()];
}

export default function BarProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [bar, setBar] = useState<Bar | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("bars")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        applyTheme(data?.visual_theme ?? 'boteco');
        if (data?.theme_primary)
          document.documentElement.style.setProperty("--color-brand-blue", data.theme_primary);
        if (data?.theme_accent)
          document.documentElement.style.setProperty("--color-brand-lime", data.theme_accent);
        setBar(data);
        setLoading(false);
      });
    return () => {
      applyTheme('boteco');
      document.documentElement.style.removeProperty("--color-brand-blue");
      document.documentElement.style.removeProperty("--color-brand-lime");
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!bar) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
        <p className="font-display text-6xl text-brand-blue">BAR NÃO ENCONTRADO</p>
        <Link to="/" className="btn-bento text-2xl">VOLTAR PRA HOME</Link>
      </div>
    );
  }

  const today = todayKey();
  const todayHours = bar.opening_hours?.[today];
  const googleMapsUrl = bar.lat && bar.lng
    ? `https://maps.google.com/?q=${bar.lat},${bar.lng}`
    : bar.address
    ? `https://maps.google.com/?q=${encodeURIComponent(bar.address)}`
    : null;

  const whatsappUrl = bar.whatsapp
    ? `https://wa.me/55${bar.whatsapp.replace(/\D/g, "")}`
    : null;

  const instagramUrl = bar.instagram
    ? `https://instagram.com/${bar.instagram.replace(/^@/, "")}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col"
    >
      {/* Header */}
      <header className="border-b-8 border-brand-blue bg-brand-blue px-6 py-10 text-center text-brand-cream">
        <div className="mx-auto max-w-2xl">
          {bar.logo_url ? (
            <img
              src={bar.logo_url}
              alt={bar.name}
              className="mx-auto mb-6 max-h-28 max-w-xs object-contain"
            />
          ) : (
            <div className="mb-4 inline-block bg-brand-lime px-4 py-2">
              <span className="font-display text-4xl text-brand-blue tracking-widest uppercase">BAR</span>
            </div>
          )}
          <h1 className="font-display text-7xl md:text-9xl leading-none tracking-tighter uppercase text-brand-cream mb-2">
            {bar.name}
          </h1>
          {todayHours && (
            <span className={cn(
              "inline-flex items-center gap-2 border-4 px-4 py-1.5 font-display text-xl uppercase mt-3",
              todayHours.toLowerCase() === "fechado"
                ? "border-red-400 text-red-300"
                : "border-brand-lime text-brand-lime shadow-[4px_4px_0px_rgba(209,220,90,0.4)]",
            )}>
              <Clock size={16} />
              HOJE: {todayHours}
            </span>
          )}
        </div>
      </header>

      {/* CTA principal */}
      <div className="border-b-8 border-brand-blue bg-brand-lime py-8 text-center">
        <Link
          to={`/${slug}`}
          className="inline-flex items-center gap-4 bg-brand-blue text-brand-lime border-8 border-brand-lime px-10 py-5 font-display text-4xl md:text-5xl uppercase shadow-[8px_8px_0px_rgba(0,0,0,0.3)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.3)] transition-all"
        >
          <Music size={40} /> PEDIR MÚSICA AGORA <ArrowRight size={40} />
        </Link>
        <p className="mt-4 font-body text-base font-bold uppercase opacity-70 text-brand-blue">
          Aponte a câmera para o QR Code ou acesse tocai.com/{slug}
        </p>
      </div>

      {/* Info grid */}
      <div className="mx-auto w-full max-w-4xl px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Descrição */}
        {bar.description && (
          <div className="md:col-span-2 card-bento bg-white p-8">
            <p className="font-body text-xl font-bold leading-relaxed text-brand-blue/80">
              {bar.description}
            </p>
          </div>
        )}

        {/* Endereço */}
        {bar.address && (
          <div className="card-bento bg-white p-8">
            <div className="flex items-start gap-3 mb-4">
              <MapPin size={28} className="text-brand-blue flex-shrink-0 mt-0.5" />
              <h2 className="font-display text-3xl uppercase leading-none">ENDEREÇO</h2>
            </div>
            <p className="font-body text-lg font-bold text-brand-blue/80 mb-4">{bar.address}</p>
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border-4 border-brand-blue bg-brand-blue text-brand-lime px-4 py-2 font-display text-lg uppercase shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-lime)] transition-all"
              >
                <ExternalLink size={16} /> VER NO MAPS
              </a>
            )}
          </div>
        )}

        {/* Gêneros musicais */}
        {bar.music_style && bar.music_style.length > 0 && (
          <div className="card-bento bg-white p-8">
            <div className="flex items-center gap-3 mb-4">
              <Tag size={28} className="text-brand-blue flex-shrink-0" />
              <h2 className="font-display text-3xl uppercase leading-none">ESTILO MUSICAL</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {bar.music_style.map(style => (
                <span
                  key={style}
                  className={cn(
                    "border-4 px-4 py-1.5 font-display text-xl uppercase tracking-tight",
                    GENRE_COLORS[style] ?? "border-brand-blue text-brand-blue bg-brand-cream",
                  )}
                >
                  {style}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Horários */}
        {bar.opening_hours && Object.keys(bar.opening_hours).length > 0 && (
          <div className="card-bento bg-white p-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock size={28} className="text-brand-blue flex-shrink-0" />
              <h2 className="font-display text-3xl uppercase leading-none">HORÁRIOS</h2>
            </div>
            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const hours = bar.opening_hours?.[key];
                if (!hours) return null;
                const closed = hours.toLowerCase() === "fechado";
                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center justify-between border-2 px-4 py-2",
                      key === today ? "border-brand-blue bg-brand-lime/30 font-black" : "border-brand-blue/20",
                    )}
                  >
                    <span className="font-display text-xl uppercase">{label}</span>
                    <span className={cn(
                      "font-body text-base font-bold uppercase",
                      closed ? "text-red-500" : "text-brand-blue",
                    )}>
                      {hours}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Couvert + contato */}
        <div className="card-bento bg-white p-8 space-y-6">
          {bar.cover_charge && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <DollarSign size={24} className="text-brand-blue flex-shrink-0" />
                <h2 className="font-display text-2xl uppercase leading-none">COUVERT</h2>
              </div>
              <p className="font-body text-xl font-bold text-brand-blue/80">{bar.cover_charge}</p>
            </div>
          )}

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 border-4 border-green-500 bg-green-500 text-white px-5 py-3 font-display text-2xl uppercase shadow-[4px_4px_0px_rgba(0,100,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(0,100,0,0.3)] transition-all"
            >
              <Phone size={22} />
              FALAR NO WHATSAPP
            </a>
          )}

          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 border-4 border-fuchsia-500 bg-fuchsia-500 text-white px-5 py-3 font-display text-2xl uppercase shadow-[4px_4px_0px_rgba(192,38,211,0.4)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_rgba(192,38,211,0.4)] transition-all"
            >
              <Instagram size={22} />
              VER NO INSTAGRAM
            </a>
          )}
        </div>
      </div>

      {/* Map embed */}
      {bar.lat && bar.lng && (
        <div className="mx-auto w-full max-w-4xl px-6 pb-12">
          <div className="border-8 border-brand-blue overflow-hidden">
            <iframe
              title="Localização do bar"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bar.lng - 0.008},${bar.lat - 0.008},${bar.lng + 0.008},${bar.lat + 0.008}&layer=mapnik&marker=${bar.lat},${bar.lng}`}
              width="100%"
              height="320"
              style={{ border: 0, display: "block" }}
              loading="lazy"
            />
          </div>
        </div>
      )}

      {/* CTA bottom */}
      <div className="mt-auto border-t-8 border-brand-blue bg-brand-cream py-8 text-center">
        <Link
          to={`/${slug}`}
          className="inline-flex items-center gap-3 bg-brand-blue text-brand-lime border-4 border-brand-blue px-8 py-4 font-display text-3xl uppercase shadow-[6px_6px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_var(--color-brand-lime)] transition-all"
        >
          <Music size={28} /> PEDIR MÚSICA
        </Link>
        <p className="mt-4 font-body text-sm font-bold uppercase opacity-50">
          TOCAÍ © 2026 — MADE IN BRASIL 🇧🇷
        </p>
      </div>
    </motion.div>
  );
}
