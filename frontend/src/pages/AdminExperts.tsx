import { useEffect, useState } from 'react';
type Plan = { _id: string; name: string };
type Expert = { _id: string; email: string; name: string; clerkUserId?: string; planId?: string; plan?: { name: string } | null; active: boolean };

export default function AdminExperts() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expert | null>(null);
  const empty: Expert = { _id: '', email: '', name: '', clerkUserId: '', planId: '', active: true };
  const [form, setForm] = useState<Expert>(empty);

  const load = async () => {
    const [er, pr] = await Promise.all([fetch('/api/admin/experts').then(r => r.json()), fetch('/api/admin/plans').then(r => r.json())]);
    setExperts(er.experts || []); setPlans(pr.plans || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch('/api/admin/experts', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setShowForm(false); setEditing(null); setForm(empty); load();
  };
  const del = async (id: string) => { if (!window.confirm('Excluir?')) return; await fetch(`/api/admin/experts?id=${id}`, { method: 'DELETE' }); load(); };

  return (
    <div data-testid="admin-experts-page">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-3xl font-light">Experts</h1></div>
        <button data-testid="new-expert-btn" onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }} className="bg-purple-600 hover:bg-purple-700 px-5 py-2.5 rounded-lg text-sm font-medium">+ Novo Expert</button>
      </div>
      <div className="rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs"><tr><th className="text-left px-6 py-3">Nome</th><th className="text-left px-6 py-3">Email</th><th className="text-left px-6 py-3">Clerk ID</th><th className="text-left px-6 py-3">Plano</th><th className="text-left px-6 py-3">Status</th><th className="text-right px-6 py-3">Acoes</th></tr></thead>
          <tbody className="bg-slate-950">{experts.map(e => (
            <tr key={e._id} className="border-t border-slate-800"><td className="px-6 py-4 font-medium">{e.name}</td><td className="px-6 py-4 text-slate-400">{e.email}</td><td className="px-6 py-4 text-slate-500 font-mono text-xs">{e.clerkUserId || '-'}</td><td className="px-6 py-4">{e.plan?.name || '-'}</td><td className="px-6 py-4"><span className={`inline-block px-2 py-0.5 rounded text-xs ${e.active ? 'bg-green-900 text-green-300' : 'bg-slate-800 text-slate-400'}`}>{e.active ? 'Ativo' : 'Inativo'}</span></td><td className="px-6 py-4 text-right"><button onClick={() => { setEditing(e); setForm({ ...e, planId: e.planId || '' }); setShowForm(true); }} className="text-blue-400 mr-3">Editar</button><button onClick={() => del(e._id)} className="text-red-400">Excluir</button></td></tr>
          ))}</tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md border border-slate-800" onClick={ev => ev.stopPropagation()}>
            <h2 className="text-xl font-light mb-6">{editing ? 'Editar Expert' : 'Novo Expert'}</h2>
            <div className="space-y-4">
              <Field label="Nome" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} />
              <Field label="Email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} />
              <Field label="Clerk User ID" value={form.clerkUserId || ''} onChange={(v: string) => setForm({ ...form, clerkUserId: v })} />
              <div><label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Plano</label><select value={form.planId || ''} onChange={ev => setForm({ ...form, planId: ev.target.value })} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 focus:border-blue-500 outline-none"><option value="">- sem plano -</option>{plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={ev => setForm({ ...form, active: ev.target.checked })} />Ativo</label>
            </div>
            <div className="flex justify-end gap-2 mt-8">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800">Cancelar</button>
              <button onClick={save} className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: any) {
  return (<div><label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">{label}</label><input value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 focus:border-blue-500 outline-none" /></div>);
}
