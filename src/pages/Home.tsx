import React from 'react';
import { motion } from "motion/react";
import { Music, Beer, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="flex flex-col items-center">
      {/* Hero Section */}
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

      {/* Footer / CTA Final */}
      <footer className="w-full border-t-4 border-brand-blue bg-white py-12 text-center">
         <p className="font-display text-2xl">TOCAÍ © 2026 — MADE IN BRASIL 🇧🇷</p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="card-bento flex flex-col p-8 bg-white"
    >
      <div className="mb-6 text-brand-blue drop-shadow-[3px_3px_0px_var(--color-brand-lime)]">
        {icon}
      </div>
      <h3 className="mb-4 text-4xl font-display uppercase italic tracking-tighter leading-none">{title}</h3>
      <p className="font-body text-xl leading-tight font-bold opacity-70">{description}</p>
    </motion.div>
  );
}
