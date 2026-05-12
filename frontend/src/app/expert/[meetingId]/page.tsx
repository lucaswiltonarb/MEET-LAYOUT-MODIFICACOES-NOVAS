'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useUser, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';

type Fake = { _id: string; name: string; avatarColor: string; imageUrl?: string };
type Comment = { _id: string; fakeProfileId: string; text: string; delaySeconds: number; sent: boolean };
type LibItem = { _id: string; text: string; tag?: string };

type ModalState = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  variant?: 'info' | 'danger' | 'success';
  confirmLabel?: string;
  cancelLabel?: string | null;
  onConfirm?: () => void;
};

type Mode = 'single' | 'multi' | 'distribute' | 'broadcast' | 'library';

export default function ExpertMeetingPanel() {
  const params = useParams();
  const meetingId = params.meetingId as string;
  const { isLoaded, isSignedIn, user } = useUser();
  const [check, setCheck] = useState<any>(null);
  const [fakes, setFakes] = useState<Fake[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [library, setLibrary] = useState<LibItem[]>([]);

  // Fake controls
  const [newFakeName, setNewFakeName] = useState('');
  const [customCount, setCustomCount] = useState(20);
  const [selectedFakes, setSelectedFakes] = useState<Set<string>>(new Set());

  // Mode tabs
  const [mode, setMode] = useState<Mode>('single');

  // single
  const [singleComment, setSingleComment] = useState({ fakeProfileId: '', text: '', delaySeconds: 10 });

  // multi-row
  type Row = { fakeProfileId: string; text: string; delaySeconds: number };
  const [rows, setRows] = useState<Row[]>([]);

  // distribute (texts to be spread across fakes)
  const [distributeTexts, setDistributeTexts] = useState('');
  const [distributeDelayMin, setDistributeDelayMin] = useState(5);
  const [distributeDelayMax, setDistributeDelayMax] = useState(60);
  const [distributeShuffle, setDistributeShuffle] = useState(true);

  // broadcast (same message from every fake)
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastInterval, setBroadcastInterval] = useState(0);
  const [broadcastStart, setBroadcastStart] = useState(0);

  // library
  const [libDraft, setLibDraft] = useState('');
  const [libBulk, setLibBulk] = useState('');
  const [librySelected, setLibrySelected] = useState<Set<string>>(new Set());

  const [autoStarted, setAutoStarted] = useState(false);
  const [busy, setBusy] = useState(false);

  const [modal, setModal] = useState<ModalState>({ open: false, title: '' });
  const showAlert = (title: string, message?: React.ReactNode, variant: ModalState['variant'] = 'info') =>
    setModal({ open: true, title, message, variant, confirmLabel: 'OK', cancelLabel: null, onConfirm: () => setModal({ open: false, title: '' }) });
  const showConfirm = (title: string, message: React.ReactNode, onYes: () => void, variant: ModalState['variant'] = 'danger', confirmLabel = 'Excluir') =>
    setModal({
      open: true, title, message, variant, confirmLabel, cancelLabel: 'Cancelar',
      onConfirm: () => { setModal({ open: false, title: '' }); onYes(); },
    });
  const closeModal = () => setModal({ open: false, title: '' });

  const load = useCallback(async () => {
    const [c, f, cm, lib] = await Promise.all([
      fetch('/api/expert/check').then(r => r.json()),
      fetch(`/api/expert/fakes?meetingId=${meetingId}`).then(r => r.json()),
      fetch(`/api/expert/comments?meetingId=${meetingId}`).then(r => r.json()),
      fetch('/api/expert/library').then(r => r.ok ? r.json() : { items: [] }),
    ]);
    setCheck(c); setFakes(f.fakes || []); setComments(cm.comments || []); setLibrary(lib.items || []);
  }, [meetingId]);

  useEffect(() => { if (isSignedIn) load(); }, [isSignedIn, load]);

  const plan = check?.plan;
  const fakeLimit = plan?.maxFakeParticipants ?? 999;
  const commentLimit = plan?.maxComments ?? 999;
  const fakeLimitReached = fakes.length >= fakeLimit;
  const commentLimitReached = comments.length >= commentLimit;

  // ---------- Fakes ----------
  const addFake = async () => {
    const trimmed = newFakeName.trim();
    if (!trimmed) return;
    if (fakes.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      showAlert('Nome duplicado', `Já existe um fake chamado "${trimmed}".`, 'info');
      return;
    }
    const res = await fetch('/api/expert/fakes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, name: trimmed }),
    });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    setNewFakeName(''); load();
  };

  const addBulkFakes = async (count: number) => {
    if (count <= 0) return;
    const res = await fetch('/api/expert/fakes/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, count }),
    });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    const d = await res.json();
    if (d.created < count) showAlert('Adicionado parcialmente', `${d.created} de ${count} criados (limite do plano).`);
    load();
  };

  const deleteSelected = () => {
    if (selectedFakes.size === 0) return;
    showConfirm(
      `Excluir ${selectedFakes.size} fake(s)?`,
      'Os comentários desses participantes também serão excluídos.',
      async () => {
        const ids = Array.from(selectedFakes).join(',');
        await fetch(`/api/expert/fakes?ids=${ids}`, { method: 'DELETE' });
        setSelectedFakes(new Set());
        load();
      },
    );
  };

  const deleteAllFakes = () => {
    if (fakes.length === 0) return;
    showConfirm(
      `Remover TODOS os ${fakes.length} fake(s)?`,
      'Esta ação não pode ser desfeita. Todos os comentários também serão excluídos.',
      async () => {
        await fetch(`/api/expert/fakes?all=true&meetingId=${meetingId}`, { method: 'DELETE' });
        setSelectedFakes(new Set());
        load();
      },
      'danger',
      'Remover todos',
    );
  };

  const delFake = (id: string, name: string) => {
    showConfirm(
      'Excluir fake?',
      <>Tem certeza que deseja excluir <b className="text-white">{name}</b>?</>,
      async () => {
        await fetch(`/api/expert/fakes?id=${id}`, { method: 'DELETE' });
        load();
      },
    );
  };

  const toggleSelected = (id: string) => {
    setSelectedFakes(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    if (selectedFakes.size === fakes.length) setSelectedFakes(new Set());
    else setSelectedFakes(new Set(fakes.map(f => f._id)));
  };

  // ---------- Single comment ----------
  const insertEmoji = (emoji: string) => setSingleComment(c => ({ ...c, text: c.text + emoji }));
  const addSingleComment = async () => {
    if (!singleComment.fakeProfileId || !singleComment.text.trim()) {
      showAlert('Campos obrigatórios', 'Selecione um fake e digite o texto.'); return;
    }
    const res = await fetch('/api/expert/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, ...singleComment }),
    });
    if (!res.ok) { const d = await res.json(); showAlert('Erro', d.error, 'danger'); return; }
    setSingleComment({ fakeProfileId: '', text: '', delaySeconds: 10 });
    load();
  };

  // ---------- Multi-row ----------
  const addRows = (n: number) => {
    setRows(rs => [...rs, ...Array.from({ length: n }, () => ({ fakeProfileId: '', text: '', delaySeconds: 0 }))]);
  };
  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));
  const clearRows = () => setRows([]);

  const fillFromLibrary = () => {
    const filled = library.slice(0, rows.length);
    setRows(rs => rs.map((r, i) => filled[i] ? { ...r, text: filled[i].text } : r));
  };
  const randomAssignFakes = () => {
    if (fakes.length === 0) return;
    setRows(rs => rs.map(r => ({ ...r, fakeProfileId: fakes[Math.floor(Math.random() * fakes.length)]._id })));
  };

  const submitMulti = async () => {
    const valid = rows.filter(r => r.fakeProfileId && r.text.trim());
    if (valid.length === 0) { showAlert('Nada para enviar', 'Preencha pelo menos uma linha com fake e texto.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/expert/comments/multi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, items: valid }),
      });
      const d = await res.json();
      if (!res.ok) { showAlert('Erro', d.error, 'danger'); return; }
      showAlert('Comentários criados', `${d.created} adicionados${d.skipped > 0 ? `, ${d.skipped} ignorados` : ''}.`, 'success');
      setRows([]); load();
    } finally { setBusy(false); }
  };

  // ---------- Distribute (bulk) ----------
  const submitDistribute = async () => {
    const lines = distributeTexts.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) { showAlert('Sem conteúdo', 'Cole pelo menos um comentário (1 por linha).'); return; }
    if (fakes.length === 0) { showAlert('Sem fakes', 'Adicione participantes fake primeiro.'); return; }
    if (distributeDelayMax < distributeDelayMin) { showAlert('Faixa inválida', 'Delay máximo deve ser >= mínimo.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/expert/comments/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, texts: lines, delayMin: distributeDelayMin, delayMax: distributeDelayMax, shuffleFakes: distributeShuffle }),
      });
      const d = await res.json();
      if (!res.ok) { showAlert('Erro', d.error, 'danger'); return; }
      showAlert('Distribuído', d.skipped > 0 ? `${d.created} criados, ${d.skipped} ignorados.` : `${d.created} comentários distribuídos.`, 'success');
      setDistributeTexts(''); load();
    } finally { setBusy(false); }
  };

  const importLibraryToDistribute = () => {
    if (library.length === 0) { showAlert('Biblioteca vazia', 'Salve mensagens na biblioteca primeiro.'); return; }
    setDistributeTexts(library.map(l => l.text).join('\n'));
  };

  // ---------- Broadcast ----------
  const submitBroadcast = async () => {
    if (!broadcastText.trim()) { showAlert('Sem mensagem', 'Digite a mensagem que todos os fakes irão enviar.'); return; }
    if (fakes.length === 0) { showAlert('Sem fakes', 'Adicione participantes fake primeiro.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/expert/comments/broadcast', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, text: broadcastText.trim(), intervalSeconds: broadcastInterval, startDelaySeconds: broadcastStart }),
      });
      const d = await res.json();
      if (!res.ok) { showAlert('Erro', d.error, 'danger'); return; }
      showAlert('Broadcast pronto', `${d.created} fakes irão enviar a mesma mensagem${broadcastInterval > 0 ? ` (intervalo de ${broadcastInterval}s)` : ' (sem delay)'}.`, 'success');
      setBroadcastText(''); load();
    } finally { setBusy(false); }
  };

  // ---------- Library ----------
  const saveLibSingle = async () => {
    const t = libDraft.trim();
    if (!t) return;
    const res = await fetch('/api/expert/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t }),
    });
    if (res.ok) { setLibDraft(''); load(); }
  };
  const saveLibBulk = async () => {
    const lines = libBulk.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const res = await fetch('/api/expert/library', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: lines }),
    });
    if (res.ok) { setLibBulk(''); load(); }
  };
  const toggleLibSelected = (id: string) => {
    setLibrySelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const deleteLibSelected = () => {
    if (librySelected.size === 0) return;
    showConfirm(`Excluir ${librySelected.size} item(s) da biblioteca?`, '', async () => {
      const ids = Array.from(librySelected).join(',');
      await fetch(`/api/expert/library?ids=${ids}`, { method: 'DELETE' });
      setLibrySelected(new Set()); load();
    });
  };

  // ---------- Comment actions ----------
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
    if (pending.length === 0) { showAlert('Nada para iniciar', 'Nenhum comentário pendente.'); return; }
    setAutoStarted(true);
    pending.forEach(c => setTimeout(() => sendNow(c._id), Math.max(0, c.delaySeconds * 1000)));
    showAlert('Auto iniciado', `${pending.length} comentário(s) agendado(s). Mantenha esta aba aberta.`, 'success');
  };

  // ---------- Render guards ----------
  if (!isLoaded) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</div>;
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <SignInButton><button className="bg-blue-600 px-6 py-3 rounded-lg">Entrar</button></SignInButton>
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

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/expert" className="text-blue-400 text-sm">← Voltar</Link>
            <h1 className="text-3xl font-light mt-2">Reunião <code className="text-blue-400">{meetingId}</code></h1>
            {plan && <p className="text-slate-400 text-sm mt-1">Plano {plan.name}: {fakes.length}/{plan.maxFakeParticipants} fakes · {comments.length}/{plan.maxComments} comentários</p>}
          </div>
          <a href={`/${meetingId}`} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 px-5 py-2.5 rounded-lg text-sm">Abrir reunião →</a>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ============== FAKES PANEL ============== */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-light">Participantes fake ({fakes.length}{plan ? `/${plan.maxFakeParticipants}` : ''})</h2>
              {selectedFakes.size > 0 && (
                <button onClick={deleteSelected} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded">
                  Excluir {selectedFakes.size} selecionado(s)
                </button>
              )}
            </div>

            {/* Add single */}
            <div className="flex gap-2 mb-3">
              <input
                data-testid="new-fake-name"
                value={newFakeName}
                onChange={e => setNewFakeName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFake()}
                placeholder="Nome do fake"
                className="flex-1 rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 focus:border-blue-500 outline-none"
              />
              <button data-testid="add-fake-btn" onClick={addFake} disabled={fakeLimitReached} className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">Adicionar</button>
            </div>

            {/* Quick fill */}
            <div className="mb-3">
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Preencher rápido (nomes aleatórios)</div>
              <div className="flex gap-2 flex-wrap mb-2">
                {[5, 10, 15, 30, 50].map(n => (
                  <button key={n} data-testid={`bulk-${n}`} onClick={() => addBulkFakes(n)} disabled={fakeLimitReached}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sm flex-1 min-w-[60px]">+{n}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number" min={1} max={500}
                  value={customCount}
                  onChange={e => setCustomCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                  className="w-24 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500 text-sm"
                  data-testid="custom-count-input"
                />
                <button
                  onClick={() => addBulkFakes(customCount)}
                  disabled={fakeLimitReached}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                  data-testid="custom-count-add"
                >
                  + Adicionar {customCount} fake(s)
                </button>
                <button
                  onClick={deleteAllFakes}
                  disabled={fakes.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800 border border-red-800 disabled:opacity-40 text-red-300 text-sm"
                  data-testid="remove-all-fakes"
                  title="Remover todos os fakes desta reunião"
                >
                  Remover todos
                </button>
              </div>
            </div>

            {/* List with checkboxes */}
            {fakes.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-1 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={selectedFakes.size === fakes.length && fakes.length > 0}
                  onChange={toggleSelectAll}
                  className="accent-blue-500"
                  data-testid="select-all-fakes"
                />
                Selecionar todos
              </div>
            )}
            <div className="space-y-1.5 max-h-96 overflow-auto pr-1">
              {fakes.map(f => (
                <div key={f._id} className={`flex items-center gap-3 p-2.5 rounded-lg ${selectedFakes.has(f._id) ? 'bg-blue-950 border border-blue-700' : 'bg-slate-950'}`} data-testid={`fake-${f._id}`}>
                  <input
                    type="checkbox"
                    checked={selectedFakes.has(f._id)}
                    onChange={() => toggleSelected(f._id)}
                    className="accent-blue-500"
                  />
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium" style={{ background: f.avatarColor }}>{f.name[0]?.toUpperCase()}</div>
                  <div className="flex-1 text-sm">{f.name}</div>
                  <button onClick={() => delFake(f._id, f.name)} className="text-red-400 text-xs hover:text-red-300 px-2">×</button>
                </div>
              ))}
              {fakes.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Nenhum fake cadastrado</p>}
            </div>
          </div>

          {/* ============== COMMENTS PANEL ============== */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-light">Comentários ({comments.length}{plan ? `/${plan.maxComments}` : ''})</h2>
              <button data-testid="start-auto-btn" onClick={startAuto} disabled={autoStarted || comments.filter(c=>!c.sent).length===0} className="text-xs bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded disabled:opacity-50">▶ Iniciar auto</button>
            </div>

            {/* Mode tabs */}
            <div className="flex flex-wrap gap-1 mb-4 bg-slate-950 rounded-lg p-1 border border-slate-800">
              {([
                ['single', 'Individual'],
                ['multi', 'Em lote'],
                ['distribute', 'Distribuir'],
                ['broadcast', 'Broadcast'],
                ['library', `Biblioteca (${library.length})`],
              ] as [Mode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 min-w-[80px] px-3 py-2 rounded-md text-xs font-medium transition ${mode === m ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  data-testid={`mode-${m}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ---- SINGLE mode ---- */}
            {mode === 'single' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <select value={singleComment.fakeProfileId} onChange={e => setSingleComment({ ...singleComment, fakeProfileId: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500">
                  <option value="">— escolher fake —</option>
                  {fakes.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
                <textarea value={singleComment.text} onChange={e => setSingleComment({ ...singleComment, text: e.target.value })}
                  placeholder="Texto do comentário"
                  className="w-full rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500 min-h-[60px]" />
                {library.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1">Da biblioteca (clique para usar):</div>
                    <div className="flex gap-1 flex-wrap max-h-24 overflow-auto">
                      {library.slice(0, 12).map(l => (
                        <button key={l._id} onClick={() => setSingleComment(c => ({ ...c, text: l.text }))}
                          className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded max-w-[200px] truncate">{l.text}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {['👍','❤️','😂','😮','😍','🔥','👏','🎉','💯','🙌','✅','❓','🤔','😢','😡','🚀'].map(e => (
                    <button key={e} type="button" onClick={() => insertEmoji(e)}
                      className="w-9 h-9 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-lg leading-none flex items-center justify-center">{e}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={singleComment.delaySeconds} onChange={e => setSingleComment({ ...singleComment, delaySeconds: Number(e.target.value) })}
                    className="w-24 rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500" />
                  <span className="text-slate-400 text-sm">seg. de delay</span>
                  <button onClick={addSingleComment} disabled={commentLimitReached} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">Adicionar</button>
                </div>
              </div>
            )}

            {/* ---- MULTI ROW mode ---- */}
            {mode === 'multi' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-slate-400 self-center mr-2">Adicionar linhas:</span>
                  {[1, 5, 10, 20, 50].map(n => (
                    <button key={n} onClick={() => addRows(n)} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">+{n}</button>
                  ))}
                  {rows.length > 0 && (
                    <>
                      <button onClick={randomAssignFakes} className="px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-xs">🎲 Sortear fakes</button>
                      {library.length > 0 && <button onClick={fillFromLibrary} className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs">📚 Preencher da biblioteca</button>}
                      <button onClick={clearRows} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs">Limpar</button>
                    </>
                  )}
                </div>
                <div className="max-h-96 overflow-auto space-y-2 pr-1">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_70px_28px] gap-2 items-center">
                      <select value={r.fakeProfileId} onChange={e => updateRow(i, { fakeProfileId: e.target.value })}
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500">
                        <option value="">— fake —</option>
                        {fakes.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                      </select>
                      <input value={r.text} onChange={e => updateRow(i, { text: e.target.value })}
                        placeholder="Comentário"
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                      <input type="number" min={0} value={r.delaySeconds} onChange={e => updateRow(i, { delaySeconds: Number(e.target.value) || 0 })}
                        title="Delay (opcional)"
                        className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                      <button onClick={() => removeRow(i)} className="text-red-400 hover:text-red-300 text-sm">×</button>
                    </div>
                  ))}
                  {rows.length === 0 && <p className="text-slate-500 text-xs text-center py-2">Clique em "+5" ou "+10" para adicionar linhas</p>}
                </div>
                {rows.length > 0 && (
                  <button onClick={submitMulti} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                    {busy ? 'Salvando…' : `Criar ${rows.filter(r => r.fakeProfileId && r.text.trim()).length} comentário(s)`}
                  </button>
                )}
              </div>
            )}

            {/* ---- DISTRIBUTE mode ---- */}
            {mode === 'distribute' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <div className="text-xs text-slate-300">Cole 1 comentário por linha. Serão distribuídos entre os <b>{fakes.length}</b> fakes desta reunião com delay aleatório dentro da faixa.</div>
                <textarea value={distributeTexts} onChange={e => setDistributeTexts(e.target.value)}
                  placeholder={'Concordo!\nMuito bom 🔥\nFaz sentido pra mim'}
                  className="w-full min-h-[120px] rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500 font-mono text-sm" />
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-slate-400">Delay</span>
                  <input type="number" min={0} value={distributeDelayMin} onChange={e => setDistributeDelayMin(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-lg bg-slate-950 px-2 py-1.5 border border-slate-800 outline-none focus:border-blue-500" />
                  <span className="text-slate-500">→</span>
                  <input type="number" min={0} value={distributeDelayMax} onChange={e => setDistributeDelayMax(Math.max(0, Number(e.target.value) || 0))}
                    className="w-20 rounded-lg bg-slate-950 px-2 py-1.5 border border-slate-800 outline-none focus:border-blue-500" />
                  <span className="text-slate-400">seg</span>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={distributeShuffle} onChange={e => setDistributeShuffle(e.target.checked)} className="accent-blue-500" />
                    Aleatório
                  </label>
                </div>
                <div className="flex gap-2">
                  {library.length > 0 && (
                    <button onClick={importLibraryToDistribute} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm">📚 Importar da biblioteca</button>
                  )}
                  <button onClick={submitDistribute} disabled={busy} className="ml-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                    {busy ? 'Distribuindo…' : `Distribuir entre ${fakes.length} fake(s)`}
                  </button>
                </div>
              </div>
            )}

            {/* ---- BROADCAST mode ---- */}
            {mode === 'broadcast' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <div className="text-xs text-slate-300">Todos os <b>{fakes.length}</b> fakes vão enviar <b>a mesma mensagem</b>.</div>
                <textarea value={broadcastText} onChange={e => setBroadcastText(e.target.value)}
                  placeholder="Mensagem que cada fake enviará"
                  className="w-full min-h-[80px] rounded-lg bg-slate-950 px-4 py-2.5 border border-slate-800 outline-none focus:border-blue-500" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">Início (seg)</div>
                    <input type="number" min={0} value={broadcastStart} onChange={e => setBroadcastStart(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500" />
                  </label>
                  <label className="space-y-1">
                    <div className="text-xs text-slate-400">Intervalo entre fakes (seg, 0 = simultâneo)</div>
                    <input type="number" min={0} value={broadcastInterval} onChange={e => setBroadcastInterval(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg bg-slate-950 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500" />
                  </label>
                </div>
                <button onClick={submitBroadcast} disabled={busy} className="w-full px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-sm font-medium">
                  {busy ? 'Agendando…' : `📣 Broadcast para ${fakes.length} fake(s)`}
                </button>
              </div>
            )}

            {/* ---- LIBRARY mode ---- */}
            {mode === 'library' && (
              <div className="space-y-3 mb-4 pb-4 border-b border-slate-800">
                <div className="flex gap-2">
                  <input value={libDraft} onChange={e => setLibDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveLibSingle()}
                    placeholder="Nova mensagem para salvar"
                    className="flex-1 rounded-lg bg-slate-950 px-4 py-2 border border-slate-800 outline-none focus:border-blue-500 text-sm" />
                  <button onClick={saveLibSingle} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm">Salvar</button>
                </div>
                <details className="bg-slate-950 rounded-lg p-2">
                  <summary className="cursor-pointer text-xs text-slate-300">📥 Importar várias (1 por linha)</summary>
                  <textarea value={libBulk} onChange={e => setLibBulk(e.target.value)}
                    placeholder={'Mensagem 1\nMensagem 2\n...'}
                    className="w-full mt-2 min-h-[80px] rounded bg-slate-900 px-3 py-2 border border-slate-800 outline-none focus:border-blue-500 text-sm" />
                  <button onClick={saveLibBulk} disabled={!libBulk.trim()} className="mt-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs">Adicionar à biblioteca</button>
                </details>
                {librySelected.size > 0 && (
                  <button onClick={deleteLibSelected} className="text-xs text-red-300 hover:text-red-200">Excluir {librySelected.size} selecionado(s)</button>
                )}
                <div className="max-h-72 overflow-auto space-y-1 pr-1">
                  {library.map(l => (
                    <div key={l._id} className={`flex items-center gap-2 p-2 rounded text-sm ${librySelected.has(l._id) ? 'bg-blue-950 border border-blue-700' : 'bg-slate-950'}`}>
                      <input type="checkbox" checked={librySelected.has(l._id)} onChange={() => toggleLibSelected(l._id)} className="accent-blue-500" />
                      <span className="flex-1 truncate" title={l.text}>{l.text}</span>
                    </div>
                  ))}
                  {library.length === 0 && <p className="text-slate-500 text-xs text-center py-4">Biblioteca vazia</p>}
                </div>
              </div>
            )}

            {/* Comments list */}
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {comments.map(c => {
                const f = fakes.find(x => x._id === c.fakeProfileId);
                return (
                  <div key={c._id} className="p-3 bg-slate-950 rounded-lg">
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
      <ConfirmModal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        variant={modal.variant}
        confirmLabel={modal.confirmLabel}
        cancelLabel={modal.cancelLabel}
        onConfirm={modal.onConfirm || closeModal}
        onCancel={closeModal}
      />
    </div>
  );
}
