'use client';
import { useEffect, useState } from 'react';

type Plan = {
  _id: string;
  name: string;
  maxFakeParticipants: number;
  maxComments: number;
  price: number;
  active: boolean;
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const empty: Plan = { _id: '', name: '', maxFakeParticipants: 5, maxComments: 10, price: 0, active: true };
  const [form, setForm] = useState<Plan>(empty);

  const load = async () => {
    const r = await fetch('/api/admin/plans');
    const d = await r.json();
    setPlans(d.plans || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const method = editing ? 'PUT' : 'POST';
    await fetch('/api/admin/plans', {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowForm(false); setEditing(null); setForm(empty);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Excluir esse plano?')) return;
    await fetch(`/api/admin/plans?id=${id}`, { method: 'DELETE' });
    load();
  };

  const startEdit = (p: Plan) => { setEditing(p); setForm(p); setShowForm(true); };

  return (
    <div data-testid="admin-plans-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light">Planos</h1>
          <p className="text-slate-400 text-sm mt-1">Defina os limites de fake participants e comentários</p>
        </div>
        <button
          data-testid="new-plan-btn"
          onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg text-sm font-medium"
        >
          + Novo Plano
        </button>
      </div>

      <div className="rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="text-left px-6 py-3">Nome</th>
              <th className="text-left px-6 py-3">Max Fakes</th>
              <th className="text-left px-6 py-3">Max Comentários</th>
              <th className="text-left px-6 py-3">Preço</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-slate-950">
            {plans.map(p => (
              <tr key={p._id} className="border-t border-slate-800" data-testid={`plan-row-${p.name}`}>
                <td className="px-6 py-4 font-medium">{p.name}</td>
                <td className="px-6 py-4">{p.maxFakeParticipants}</td>
                <td className="px-6 py-4">{p.maxComments}</td>
                <td className="px-6 py-4">R$ {p.price.toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${p.active ? 'bg-green-900 text-green-300' : 'bg-slate-800 text-slate-400'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => startEdit(p)} className="text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                  <button onClick={() => del(p._id)} className="text-red-400 hover:text-red-300">Excluir</button>
                </td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum plano cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 rounded-2xl p-8 w-full max-w-md border border-slate-800" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-light mb-6">{editing ? 'Editar Plano' : 'Novo Plano'}</h2>
            <div className="space-y-4">
              <Field label="Nome" value={form.name} onChange={v => setForm({ ...form, name: v })} testId="plan-name" />
              <Field label="Max Fake Participants" type="number" value={String(form.maxFakeParticipants)} onChange={v => setForm({ ...form, maxFakeParticipants: Number(v) })} testId="plan-max-fakes" />
              <Field label="Max Comentários" type="number" value={String(form.maxComments)} onChange={v => setForm({ ...form, maxComments: Number(v) })} testId="plan-max-comments" />
              <Field label="Preço (R$)" type="number" value={String(form.price)} onChange={v => setForm({ ...form, price: Number(v) })} testId="plan-price" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                Ativo
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-8">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800">Cancelar</button>
              <button data-testid="save-plan-btn" onClick={save} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testId }: any) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">{label}</label>
      <input
        data-testid={testId}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 focus:border-blue-500 outline-none"
      />
    </div>
  );
}
