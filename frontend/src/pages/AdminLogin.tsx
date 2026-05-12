import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => { if (d.authenticated) navigate('/admin/dashboard', { replace: true }); });
  }, [navigate]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    setLoading(false);
    if (res.ok) navigate('/admin/dashboard', { replace: true }); else setError('Senha incorreta');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <form onSubmit={login} data-testid="admin-login-form" className="w-full max-w-sm p-8 rounded-2xl bg-slate-800 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-light mb-1">Admin Panel</h1>
        <p className="text-slate-400 text-sm mb-6">Moogle Meet</p>
        <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Senha</label>
        <input data-testid="admin-password-input" type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus className="w-full rounded-lg bg-slate-900 px-4 py-3 border border-slate-700 focus:border-blue-500 outline-none mb-4" />
        {error && <div className="text-red-400 text-sm mb-3" data-testid="admin-login-error">{error}</div>}
        <button data-testid="admin-login-submit" disabled={loading || !password} className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium">{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  );
}
