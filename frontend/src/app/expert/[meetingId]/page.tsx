'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';

type Fake = { _id: string; name: string; avatarColor: string; imageUrl?: string };
type Comment = { _id: string; fakeProfileId: string; text: string; delaySeconds: number; sent: boolean };

export default function ExpertMeetingPanel() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { isLoaded, isSignedIn, user } = useUser();
  const [check, setCheck] = useState<any>(null);
  const [fakes, setFakes] = useState<Fake[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newFakeName, setNewFakeName] = useState('');
  const [newComment, setNewComment] = useState({ fakeProfileId: '', text: '', delaySeconds: 10 });
  const [autoStarted, setAutoStarted] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTexts, setBulkTexts] = useState('');
  const [bulkDelayMin, setBulkDelayMin] = useState(5);
  const [bulkDelayMax, setBulkDelayMax] = useState(60);
  const [bulkShuffle, setBulkShuffle] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, f, cm] = await Promise.all([
      fetch('/api/expert/check').then(r => r.json()),
      fetch(`/api/expert/fakes?meetingId=${meetingId}`).then(r => r.json()),
      fetch(`/api/expert/comments?meetingId=${meetingId}`).then(r => r.json()),
    ]);
    setCheck(c); setFakes(f.fakes || []); setComments(cm.comments || []);
  }, [meetingId]);

  useEffect(() => { if (isSignedIn) load(); }, [isSignedIn, load]);

  const addFake = async () => {
    if (!newFakeName.trim()) return;
    const res = await fetch('/api/expert/fakes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, name: newFakeName.trim() }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setNewFakeName(''); load();
  };

  const addBulkFakes = async (count: number) => {
    const res = await fetch('/api/expert/fakes/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, count }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    const d = await res.json();
    if (d.created < count) {
      alert(`Foram criados ${d.created} de ${count} (limite do plano atingido)`);
    }
    load();
  };

  const insertEmoji = (emoji: string) => {
    setNewComment(c => ({ ...c, text: c.text + emoji }));
  };

  const delFake = async (id: string) => {
    if (!confirm('Excluir esse fake e seus comentários?')) return;
    await fetch(`/api/expert/fakes?id=${id}`, { method: 'DELETE' });
    load();
  };

  const addComment = async () => {
    if (!newComment.fakeProfileId || !newComment.text.trim()) { alert('Selecione um fake e digite o texto'); return; }
    const res = await fetch('/api/expert/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, ...newComment }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error); return; }
    setNewComment({ fakeProfileId: '', text: '', delaySeconds: 10 });
    load();
  };

  const sendNow = async (commentId: string) => {
    await fetch('/api/expert/comments/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    load();
  };

  const delComment = async (id: string) => {
    await fetch(`/api/expert/comments?id=${id}`, { method: 'DELETE' });
    load();
  };

  const startAuto = () => {
    const pending = comments.filter(c => !c.sent);
    if (pending.length === 0) { alert('Nenhum comentário pendente'); return; }
    setAutoStarted(true);
    pending.forEach(c => {
      setTimeout(() => sendNow(c._id), Math.max(0, c.delaySeconds * 1000));
    });
    alert(`${pending.length} comentário(s) agendado(s). Mantenha esta aba aberta.`);
  };

  const submitBulk = async () => {
    const lines = bulkTexts.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) { alert('Cole pelo menos um comentário (1 por linha)'); return; }
    if (fakes.length === 0) { alert('Adicione participantes fake primeiro'); return; }
    if (bulkDelayMax < bulkDelayMin) { alert('Delay máximo deve ser >= mínimo'); return; }
    setBulkBusy(true);
    try {
      const res = await fetch('/api/expert/comments/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingId,
          texts: lines,
          delayMin: bulkDelayMin,
          delayMax: bulkDelayMax,
          shuffleFakes: bulkShuffle,
        }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'Erro'); return; }
      const msg = d.skipped > 0
        ? `${d.created} criados, ${d.skipped} ignorados (limite do plano).`
        : `${d.created} comentários distribuídos entre ${fakes.length} fakes.`;
      alert(msg);
      setBulkTexts('');
      setBulkOpen(false);
      load();
    } finally {
      setBulkBusy(false);
    }
  };

  if (!isLoaded) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center"><SignInButton><button className="bg-blue-600 px-6 py-3 rounded-lg">Entrar</button></SignInButton></div>
      </div>
    );
  }

  if (!check) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;
  if (!check.isExpert) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center">
        <p>Sem permissão. Clerk ID: <code className="text-blue-400">{user?.id}</code></p>
      </div>
    </div>
  );

  const plan = check.plan;
  const fakeLimitReached = plan && fakes.length >= plan.maxFakeParticipants;
  const commentLimitReached = plan && comments.length >= plan.maxComments;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/expert" className="text-blue-400 text-sm">← Voltar</Link>
            <h1 className="text-3xl font-light mt-2">Reunião <code className="text-blue-400">{meetingId}</code></h1>
            {plan && <p className="text-slate-400 text-sm mt-1">Plano {plan.name}: {fakes.length}/{plan.maxFakeParticipants} fakes · {comments.length}/{plan.maxComments} comentários</p>}
          </div>
          <a href={`/${meetingId}`} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-lg text-sm">Abrir reunião →</a>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Fakes */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-xl font-light mb-4">Participantes fake ({fakes.length}{plan ? `/${plan.maxFakeParticipants}` : ''})</h2>
            <div className="flex gap-2 mb-3">
              <input
                data-testid="new-fake-name"
                value={newFakeName}
                onChange={e => setNewFakeName(e.target.value)}
                placeholder="Nome do participante fake"
                className="flex-1 rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 focus:border-blue-500 outline-none"
              />
              <button data-testid="add-fake-btn" onClick={addFake} disabled={fakeLimitReached} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">Adicionar</button>
            </div>
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Preencher rápido (nomes aleatórios)</div>
              <div className="flex gap-2 flex-wrap">
                {[5, 10, 15, 30, 50].map(n => (
                  <button
                    key={n}
                    data-testid={`bulk-${n}`}
                    onClick={() => addBulkFakes(n)}
                    disabled={fakeLimitReached}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm flex-1 min-w-[60px]"
                  >
                    +{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {fakes.map(f => (
                <div key={f._id} className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg" data-testid={`fake-${f._id}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium" style={{ background: f.avatarColor }}>
                    {f.name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 text-sm">{f.name}</div>
                  <button onClick={() => delFake(f._id)} className="text-red-400 text-sm hover:text-red-300">Excluir</button>
                </div>
              ))}
              {fakes.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhum fake cadastrado</p>}
            </div>
          </div>

          {/* Comments */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-light">Comentários ({comments.length}{plan ? `/${plan.maxComments}` : ''})</h2>
              <div className="flex gap-2">
                <button
                  data-testid="bulk-comments-btn"
                  onClick={() => setBulkOpen(o => !o)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded"
                >
                  {bulkOpen ? '× Fechar massa' : '＋ Adicionar em massa'}
                </button>
                <button data-testid="start-auto-btn" onClick={startAuto} disabled={autoStarted || comments.filter(c=>!c.sent).length===0} className="text-xs bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50">▶ Iniciar auto</button>
              </div>
            </div>

            {bulkOpen && (
              <div className="mb-4 p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 space-y-3" data-testid="bulk-comments-panel">
                <div className="text-xs text-indigo-200">
                  Cole vários comentários (1 por linha). Eles serão distribuídos entre os <b>{fakes.length}</b> fakes desta reunião, com um delay aleatório dentro da faixa abaixo.
                </div>
                <textarea
                  data-testid="bulk-texts"
                  value={bulkTexts}
                  onChange={e => setBulkTexts(e.target.value)}
                  placeholder={'Concordo!\nMuito bom 🔥\nFaz sentido pra mim\n...'}
                  className="w-full min-h-[140px] rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-indigo-500 font-mono text-sm"
                />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Delay</span>
                    <input
                      data-testid="bulk-delay-min"
                      type="number" min={0}
                      value={bulkDelayMin}
                      onChange={e => setBulkDelayMin(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-500">→</span>
                    <input
                      data-testid="bulk-delay-max"
                      type="number" min={0}
                      value={bulkDelayMax}
                      onChange={e => setBulkDelayMax(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400">seg</span>
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                    <input
                      data-testid="bulk-shuffle"
                      type="checkbox"
                      checked={bulkShuffle}
                      onChange={e => setBulkShuffle(e.target.checked)}
                    />
                    Distribuir aleatoriamente
                  </label>
                  <button
                    data-testid="bulk-submit"
                    onClick={submitBulk}
                    disabled={bulkBusy}
                    className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {bulkBusy ? 'Adicionando…' : `Distribuir entre ${fakes.length} fake(s)`}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
              <select
                data-testid="comment-fake-select"
                value={newComment.fakeProfileId}
                onChange={e => setNewComment({ ...newComment, fakeProfileId: e.target.value })}
                className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500"
              >
                <option value="">— escolher fake —</option>
                {fakes.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
              <textarea
                data-testid="comment-text"
                value={newComment.text}
                onChange={e => setNewComment({ ...newComment, text: e.target.value })}
                placeholder="Texto do comentário"
                className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500 min-h-[60px]"
              />
              <div className="flex flex-wrap gap-1">
                {['👍','❤️','😂','😮','😍','🔥','👏','🎉','💯','🙌','✅','❓','🤔','😢','😡','🚀'].map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="w-9 h-9 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-lg leading-none flex items-center justify-center"
                    title={`Inserir ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  data-testid="comment-delay"
                  type="number"
                  min={0}
                  value={newComment.delaySeconds}
                  onChange={e => setNewComment({ ...newComment, delaySeconds: Number(e.target.value) })}
                  className="w-24 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500"
                />
                <span className="text-slate-400 text-sm">seg. de delay</span>
                <button data-testid="add-comment-btn" onClick={addComment} disabled={commentLimitReached} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">Adicionar</button>
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {comments.map(c => {
                const f = fakes.find(x => x._id === c.fakeProfileId);
                return (
                  <div key={c._id} className="p-3 bg-slate-950 rounded-lg" data-testid={`comment-${c._id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {f && <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: f.avatarColor }}>{f.name[0]?.toUpperCase()}</div>}
                        <span className="text-sm font-medium">{f?.name || '?'}</span>
                        <span className="text-xs text-slate-500">{c.delaySeconds}s</span>
                        {c.sent && <span className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded">enviado</span>}
                      </div>
                      <div className="flex gap-1">
                        {!c.sent && <button onClick={() => sendNow(c._id)} className="text-xs bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded">Enviar agora</button>}
                        <button onClick={() => delComment(c._id)} className="text-xs text-red-400 hover:text-red-300 px-2">×</button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 ml-8">{c.text}</p>
                  </div>
                );
              })}
              {comments.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhum comentário</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
