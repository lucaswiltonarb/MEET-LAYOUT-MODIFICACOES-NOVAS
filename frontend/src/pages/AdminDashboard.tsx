import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/stats').then(r => r.json()).then(setStats); }, []);

  const cards = [
    { label: 'Planos', value: stats?.plans ?? '...', color: 'from-blue-600 to-blue-400' },
    { label: 'Experts', value: stats?.experts ?? '...', color: 'from-purple-600 to-purple-400' },
    { label: 'Perfis Fake', value: stats?.fakes ?? '...', color: 'from-pink-600 to-pink-400' },
    { label: 'Comentarios', value: stats?.comments ?? '...', color: 'from-amber-600 to-amber-400' },
  ];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-3xl font-light mb-2">Dashboard</h1>
      <p className="text-slate-400 mb-8">Visao geral da plataforma</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl p-6 bg-slate-900 border border-slate-800">
            <div className="text-xs uppercase tracking-wider text-slate-400 mb-3">{c.label}</div>
            <div className={`text-4xl font-light bg-gradient-to-br ${c.color} bg-clip-text text-transparent`}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
