import { useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/admin/me').then(r => r.json()).then(d => {
      if (!d.authenticated) navigate('/admin', { replace: true }); else setAuthed(true);
    });
  }, [navigate]);

  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); navigate('/admin', { replace: true }); };

  if (authed === null) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Carregando...</div>;

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/plans', label: 'Planos' },
    { to: '/admin/experts', label: 'Experts' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col">
        <div className="mb-8"><div className="text-2xl font-light">SimulaMarketing</div><div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Admin Panel</div></div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className={`px-4 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === item.to ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>{item.label}</Link>
          ))}
        </nav>
        <button onClick={logout} className="px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800 text-left">Sair</button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
