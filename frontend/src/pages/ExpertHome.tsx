import { useEffect, useState } from 'react';
import { useUser, SignInButton } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import useAuthFetch from '@/hooks/useAuthFetch';

export default function ExpertHome() {
  const { isLoaded, isSignedIn, user } = useUser();
  const authFetch = useAuthFetch();
  const [check, setCheck] = useState<any>(null);
  const [meetingId, setMeetingId] = useState('');

  useEffect(() => {
    if (!isSignedIn) return;
    authFetch('/api/expert/check').then(r => r.json()).then(setCheck);
  }, [isSignedIn, authFetch]);

  if (!isLoaded) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;
  if (!isSignedIn) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center"><h1 className="text-3xl font-light mb-4">Area do Expert</h1><p className="text-slate-400 mb-6">Faca login para acessar.</p><SignInButton><button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg">Entrar</button></SignInButton></div>
    </div>
  );
  if (!check) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Verificando...</div>;
  if (!check.isExpert) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center max-w-md"><h1 className="text-3xl font-light mb-4">Sem acesso</h1><p className="text-slate-400 mb-4">Voce nao esta cadastrado como Expert.</p><p className="text-slate-500 text-sm mb-2">Peca ao admin para cadastrar seu Clerk User ID:</p><code className="block bg-slate-900 px-4 py-3 rounded-lg text-blue-400 font-mono text-sm break-all">{user?.id}</code></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-light mb-2">Painel do Expert</h1>
        <p className="text-slate-400 mb-1">Ola, <strong>{check.expert.name}</strong></p>
        {check.plan && <p className="text-slate-400 mb-8 text-sm">Plano: <span className="text-blue-400">{check.plan.name}</span> - Limite: {check.plan.maxFakeParticipants} fakes / {check.plan.maxComments} comentarios por reuniao</p>}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 mb-6">
          <h2 className="text-xl font-light mb-4">Gerenciar uma reuniao</h2>
          <p className="text-slate-400 text-sm mb-4">Cole o codigo da reuniao (ex: <code className="text-blue-400">abc-defg-hij</code>):</p>
          <div className="flex gap-2">
            <input data-testid="meeting-id-input" value={meetingId} onChange={e => setMeetingId(e.target.value)} placeholder="abc-defg-hij" className="flex-1 rounded-lg bg-slate-950 px-4 py-3 border border-slate-800 focus:border-blue-500 outline-none font-mono" />
            <Link to={meetingId ? `/expert/${meetingId}` : '#'} data-testid="open-meeting-btn" className={`px-6 py-3 rounded-lg ${meetingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 cursor-not-allowed opacity-50'}`}>Abrir</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
