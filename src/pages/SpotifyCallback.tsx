import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleCallback } from '../services/spotifyAuth';

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error');

    if (err) {
      const messages: Record<string, string> = {
        access_denied: 'Acesso negado. Você recusou a autorização do Spotify.',
        invalid_client: 'Client ID inválido. Verifique as configurações do app.',
      };
      setError(messages[err] ?? `Spotify recusou o acesso: ${err}`);
      return;
    }

    if (!code) {
      setError('Código de autorização não encontrado na resposta do Spotify.');
      return;
    }

    handleCallback(code, state)
      .then(() => {
        const returnPath = sessionStorage.getItem('sp_return_path') || '/';
        sessionStorage.removeItem('sp_return_path');
        navigate(returnPath, { replace: true });
      })
      .catch(e => setError(e.message));
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream p-8 text-center">
        <div className="card-bento bg-white p-10 max-w-md w-full">
          <h2 className="font-display text-4xl text-red-600 mb-4">ERRO NO LOGIN</h2>
          <p className="font-body text-base mb-8 text-brand-blue/80">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.history.back()}
              className="btn-bento w-full text-xl"
            >
              TENTAR NOVAMENTE
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full border-4 border-brand-blue/30 p-4 font-display text-xl uppercase text-brand-blue/60 hover:border-brand-blue hover:text-brand-blue transition-all"
            >
              VOLTAR AO INÍCIO
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream flex-col gap-6">
      <div className="h-16 w-16 animate-spin rounded-full border-8 border-brand-blue border-t-transparent" />
      <p className="font-display text-2xl text-brand-blue uppercase tracking-widest">
        Conectando ao Spotify...
      </p>
    </div>
  );
}
