import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "motion/react";
import { ArrowLeft, Clock, Copy, Check, Rocket, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

const registerSchema = z.object({
  barName: z.string().min(3, "Nome do bar deve ter pelo menos 3 letras"),
  ownerName: z.string().min(2, "Seu nome deve ter pelo menos 2 letras"),
  email: z.string().email("Email inválido"),
  adminPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; barName: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const baseUrl = window.location.origin;

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError(null);

    let slug = toSlug(data.barName);

    const { data: existing } = await supabase
      .from("bars")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const { error: barError } = await supabase.from("bars").insert({
      name: data.barName,
      slug,
      owner_name: data.ownerName,
      owner_email: data.email,
      admin_password: data.adminPassword,
    });

    if (barError) {
      setError("Erro ao cadastrar o bar. Tente novamente.");
      setLoading(false);
      return;
    }

    await supabase.from("sessions").insert({
      bar_slug: slug,
      theme: "Livre",
      blocked_artists: [],
      blocked_keywords: [],
    });

    setLoading(false);
    setCreated({ slug, barName: data.barName });
  };

  const copyToClipboard = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (created) {
    const clientUrl = `${baseUrl}/${created.slug}`;
    const adminUrl = `${baseUrl}/admin/${created.slug}`;

    return (
      <div className="flex min-h-screen flex-col items-center bg-brand-cream py-20 px-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-3xl space-y-8"
        >
          {/* Success Header */}
          <div className="card-bento bg-brand-blue text-brand-cream p-10 text-center">
            <div className="mb-4 inline-block bg-brand-lime text-brand-blue font-display px-6 py-2 text-2xl shadow-[-4px_4px_0px_rgba(255,255,255,0.3)]">
              ETAPA 1 DE 2
            </div>
            <h2 className="text-7xl font-display leading-none mb-3">
              BAR REGISTRADO!
            </h2>
            <p className="font-body text-2xl font-black uppercase italic opacity-80 leading-tight">
              {created.barName} entrou para a família Tocaí.
            </p>
          </div>

          {/* Pending Approval Notice */}
          <div className="border-4 border-yellow-500 bg-yellow-50 p-8 shadow-[8px_8px_0px_rgba(234,179,8,1)]">
            <div className="flex items-center gap-4 mb-4">
              <Clock size={40} className="text-yellow-600 flex-shrink-0" />
              <div>
                <h3 className="font-display text-3xl text-yellow-700 leading-none">AGUARDANDO APROVAÇÃO</h3>
                <p className="font-body text-lg font-black uppercase italic opacity-70 mt-1">
                  Nossa equipe vai revisar seu cadastro em até 24h.
                </p>
              </div>
            </div>
            <p className="font-body text-base font-bold uppercase opacity-60">
              Quando aprovado, os clientes já poderão acessar a URL abaixo e pedir músicas em tempo real.
              Guarde a URL do painel admin — você vai precisar dela para gerenciar as filas.
            </p>
          </div>

          {/* QR Code + Client URL */}
          <div className="card-bento bg-white p-8">
            <h3 className="font-display text-4xl uppercase border-b-4 border-brand-blue pb-4 mb-8 flex items-center gap-3">
              <QrCode size={36} /> URL DOS CLIENTES
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="border-[8px] border-brand-blue p-4 shadow-[8px_8px_0px_var(--color-brand-blue)] flex-shrink-0">
                <QRCodeSVG
                  value={clientUrl}
                  size={180}
                  bgColor="#1A1A1A"
                  fgColor="#FFB800"
                  level="M"
                />
              </div>
              <div className="flex-1 space-y-4">
                <p className="font-body text-sm font-black uppercase opacity-60 italic">
                  Imprima este QR code e coloque nas mesas. Os clientes escaneiam e pedem músicas!
                </p>
                <div className="flex items-center gap-3 border-4 border-brand-blue p-4 bg-brand-cream">
                  <p className="font-display text-2xl lg:text-3xl text-brand-blue flex-1 truncate tracking-tighter">
                    {clientUrl}
                  </p>
                  <button
                    onClick={() => copyToClipboard(clientUrl, setCopiedUrl)}
                    className="flex-shrink-0 bg-brand-blue text-brand-lime p-3 shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-lime)] transition-all"
                  >
                    {copiedUrl ? <Check size={20} /> : <Copy size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Admin URL */}
          <div className="card-bento-lime p-8">
            <h3 className="font-display text-4xl uppercase border-b-4 border-brand-blue pb-4 mb-6">
              🔒 PAINEL DO ADMIN (SOMENTE VOCÊ)
            </h3>
            <p className="font-body text-base font-black uppercase opacity-60 italic mb-4">
              Use esta URL para gerenciar a fila, definir o tema da noite e vetar músicas. Não compartilhe!
            </p>
            <div className="border-4 border-brand-blue bg-white p-4 mb-4 space-y-1">
              <p className="font-body text-sm font-bold uppercase text-brand-blue/70">Login de acesso:</p>
              <p className="font-body text-sm font-bold uppercase">
                <span className="opacity-50">USUÁRIO:</span> <span className="font-display text-lg">{created.slug}</span>
              </p>
              <p className="font-body text-sm font-bold uppercase opacity-50">SENHA: a que você acabou de definir</p>
            </div>
            <div className="flex items-center gap-3 border-4 border-brand-blue p-4 bg-white">
              <p className="font-display text-xl lg:text-2xl text-brand-blue flex-1 truncate tracking-tighter">
                {adminUrl}
              </p>
              <button
                onClick={() => copyToClipboard(adminUrl, setCopiedAdmin)}
                className="flex-shrink-0 bg-brand-blue text-brand-lime p-3 shadow-[4px_4px_0px_var(--color-brand-lime)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-lime)] transition-all"
              >
                {copiedAdmin ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <a
              href={adminUrl}
              className="btn-bento w-full text-2xl mt-6 flex items-center justify-center"
            >
              ACESSAR PAINEL ADMIN
            </a>
          </div>

          <Link
            to="/"
            className="block text-center font-display text-2xl text-brand-blue uppercase opacity-60 hover:opacity-100 transition-opacity"
          >
            ← Voltar para o início
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-brand-cream py-20 px-6">
      <Link
        to="/"
        className="mb-12 flex items-center gap-2 font-display text-3xl text-brand-blue hover:translate-x-[-4px] transition-transform"
      >
        <ArrowLeft size={32} strokeWidth={3} /> VOLTAR
      </Link>

      <div className="card-bento w-full max-w-2xl bg-white p-10 md:p-16">
        <div className="mb-12 border-b-8 border-brand-blue pb-6">
          <h1 className="text-4xl font-display text-brand-blue leading-none tracking-tighter">
            CADASTRE SEU BAR
          </h1>
          <p className="font-body text-base font-black uppercase opacity-60 italic leading-none mt-2">
            Comece a batucar no Tocaí hoje mesmo.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <FormField
              label="NOME DO ESTABELECIMENTO"
              error={errors.barName?.message}
              {...register("barName")}
              placeholder="EX: BAR DO ZÉ"
            />
            <FormField
              label="SEU NOME"
              error={errors.ownerName?.message}
              {...register("ownerName")}
              placeholder="EX: MARIA SILVA"
            />
          </div>

          <FormField
            label="EMAIL DO RESPONSÁVEL"
            error={errors.email?.message}
            {...register("email")}
            placeholder="SEU@EMAIL.COM"
            type="email"
          />

          <FormField
            label="SENHA DO PAINEL ADMIN"
            error={errors.adminPassword?.message}
            {...register("adminPassword")}
            placeholder="MÍN. 6 CARACTERES"
            type="password"
          />

          {error && (
            <div className="border-4 border-red-500 bg-red-50 p-4">
              <p className="font-body font-black uppercase text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-bento w-full flex items-center justify-center gap-3 text-2xl py-5 mt-8 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "CADASTRANDO..." : "ABRIR O BAR!"} <Rocket size={24} strokeWidth={3} />
          </button>
        </form>
      </div>

      <div className="mt-12 flex items-center gap-4 font-display text-xl font-bold uppercase opacity-30">
        <span>PLATAFORMA TOCAÍ</span>
        <span className="text-brand-blue font-black">•</span>
        <span>CADASTRO SUJEITO À APROVAÇÃO</span>
      </div>
    </div>
  );
}

const FormField = ({ label, error, ...props }: any) => (
  <div className="flex flex-col gap-2 text-left">
    <label className="font-body text-base font-black uppercase tracking-tight text-brand-blue/70">
      {label}
    </label>
    <input
      {...props}
      className={cn(
        "border-4 border-brand-blue p-4 font-display text-lg uppercase focus:bg-brand-cream/30 focus:outline-none transition-colors",
        error ? "border-red-500 bg-red-50" : "bg-white",
      )}
    />
    {error && (
      <span className="text-sm font-black text-red-500 uppercase tracking-tighter italic">{error}</span>
    )}
  </div>
);
