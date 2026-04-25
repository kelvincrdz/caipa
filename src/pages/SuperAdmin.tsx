import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Lock, CheckCircle, XCircle, Clock, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabase";

const ADMIN_USER = "admin";
const ADMIN_PASSWORD = import.meta.env.VITE_SUPERADMIN_PASSWORD || "CAIPA2024";

interface Bar {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  is_approved: boolean;
  created_at: string;
}

export default function SuperAdmin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [bars, setBars] = useState<Bar[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const login = () => {
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      setLoginError(false);
      setAuthenticated(true);
    } else {
      setLoginError(true);
    }
  };

  const loadBars = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from("bars")
      .select("*")
      .order("is_approved", { ascending: true })
      .order("created_at", { ascending: false });
    setBars((data ?? []) as Bar[]);
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    loadBars();

    // Realtime: atualiza lista ao mudar status de aprovação
    const channel = supabase
      .channel("superadmin_bars")
      .on("postgres_changes", { event: "*", schema: "public", table: "bars" }, () => loadBars())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authenticated]);

  const approveBar = async (id: string) => {
    await supabase.from("bars").update({ is_approved: true }).eq("id", id);
  };

  const rejectBar = async (id: string, name: string) => {
    if (!confirm(`Recusar e DELETAR o bar "${name}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from("bars").delete().eq("id", id);
  };

  const revokeBar = async (id: string) => {
    await supabase.from("bars").update({ is_approved: false }).eq("id", id);
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-bento bg-white p-12 w-full max-w-sm text-center"
        >
          <div className="mb-6 flex justify-center text-brand-blue">
            <ShieldCheck size={72} strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl font-display text-brand-blue mb-2 leading-none">TOCAÍ ADMIN</h1>
          <p className="font-body text-sm font-bold uppercase opacity-60 mb-10 italic">Acesso restrito</p>
          <input
            type="text"
            placeholder="USUÁRIO"
            value={username}
            onChange={e => { setUsername(e.target.value); setLoginError(false); }}
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full border-4 border-brand-blue p-4 font-display text-2xl uppercase focus:outline-none focus:bg-brand-cream/30 mb-4"
            autoFocus
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="SENHA"
            value={password}
            onChange={e => { setPassword(e.target.value); setLoginError(false); }}
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full border-4 border-brand-blue p-4 font-display text-2xl uppercase focus:outline-none focus:bg-brand-cream/30 mb-4"
            autoComplete="current-password"
          />
          {loginError && (
            <p className="font-body text-sm font-bold uppercase text-red-600 mb-4">
              Usuário ou senha incorretos.
            </p>
          )}
          <button onClick={login} className="btn-bento w-full text-2xl">
            <Lock size={20} className="inline mr-2" /> ENTRAR
          </button>
        </motion.div>
      </div>
    );
  }

  const pending = bars.filter(b => !b.is_approved);
  const approved = bars.filter(b => b.is_approved);
  const baseUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-brand-cream p-6 lg:p-12">
      {/* Header */}
      <header className="mb-12 border-b-8 border-brand-blue pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-6xl lg:text-8xl font-display text-brand-blue leading-none">TOCAÍ ADMIN</h1>
          <p className="font-body text-xl font-black uppercase opacity-60 italic">Painel de aprovação de bares</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="card-bento px-6 py-4 text-center bg-yellow-50 border-yellow-500 shadow-[6px_6px_0px_rgba(234,179,8,1)]">
            <p className="font-display text-5xl text-yellow-600 leading-none">{pending.length}</p>
            <p className="font-body text-xs font-bold uppercase opacity-70">Pendentes</p>
          </div>
          <div className="card-bento px-6 py-4 text-center bg-brand-lime">
            <p className="font-display text-5xl text-brand-blue leading-none">{approved.length}</p>
            <p className="font-body text-xs font-bold uppercase opacity-70">Aprovados</p>
          </div>
          <button
            onClick={loadBars}
            disabled={refreshing}
            className="p-4 border-4 border-brand-blue bg-white shadow-[4px_4px_0px_var(--color-brand-blue)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-blue)] transition-all disabled:opacity-40"
          >
            <RefreshCw size={24} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="h-16 w-16 animate-spin rounded-full border-8 border-brand-blue border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-16">
          {/* Pending */}
          <section>
            <h2 className="text-4xl font-display uppercase border-l-8 border-yellow-500 pl-4 mb-8 text-yellow-600 flex items-center gap-3">
              <Clock size={32} /> AGUARDANDO APROVAÇÃO ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="font-body text-2xl uppercase font-black opacity-30 py-12 text-center border-4 border-dashed border-brand-blue">
                Nenhum bar pendente
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnimatePresence>
                  {pending.map(bar => (
                    <BarCard
                      key={bar.id}
                      bar={bar}
                      baseUrl={baseUrl}
                      onApprove={() => approveBar(bar.id)}
                      onReject={() => rejectBar(bar.id, bar.name)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Approved */}
          <section>
            <h2 className="text-4xl font-display uppercase border-l-8 border-green-500 pl-4 mb-8 text-green-600 flex items-center gap-3">
              <CheckCircle size={32} /> APROVADOS ({approved.length})
            </h2>
            {approved.length === 0 ? (
              <p className="font-body text-2xl uppercase font-black opacity-30 py-12 text-center border-4 border-dashed border-brand-blue">
                Nenhum bar aprovado ainda
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {approved.map(bar => (
                  <BarCard
                    key={bar.id}
                    bar={bar}
                    baseUrl={baseUrl}
                    approved
                    onRevoke={() => revokeBar(bar.id)}
                    onReject={() => rejectBar(bar.id, bar.name)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function BarCard({
  bar,
  baseUrl,
  approved = false,
  onApprove,
  onReject,
  onRevoke,
}: {
  bar: Bar;
  baseUrl: string;
  approved?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onRevoke?: () => void;
  [k: string]: any;
}) {
  const clientUrl = `${baseUrl}/${bar.slug}`;
  const adminUrl = `${baseUrl}/admin/${bar.slug}`;
  const createdAt = new Date(bar.created_at).toLocaleString("pt-BR");

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`card-bento p-6 flex flex-col gap-5 ${approved ? "bg-white" : "bg-yellow-50 border-yellow-500 shadow-[8px_8px_0px_rgba(234,179,8,1)]"}`}
    >
      {/* Bar Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-3xl uppercase leading-none truncate">{bar.name}</h3>
          <p className="font-body text-sm font-bold uppercase opacity-60 italic mt-1">
            /{bar.slug} • {bar.owner_name}
          </p>
          <p className="font-body text-xs font-bold opacity-40 uppercase mt-1">{bar.owner_email}</p>
          <p className="font-body text-xs font-bold opacity-30 uppercase mt-1">Cadastrado: {createdAt}</p>
        </div>

        {/* QR Code miniatura */}
        <div className="border-4 border-brand-blue p-2 bg-white flex-shrink-0">
          <QRCodeSVG value={clientUrl} size={72} bgColor="#ffffff" fgColor="#336580" level="M" />
        </div>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <a
          href={clientUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-body text-sm font-bold uppercase text-brand-blue hover:underline"
        >
          <ExternalLink size={14} /> {clientUrl}
        </a>
        <a
          href={adminUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-body text-sm font-bold uppercase text-brand-blue/60 hover:underline"
        >
          <ExternalLink size={14} /> {adminUrl}
        </a>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t-4 border-brand-blue/20">
        {!approved && onApprove && (
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-lime border-4 border-brand-blue py-3 font-display text-xl uppercase shadow-[4px_4px_0px_var(--color-brand-blue)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_var(--color-brand-blue)] transition-all"
          >
            <CheckCircle size={20} /> APROVAR
          </button>
        )}
        {approved && onRevoke && (
          <button
            onClick={onRevoke}
            className="flex items-center gap-2 bg-yellow-100 border-4 border-yellow-500 px-4 py-3 font-display text-lg uppercase text-yellow-700 hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <Clock size={18} /> SUSPENDER
          </button>
        )}
        <button
          onClick={onReject}
          className="flex items-center gap-2 bg-red-50 border-4 border-red-500 px-4 py-3 font-display text-lg uppercase text-red-600 hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
        >
          <XCircle size={18} /> DELETAR
        </button>
      </div>
    </motion.div>
  );
}
