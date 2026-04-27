import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Copy, Check, Music, ExternalLink, QrCode, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/utils";

// ── Schema de validação ──────────────────────────────────────────────────────
const registerSchema = z.object({
  barName: z.string().min(3, "Nome deve ter pelo menos 3 letras"),
  ownerName: z.string().min(2, "Seu nome deve ter pelo menos 2 letras"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(10, "Telefone inválido").max(15, "Telefone muito longo"),
  address: z.string().min(10, "Endereço deve ser mais detalhado"),
  adminPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

// ── Utilitários ──────────────────────────────────────────────────────────────
const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");

// ── Input com floating label ─────────────────────────────────────────────────
function FloatingInput({
  label,
  type = "text",
  value,
  onChange,
  error,
  required = false,
  ...props
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Shake animation quando há erro
  useEffect(() => {
    if (error) {
      setShakeError(true);
      const timer = setTimeout(() => setShakeError(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const hasValue = value.length > 0;
  const labelActive = focused || hasValue;

  return (
    <div className="relative mb-6">
      <motion.div
        animate={{
          x: shakeError ? [-10, 10, -10, 10, 0] : 0
        }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "register-input",
            error && "border-red-500 focus:border-red-500"
          )}
          {...props}
        />

        <motion.label
          className={cn(
            "floating-label",
            labelActive && "active",
            error && "text-red-500"
          )}
          animate={{
            y: labelActive ? -20 : 0,
            scale: labelActive ? 0.85 : 1,
            color: error ? "#ef4444" : (focused ? "#FFB800" : "#807A6D")
          }}
          transition={{ duration: 0.2 }}
        >
          {label} {required && "*"}
        </motion.label>
      </motion.div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-label text-xs text-red-500 mt-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ── Componente de sucesso ────────────────────────────────────────────────────
function SuccessScreen({ slug, barName }: { slug: string; barName: string }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const clientUrl = `${window.location.origin}/${slug}`;
  const adminUrl = `${window.location.origin}/admin/${slug}`;
  const queueTvUrl = `${window.location.origin}/${slug}/fila`;

  const copyToClipboard = async (text: string, setCopied: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="register-container"
    >
      <div className="register-card max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-white" />
          </div>
          <h1 className="font-display text-3xl text-white mb-2">
            Bar Criado com Sucesso!
          </h1>
          <p className="font-body text-text-muted">
            Seu bar <span className="text-primary font-bold">{barName}</span> está pronto para receber pedidos de música.
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-asymmetric p-6 mb-6 text-center">
          <QRCodeSVG
            value={clientUrl}
            size={200}
            level="M"
            includeMargin={true}
          />
          <p className="font-label text-xs text-gray-600 mt-2">
            QR Code para clientes
          </p>
        </div>

        {/* Links importantes */}
        <div className="space-y-4 mb-8">
          <div className="bg-surface-dark rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-body font-bold text-white flex items-center gap-2">
                <Music size={16} />
                Link para Clientes
              </h3>
              <button
                onClick={() => copyToClipboard(clientUrl, setCopiedUrl)}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                {copiedUrl ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <p className="font-label text-sm text-text-muted break-all">
              {clientUrl}
            </p>
            <p className="font-label text-xs text-text-muted mt-2">
              Compartilhe este link para que os clientes peçam músicas
            </p>
          </div>

          <div className="bg-surface-dark rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-body font-bold text-white flex items-center gap-2">
                <ExternalLink size={16} />
                Painel Admin
              </h3>
              <button
                onClick={() => copyToClipboard(adminUrl, setCopiedAdmin)}
                className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
              >
                {copiedAdmin ? <Check size={16} /> : <Copy size={16} />}
                {copiedAdmin ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <p className="font-label text-sm text-text-muted break-all">
              {adminUrl}
            </p>
            <p className="font-label text-xs text-text-muted mt-2">
              Use este link para gerenciar a fila e conectar o Spotify
            </p>
          </div>

          <div className="bg-surface-dark rounded-lg p-4">
            <h3 className="font-body font-bold text-white flex items-center gap-2 mb-2">
              <QrCode size={16} />
              TV da Fila
            </h3>
            <p className="font-label text-sm text-text-muted break-all">
              {queueTvUrl}
            </p>
            <p className="font-label text-xs text-text-muted mt-2">
              Abra este link em uma TV para mostrar a fila atual e QR Code
            </p>
          </div>
        </div>

        {/* Próximos passos */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
          <h3 className="font-body font-bold text-primary mb-3">Próximos Passos</h3>
          <ol className="space-y-2 font-label text-sm text-text-muted">
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              Acesse o painel admin e conecte sua conta do Spotify
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              Imprima ou compartilhe o QR Code com seus clientes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              Configure uma TV com o link da fila para mostrar as músicas
            </li>
          </ol>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-4">
          <Link
            to={`/admin/${slug}`}
            className="btn-primary flex-1 text-center"
          >
            Ir para Admin
          </Link>
          <Link
            to={`/${slug}`}
            className="flex-1 text-center py-3 px-6 bg-surface-dark text-white rounded-asymmetric hover:bg-surface-darker transition-colors"
          >
            Ver como Cliente
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Register() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; barName: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      barName: "",
      ownerName: "",
      email: "",
      phone: "",
      address: "",
      adminPassword: "",
    }
  });

  const watchedValues = watch();

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);
    setError(null);

    try {
      let slug = toSlug(data.barName);

      // Verificar se slug já existe
      const { data: existing } = await supabase
        .from("bars")
        .select("slug")
        .eq("slug", slug)
        .maybeSingle();

      // Se existir, adicionar número
      if (existing) {
        let counter = 1;
        let newSlug = `${slug}-${counter}`;

        while (true) {
          const { data: existingCounter } = await supabase
            .from("bars")
            .select("slug")
            .eq("slug", newSlug)
            .maybeSingle();

          if (!existingCounter) {
            slug = newSlug;
            break;
          }

          counter++;
          newSlug = `${slug}-${counter}`;
        }
      }

      // Criar o bar
      const { data: bar, error: createError } = await supabase
        .from("bars")
        .insert([{
          slug,
          name: data.barName,
          owner_name: data.ownerName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          admin_password: data.adminPassword,
          is_approved: true, // Auto-aprovar por agora
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;

      setCreated({ slug, barName: data.barName });
    } catch (err: any) {
      setError(err.message || "Erro ao criar o bar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Se já foi criado, mostrar tela de sucesso
  if (created) {
    return <SuccessScreen slug={created.slug} barName={created.barName} />;
  }

  return (
    <div className="register-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="register-card"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-text-muted hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            <span className="font-label text-sm">Voltar</span>
          </Link>

          <h1 className="font-display text-4xl text-white mb-3">
            Registre Seu Bar.
          </h1>
          <p className="font-body text-text-muted">
            Configure sua mesa de som digital e deixe os clientes comandarem a playlist.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Error display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-lg p-4"
              >
                <p className="font-label text-sm text-red-500">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form fields */}
          <FloatingInput
            label="Nome do Bar"
            value={watchedValues.barName}
            onChange={(value) => setValue("barName", value)}
            error={errors.barName?.message}
            required
            {...register("barName")}
          />

          <FloatingInput
            label="Seu Nome"
            value={watchedValues.ownerName}
            onChange={(value) => setValue("ownerName", value)}
            error={errors.ownerName?.message}
            required
            {...register("ownerName")}
          />

          <FloatingInput
            label="Email"
            type="email"
            value={watchedValues.email}
            onChange={(value) => setValue("email", value)}
            error={errors.email?.message}
            required
            {...register("email")}
          />

          <FloatingInput
            label="Telefone"
            type="tel"
            value={watchedValues.phone}
            onChange={(value) => setValue("phone", value)}
            error={errors.phone?.message}
            required
            {...register("phone")}
          />

          <FloatingInput
            label="Endereço Completo"
            value={watchedValues.address}
            onChange={(value) => setValue("address", value)}
            error={errors.address?.message}
            required
            {...register("address")}
          />

          <FloatingInput
            label="Senha de Admin"
            type="password"
            value={watchedValues.adminPassword}
            onChange={(value) => setValue("adminPassword", value)}
            error={errors.adminPassword?.message}
            required
            {...register("adminPassword")}
          />

          {/* Submit button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full text-lg py-4 relative overflow-hidden"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2"
                >
                  <div className="loading-spinner w-5 h-5" />
                  Criando seu bar...
                </motion.div>
              ) : (
                <motion.span
                  key="text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Criar Meu Bar
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="font-label text-xs text-text-muted">
            Ao criar sua conta, você concorda com nossos{" "}
            <a href="#" className="text-primary hover:text-primary/80">
              Termos de Uso
            </a>
            {" "}e{" "}
            <a href="#" className="text-primary hover:text-primary/80">
              Política de Privacidade
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}