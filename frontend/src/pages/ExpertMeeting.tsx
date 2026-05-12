import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser, SignInButton } from '@clerk/clerk-react';
import useAuthFetch from '@/hooks/useAuthFetch';
import ConfirmModal from '@/components/ConfirmModal';

type Fake = { _id: string; name: string; avatarColor: string; imageUrl?: string };
type Comment = { _id: string; fakeProfileId: string; text: string; delaySeconds: number; sent: boolean };
type LibItem = { _id: string; text: string; tag?: string };
type ModalState = { open: boolean; title: string; message?: React.ReactNode; variant?: 'info' | 'danger' | 'success'; confirmLabel?: string; cancelLabel?: string | null; onConfirm?: () => void };
type Mode = 'single' | 'multi' | 'distribute' | 'broadcast' | 'library';

export default function ExpertMeetingPanel() {
  const { meetingId } = useParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const authFetch = useAuthFetch();
  const [check, setCheck] = useState<any>(null);
  const [fakes, setFakes] = useState<Fake[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [library, setLibrary] = useState<LibItem[]>([]);
  const [newFakeName, setNewFakeName] = useState('');
  const [customCount, setCustomCount] = useState(20);
  const [selectedFakes, setSelectedFakes] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>('single');
  const [singleComment, setSingleComment] = useState({ fakeProfileId: '', text: '', delaySeconds: 10 });
  type Row = { fakeProfileId: string; text: string; delaySeconds: number };
  const [rows, setRows] = useState<Row[]>([]);
  const [distributeTexts, setDistributeTexts] = useState('');
  const [distributeDelayMin, setDistributeDelayMin] = useState(5);
  const [distributeDelayMax, setDistributeDelayMax] = useState(60);
  const [distributeShuffle, setDistributeShuffle] = useState(true);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastInterval, setBroadcastInterval] = useState(0);
  const [broadcastStart, setBroadcastStart] = useState(0);
  const [libDraft, setLibDraft] = useState('');
  const [libBulk, setLibBulk] = useState('');
  const [librySelected, setLibrySelected] = useState<Set<string>>(new Set());
  const [autoStarted, setAutoStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>({ open: false, title: '' });

  const showAlert = (title: string, message?: React.ReactNode, variant: ModalState['variant'] = 'info') => setModal({ open: true, title, message, variant, confirmLabel: 'OK', cancelLabel: null, onConfirm: () => setModal({ open: false, title: '' }) });
  const showConfirm = (title: string, message: React.ReactNode, onYes: () => void, variant: ModalState['variant'] = 'danger', confirmLabel = 'Excluir') => setModal({ open: true, title, message, variant, confirmLabel, cancelLabel: 'Cancelar', onConfirm: () => { setModal({ open: false, title: '' }); onYes(); } });
  const closeModal = () => setModal({ open: false, title: '' });

  const load = useCallback(async () => {
    const [c, f, cm, lib] = await Promise.all([
      authFetch('/api/expert/check').then(r => r.json()),
      authFetch(`/api/expert/fakes?meetingId=${meetingId}`).then(r => r.json()),
      authFetch(`/api/expert/comments?meetingId=${meetingId}`).then(r => r.json()),
      authFetch('/api/expert/library').then(r => r.ok ? r.json() : { items: [] }),
    ]);
    setCheck(c); setFakes(f.fakes || []); setComments(cm.comments || []); setLibrary(lib.items || []);
  }, [meetingId, authFetch]);

  useEffect(() => { if (isSignedIn) load(); }, [isSignedIn, load]);

  const plan = check?.plan;
  const fakeLimit = plan?.maxFakeParticipants ?? 999;
  const commentLimit = plan?.maxComments ?? 999;
  const fakeLimitReached = fakes.length >= fakeLimit;

  const addFake = async () => {
    const trimmed = newFakeName.trim(); if (!trimmed) return;
    if (fakes.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) { showAlert('Nome duplicado', `Ja existe "${trimmed}".`); return; }
    const res = await authFetch('/api/expert/fakes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, name: trimmed }) });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    setNewFakeName(''); load();
  };
  const addBulkFakes = async (count: number) => {
    if (count <= 0) return;
    const res = await authFetch('/api/expert/fakes/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, count }) });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    load();
  };
  const deleteSelected = () => { if (selectedFakes.size === 0) return; showConfirm(`Excluir ${selectedFakes.size} fake(s)?`, '', async () => { await authFetch(`/api/expert/fakes?ids=${Array.from(selectedFakes).join(',')}`, { method: 'DELETE' }); setSelectedFakes(new Set()); load(); }); };
  const deleteAllFakes = () => { if (fakes.length === 0) return; showConfirm(`Remover TODOS ${fakes.length} fake(s)?`, '', async () => { await authFetch(`/api/expert/fakes?all=true&meetingId=${meetingId}`, { method: 'DELETE' }); setSelectedFakes(new Set()); load(); }, 'danger', 'Remover todos'); };

  const addSingleComment = async () => {
    if (!singleComment.fakeProfileId || !singleComment.text.trim()) { showAlert('Preencha os campos'); return; }
    const res = await authFetch('/api/expert/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, ...singleComment }) });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    setSingleComment({ fakeProfileId: '', text: '', delaySeconds: 10 }); load();
  };
  const submitDistribute = async () => {
    const lines = distributeTexts.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length || !fakes.length) { showAlert('Preencha os campos'); return; }
    setBusy(true);
    try {
      const res = await authFetch('/api/expert/comments/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, texts: lines, delayMin: distributeDelayMin, delayMax: distributeDelayMax, shuffleFakes: distributeShuffle }) });
      const d = await res.json(); if (!res.ok) { showAlert('Erro', d.error, 'danger'); return; }
      showAlert('Distribuido', `${d.created} comentarios criados.`, 'success'); setDistributeTexts(''); load();
    } finally { setBusy(false); }
  };
  const submitBroadcast = async () => {
    if (!broadcastText.trim() || !fakes.length) { showAlert('Preencha os campos'); return; }
    setBusy(true);
    try {
      const res = await authFetch('/api/expert/comments/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meetingId, text: broadcastText.trim(), intervalSeconds: broadcastInterval, startDelaySeconds: broadcastStart }) });
      const d = await res.json(); if (!res.ok) { showAlert('Erro', d.error, 'danger'); return; }
      showAlert('Broadcast pronto', `${d.created} agendados.`, 'success'); setBroadcastText(''); load();
    } finally { setBusy(false); }
  };
  const sendNow = async (commentId: string) => { await authFetch('/api/expert/comments/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commentId }) }); load(); };
  const delComment = async (id: string) => { await authFetch(`/api/expert/comments?id=${id}`, { method: 'DELETE' }); load(); };
  const startAuto = () => {
    const pending = comments.filter(c => !c.sent); if (!pending.length) { showAlert('Nada para iniciar'); return; }
    setAutoStarted(true); pending.forEach(c => setTimeout(() => sendNow(c._id), Math.max(0, c.delaySeconds * 1000)));
    showAlert('Auto iniciado', `${pending.length} comentarios agendados.`, 'success');
  };
  const saveLibSingle = async () => { const t = libDraft.trim(); if (!t) return; const res = await authFetch('/api/expert/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) }); if (res.ok) { setLibDraft(''); load(); } };
  const saveLibBulk = async () => { const lines = libBulk.split('\n').map(s => s.trim()).filter(Boolean); if (!lines.length) return; const res = await authFetch('/api/expert/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts: lines }) }); if (res.ok) { setLibBulk(''); load(); } };

  if (!isLoaded) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;
  if (!isSignedIn) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><SignInButton><button className="bg-blue-600 px-6 py-3 rounded-lg">Entrar</button></SignInButton></div>;
  if (!check) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;
  if (!check.isExpert) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><p>Sem permissao. Clerk ID: <code className="text-blue-400">{user?.id}</code></p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div><Link to="/expert" className="text-blue-400 text-sm">← Voltar</Link><h1 className="text-3xl font-light mt-2">Reuniao <code className="text-blue-400">{meetingId}</code></h1>{plan && <p className="text-slate-400 text-sm mt-1">Plano {plan.name}: {fakes.length}/{plan.maxFakeParticipants} fakes - {comments.length}/{plan.maxComments} comentarios</p>}</div>
          <a href={`/${meetingId}`} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-lg text-sm">Abrir reuniao</a>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* FAKES PANEL */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-light">Participantes fake ({fakes.length}{plan ? `/${plan.maxFakeParticipants}` : ''})</h2>{selectedFakes.size > 0 && <button onClick={deleteSelected} className="text-xs bg-red-600 px-3 py-1.5 rounded">Excluir {selectedFakes.size}</button>}</div>
            <div className="flex gap-2 mb-3">
              <input data-testid="new-fake-name" value={newFakeName} onChange={e => setNewFakeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFake()} placeholder="Nome do fake" className="flex-1 rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none" />
              <button data-testid="add-fake-btn" onClick={addFake} disabled={fakeLimitReached} className="px-4 py-2.5 rounded-lg bg-blue-600 disabled:opacity-50 text-sm">Adicionar</button>
            </div>
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Preencher rapido</div>
              <div className="flex gap-2 flex-wrap mb-2">{[5,10,15,30,50].map(n => <button key={n} onClick={() => addBulkFakes(n)} disabled={fakeLimitReached} className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-sm flex-1 min-w-[60px]">+{n}</button>)}</div>
              <div className="flex gap-2">
                <input type="number" min={1} max={500} value={customCount} onChange={e => setCustomCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="w-24 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none text-sm" />
                <button onClick={() => addBulkFakes(customCount)} disabled={fakeLimitReached} className="flex-1 px-3 py-1.5 rounded-lg bg-blue-700 disabled:opacity-50 text-sm">+ Adicionar {customCount}</button>
                <button onClick={deleteAllFakes} disabled={fakes.length === 0} className="px-3 py-1.5 rounded-lg bg-red-900/50 border border-red-800 disabled:opacity-40 text-red-300 text-sm">Remover todos</button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-96 overflow-auto pr-1">
              {fakes.map(f => (
                <div key={f._id} className={`flex items-center gap-3 p-2.5 rounded-lg ${selectedFakes.has(f._id) ? 'bg-blue-950 border border-blue-700' : 'bg-slate-950'}`}>
                  <input type="checkbox" checked={selectedFakes.has(f._id)} onChange={() => setSelectedFakes(s => { const n = new Set(s); n.has(f._id) ? n.delete(f._id) : n.add(f._id); return n; })} className="accent-blue-500" />
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium" style={{ background: f.avatarColor }}>{f.name[0]?.toUpperCase()}</div>
                  <div className="flex-1 text-sm">{f.name}</div>
                </div>
              ))}
              {fakes.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhum fake</p>}
            </div>
          </div>
          {/* COMMENTS PANEL */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-light">Comentarios ({comments.length}{plan ? `/${plan.maxComments}` : ''})</h2><button onClick={startAuto} disabled={autoStarted || comments.filter(c=>!c.sent).length===0} className="text-xs bg-amber-600 px-3 py-1.5 rounded disabled:opacity-50">Iniciar auto</button></div>
            <div className="flex flex-wrap gap-1 mb-4 bg-slate-950 rounded-lg p-1 border border-slate-800">
              {[['single','Individual'],['multi','Em lote'],['distribute','Distribuir'],['broadcast','Broadcast'],['library',`Biblioteca (${library.length})`]].map(([m,label]: any) => <button key={m} onClick={() => setMode(m)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-xs font-medium ${mode===m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{label}</button>)}
            </div>
            {mode === 'single' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <select value={singleComment.fakeProfileId} onChange={e => setSingleComment({...singleComment, fakeProfileId: e.target.value})} className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none"><option value="">— escolher fake —</option>{fakes.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}</select>
                <textarea value={singleComment.text} onChange={e => setSingleComment({...singleComment, text: e.target.value})} placeholder="Texto" className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none min-h-[60px]" />
                <div className="flex items-center gap-2"><input type="number" min={0} value={singleComment.delaySeconds} onChange={e => setSingleComment({...singleComment, delaySeconds: Number(e.target.value)})} className="w-24 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none" /><span className="text-slate-400 text-sm">seg</span><button onClick={addSingleComment} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 text-sm">Adicionar</button></div>
              </div>
            )}
            {mode === 'distribute' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <textarea value={distributeTexts} onChange={e => setDistributeTexts(e.target.value)} placeholder="1 por linha..." className="w-full min-h-[120px] rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none font-mono text-sm" />
                <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">Delay</span><input type="number" min={0} value={distributeDelayMin} onChange={e => setDistributeDelayMin(Number(e.target.value))} className="w-20 rounded-lg bg-slate-950 px-2 py-1.5 border border-slate-800 outline-none" /><span>→</span><input type="number" min={0} value={distributeDelayMax} onChange={e => setDistributeDelayMax(Number(e.target.value))} className="w-20 rounded-lg bg-slate-950 px-2 py-1.5 border border-slate-800 outline-none" /><span className="text-slate-400">seg</span></div>
                <button onClick={submitDistribute} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-blue-600 disabled:opacity-50 text-sm">{busy ? 'Distribuindo...' : `Distribuir entre ${fakes.length} fake(s)`}</button>
              </div>
            )}
            {mode === 'broadcast' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)} placeholder="Mensagem" className="w-full min-h-[80px] rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1"><div className="text-xs text-slate-400">Inicio (seg)</div><input type="number" min={0} value={broadcastStart} onChange={e => setBroadcastStart(Number(e.target.value))} className="w-full rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none" /></label>
                  <label className="space-y-1"><div className="text-xs text-slate-400">Intervalo (seg)</div><input type="number" min={0} value={broadcastInterval} onChange={e => setBroadcastInterval(Number(e.target.value))} className="w-full rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none" /></label>
                </div>
                <button onClick={submitBroadcast} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-fuchsia-600 disabled:opacity-50 text-sm">{busy ? 'Agendando...' : `Broadcast para ${fakes.length} fake(s)`}</button>
              </div>
            )}
            {mode === 'library' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <div className="flex gap-2"><input value={libDraft} onChange={e => setLibDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveLibSingle()} placeholder="Nova mensagem" className="flex-1 rounded-lg bg-slate-950 px-4 py-2 border border-slate-800 outline-none text-sm" /><button onClick={saveLibSingle} className="px-3 py-2 rounded-lg bg-emerald-600 text-sm">Salvar</button></div>
                <div className="max-h-72 overflow-auto space-y-1 pr-1">{library.map(l => <div key={l._id} className="flex items-center gap-2 p-2 rounded text-sm bg-slate-950"><span className="flex-1 truncate">{l.text}</span></div>)}{library.length === 0 && <p className="text-slate-500 text-xs text-center py-4">Biblioteca vazia</p>}</div>
              </div>
            )}
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {comments.map(c => { const f = fakes.find(x => x._id === c.fakeProfileId); return (
                <div key={c._id} className="p-3 bg-slate-950 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">{f && <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs" style={{ background: f.avatarColor }}>{f.name[0]?.toUpperCase()}</div>}<span className="text-sm font-medium">{f?.name || '?'}</span><span className="text-xs text-slate-500">{c.delaySeconds}s</span>{c.sent && <span className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded">enviado</span>}</div>
                    <div className="flex gap-1">{!c.sent && <button onClick={() => sendNow(c._id)} className="text-xs bg-blue-700 px-2 py-1 rounded">Enviar agora</button>}<button onClick={() => delComment(c._id)} className="text-xs text-red-400 px-2">x</button></div>
                  </div>
                  <p className="text-sm text-slate-300 ml-8">{c.text}</p>
                </div>
              ); })}
              {comments.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhum comentario</p>}
            </div>
          </div>
        </div>
      </div>
      <ConfirmModal open={modal.open} title={modal.title} message={modal.message} variant={modal.variant} confirmLabel={modal.confirmLabel} cancelLabel={modal.cancelLabel} onConfirm={modal.onConfirm || closeModal} onCancel={closeModal} />
    </div>
  );
}
