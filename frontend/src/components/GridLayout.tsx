import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  combineComparators,
  Comparator,
  ParticipantView,
  pinned,
  screenSharing,
  StreamVideoParticipant,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import clsx from 'clsx';

import ParticipantViewUI from './ParticipantViewUI';
import useAnimateVideoLayout from '../hooks/useAnimateVideoLayout';
import useIsMobile from '../hooks/useIsMobile';
import VideoPlaceholder from './VideoPlaceholder';
import FakeTile, { FakeParticipant } from './FakeTile';
import useMeetingFakes from '../hooks/useMeetingFakes';

// Modo normal (sem compartilhamento de tela):
//  - Total ≤ 4: grid simples 2×2 com host no quadrante superior esquerdo (25%).
//  - Total ≥ 5: grid macro 4×4 onde o host ocupa 2×2 = 25% do total.
//    Outros 12 participantes ocupam as 12 células restantes. O host fica
//    fixado em TODAS as páginas; a paginação só rotaciona os demais.
const FEATURED_THRESHOLD = 5;
const PAGE_OTHERS_FEATURED = 12; // outros participantes por página (host à parte)
const PAGE_NORMAL = 4;

type Item =
  | { kind: 'real'; participant: StreamVideoParticipant }
  | { kind: 'fake'; fake: FakeParticipant };

function calcSmallGrid(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  return { cols: 2, rows: 2 };
}

const GridLayout = () => {
  const call = useCall();
  const params = useParams();
  const meetingId = (params?.meetingId as string) || '';
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const fakes = useMeetingFakes(meetingId);
  const [page, setPage] = useState(0);
  const isMobile = useIsMobile();

  const { ref } = useAnimateVideoLayout(false);

  // Lista combinada de participantes reais + fakes
  const items: Item[] = useMemo(() => {
    const real: Item[] = participants.map((p) => ({ kind: 'real', participant: p }));
    const fk: Item[] = fakes.map((f) => ({ kind: 'fake', fake: f }));
    return [...real, ...fk];
  }, [participants, fakes]);

  // Identifica o host (criador da call) — sempre vai pro topo
  const creatorId = call?.state.createdBy?.id;
  const hostIdx = useMemo(
    () => (creatorId ? items.findIndex((it) => it.kind === 'real' && it.participant.userId === creatorId) : -1),
    [creatorId, items]
  );
  const hostItem = hostIdx >= 0 ? items[hostIdx] : null;
  const otherItems = useMemo(
    () => (hostItem ? items.filter((_, i) => i !== hostIdx) : items),
    [hostItem, items, hostIdx]
  );

  const isFeatured = items.length >= FEATURED_THRESHOLD && !!hostItem;

  // Cálculo da página atual
  const { displayItems, cols, rows, pageCount, mode } = useMemo(() => {
    // ── Mobile ─────────────────────────────────────────────────────
    if (isMobile) {
      if (hostItem) {
        // Host fixado no topo (largura total) + 2 cols abaixo, máx 6 por página.
        const PAGE_M = 6;
        const pageCnt = Math.max(1, Math.ceil(otherItems.length / PAGE_M));
        const start = page * PAGE_M;
        const slice = otherItems.slice(start, start + PAGE_M);
        const othersRows = Math.max(1, Math.ceil(slice.length / 2));
        return {
          displayItems: [hostItem, ...slice],
          cols: 2,
          rows: 1 + othersRows,
          pageCount: pageCnt,
          mode: 'mobile-featured' as const,
        };
      }
      // Sem host: grid simples 2 cols x N rows
      const PAGE_M = 8;
      const pageCnt = Math.max(1, Math.ceil(items.length / PAGE_M));
      const start = page * PAGE_M;
      const slice = items.slice(start, start + PAGE_M);
      return {
        displayItems: slice,
        cols: 2,
        rows: Math.max(1, Math.ceil(slice.length / 2)),
        pageCount: pageCnt,
        mode: 'mobile' as const,
      };
    }

    // ── Desktop ────────────────────────────────────────────────────
    if (isFeatured) {
      const pageCnt = Math.max(1, Math.ceil(otherItems.length / PAGE_OTHERS_FEATURED));
      const start = page * PAGE_OTHERS_FEATURED;
      const slice = otherItems.slice(start, start + PAGE_OTHERS_FEATURED);
      return {
        displayItems: [hostItem!, ...slice],
        cols: 4,
        rows: 4,
        pageCount: pageCnt,
        mode: 'desktop-featured' as const,
      };
    }
    // modo não-featured: host (se houver) no topo-esquerda; grid pequeno 2×2 max.
    const ordered = hostItem ? [hostItem, ...otherItems] : items;
    const pageCnt = Math.max(1, Math.ceil(ordered.length / PAGE_NORMAL));
    const start = page * PAGE_NORMAL;
    const slice = ordered.slice(start, start + PAGE_NORMAL);
    const g = calcSmallGrid(slice.length);
    return { displayItems: slice, cols: g.cols, rows: g.rows, pageCount: pageCnt, mode: 'desktop' as const };
  }, [isMobile, isFeatured, hostItem, otherItems, items, page]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  useEffect(() => {
    if (!call) return;
    const customSortingPreset: Comparator<StreamVideoParticipant> = combineComparators(screenSharing, pinned);
    call.setSortParticipantsBy(customSortingPreset);
  }, [call]);

  return (
    <div
      ref={ref}
      className={clsx('w-full relative overflow-hidden', 'str-video__paginated-grid-layout')}
      style={{ height: 'calc(100svh - 80px)' }}
    >
      {pageCount > 1 && (
        <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <button
            aria-label="Página anterior"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.3 : 1 }}
          >‹</button>
        </div>
      )}

      <div
        className={clsx('str-video__paginated-grid-layout__group fake-grid-adaptive')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 8,
          width: '100%',
          height: '100%',
          paddingBlock: 'clamp(8px, 1.5%, 16px)',
          paddingInline: 'clamp(12px, 4%, 60px)',
          boxSizing: 'border-box',
        }}
      >
        {call && displayItems.length > 0 && displayItems.map((item, idx) => {
          // Host fica em 2×2 no canto superior esquerdo (desktop featured).
          // No mobile featured, host ocupa toda a largura no topo (span 2 cols).
          let featuredStyle: React.CSSProperties | undefined;
          if (mode === 'desktop-featured' && idx === 0) {
            featuredStyle = { gridColumn: 'span 2', gridRow: 'span 2' };
          } else if (mode === 'mobile-featured' && idx === 0) {
            featuredStyle = { gridColumn: '1 / -1' };
          }
          const wrapStyle = { ...featuredStyle, borderRadius: 12, overflow: 'hidden', minWidth: 0, minHeight: 0 } as React.CSSProperties;
          return item.kind === 'real' ? (
            <div style={wrapStyle} key={item.participant.sessionId}>
              <ParticipantView
                participant={item.participant}
                ParticipantViewUI={ParticipantViewUI}
                VideoPlaceholder={VideoPlaceholder}
              />
            </div>
          ) : (
            <div style={wrapStyle} key={item.fake._id}>
              <FakeTile fake={item.fake} />
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <button
            aria-label="Próxima página"
            disabled={page === pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', cursor: page === pageCount - 1 ? 'default' : 'pointer', opacity: page === pageCount - 1 ? 0.3 : 1 }}
          >›</button>
        </div>
      )}
    </div>
  );
};

export default GridLayout;
