import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  combineComparators,
  Comparator,
  hasScreenShare,
  ParticipantView,
  pinned,
  screenSharing,
  StreamVideoParticipant,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import ParticipantViewUI from './ParticipantViewUI';
import VideoPlaceholder from './VideoPlaceholder';
import FakeTile, { FakeParticipant } from './FakeTile';
import useMeetingFakes from '../hooks/useMeetingFakes';

type SideItem =
  | { kind: 'real'; participant: StreamVideoParticipant }
  | { kind: 'fake'; fake: FakeParticipant };

// Tela compartilhada:
//  - Esquerda 60%: o screen share.
//  - Direita 40% (rail):
//      • Se o host tiver câmera ligada: TOPO ocupando 40% da ALTURA do rail
//        com o card da câmera (largura total do rail).
//      • RESTANTE 60% da altura: sub-grid 2 colunas × N linhas com os demais.
//      • Página principal: 6 participantes (2×3). Demais páginas: 6 também,
//        sempre em grid perfeito 2 colunas — sem quebrar linhas.
const PAGE_SIZE = 6;
const GRID_COLS = 2;
const GRID_ROWS = 3;

const SpeakerLayout = () => {
  const call = useCall();
  const params = useParams();
  const meetingId = (params?.meetingId as string) || '';
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const fakes = useMeetingFakes(meetingId);
  const [page, setPage] = useState(0);
  const [railHidden, setRailHidden] = useState(false);

  const [participantInSpotlight, ...otherParticipants] = participants;
  const hostHasCamera = !!participantInSpotlight?.videoStream;
  const showHostCamRail =
    !!participantInSpotlight && hasScreenShare(participantInSpotlight) && hostHasCamera;

  const sideItems: SideItem[] = useMemo(() => {
    const real: SideItem[] = otherParticipants.map((p) => ({ kind: 'real', participant: p }));
    const fk: SideItem[] = fakes.map((f) => ({ kind: 'fake', fake: f }));
    return [...real, ...fk];
  }, [otherParticipants, fakes]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(sideItems.length / PAGE_SIZE)),
    [sideItems.length]
  );

  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);

  const pageSlice = useMemo(
    () => sideItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [page, sideItems]
  );

  useEffect(() => {
    if (!call) return;
    const customSortingPreset: Comparator<StreamVideoParticipant> = combineComparators(
      screenSharing,
      pinned
    );
    call.setSortParticipantsBy(customSortingPreset);
  }, [call]);

  return (
    <div
      className="custom-speaker-layout"
      style={{
        position: 'absolute',
        inset: 0,
        bottom: 80,
        display: 'flex',
        gap: 12,
        paddingBlock: 12,
        paddingInline: 'clamp(12px, 4%, 60px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* LEFT — screen share (60% normal, 100% quando rail oculto) */}
      <div
        className="screenshare-tile"
        style={{
          flex: railHidden ? '1 1 100%' : '0 0 60%',
          minWidth: 0,
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#202124',
          transition: 'flex-basis 200ms ease',
        }}
      >
        {call && participantInSpotlight && (
          <ParticipantView
            participant={participantInSpotlight}
            trackType={hasScreenShare(participantInSpotlight) ? 'screenShareTrack' : 'videoTrack'}
            ParticipantViewUI={ParticipantViewUI}
            VideoPlaceholder={VideoPlaceholder}
          />
        )}
        {/* Toggle ocultar/mostrar participantes */}
        <button
          data-testid="toggle-rail-btn"
          aria-label={railHidden ? 'Mostrar participantes' : 'Ocultar participantes'}
          title={railHidden ? 'Mostrar participantes' : 'Ocultar participantes'}
          onClick={() => setRailHidden((v) => !v)}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 6,
            backdropFilter: 'blur(6px)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.8)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.6)')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            {railHidden ? (
              <path d="M3 5h18v2H3V5zm0 6h12v2H3v-2zm0 6h18v2H3v-2zm15-7l4 3-4 3v-6z" />
            ) : (
              <path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2zm15-8l-4 3 4 3V9z" />
            )}
          </svg>
        </button>
      </div>

      {/* RIGHT 40% — rail (some quando ocultado) */}
      {!railHidden && (
      <div
        style={{
          flex: '1 1 40%',
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Host camera tile (40% da altura do rail, full width) */}
        {showHostCamRail && participantInSpotlight && (
          <div
            key={`${participantInSpotlight.sessionId}-host-cam`}
            style={{
              flex: '0 0 40%',
              borderRadius: 12,
              overflow: 'hidden',
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <ParticipantView
              participant={participantInSpotlight}
              trackType="videoTrack"
              ParticipantViewUI={ParticipantViewUI}
              VideoPlaceholder={VideoPlaceholder}
            />
          </div>
        )}

        {/* Bottom 60% — 2 cols × 3 rows grid de demais participantes */}
        <div
          style={{
            flex: '1 1 60%',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: 8,
          }}
        >
          {pageSlice.map((item) => (
            <div
              key={item.kind === 'real' ? item.participant.sessionId : item.fake._id}
              style={{ borderRadius: 12, overflow: 'hidden', minWidth: 0, minHeight: 0 }}
            >
              {item.kind === 'real' ? (
                <ParticipantView
                  participant={item.participant}
                  ParticipantViewUI={ParticipantViewUI}
                  VideoPlaceholder={VideoPlaceholder}
                />
              ) : (
                <FakeTile fake={item.fake} />
              )}
            </div>
          ))}
        </div>

        {/* Pagination arrows */}
        {pageCount > 1 && (
          <>
            <button
              data-testid="speaker-rail-prev"
              aria-label="Página anterior"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{
                position: 'absolute',
                left: -16,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                cursor: page === 0 ? 'default' : 'pointer',
                opacity: page === 0 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
              }}
            >
              ‹
            </button>
            <button
              data-testid="speaker-rail-next"
              aria-label="Próxima página"
              disabled={page === pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              style={{
                position: 'absolute',
                right: -16,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: 'none',
                cursor: page === pageCount - 1 ? 'default' : 'pointer',
                opacity: page === pageCount - 1 ? 0.3 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
              }}
            >
              ›
            </button>
          </>
        )}
      </div>
      )}
    </div>
  );
};

export default SpeakerLayout;
