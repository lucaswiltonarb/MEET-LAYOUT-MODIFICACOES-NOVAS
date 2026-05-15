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

const PAGE_FIRST_WITH_HOSTCAM = 6;   // 3 linhas × 2 colunas abaixo do host cam
const PAGE_FIRST_NO_HOSTCAM = 8;     // 4 linhas × 2 colunas
const PAGE_REST = 8;                 // demais páginas

const SpeakerLayout = () => {
  const call = useCall();
  const params = useParams();
  const meetingId = (params?.meetingId as string) || '';
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const fakes = useMeetingFakes(meetingId);
  const [page, setPage] = useState(0);

  const [participantInSpotlight, ...otherParticipants] = participants;
  const hostHasCamera = !!participantInSpotlight?.videoStream;
  const showHostCamRail = !!participantInSpotlight && hasScreenShare(participantInSpotlight) && hostHasCamera;

  const sideItems: SideItem[] = useMemo(() => {
    const real: SideItem[] = otherParticipants.map((p) => ({ kind: 'real', participant: p }));
    const fk: SideItem[] = fakes.map((f) => ({ kind: 'fake', fake: f }));
    return [...real, ...fk];
  }, [otherParticipants, fakes]);

  const firstPageSize = showHostCamRail ? PAGE_FIRST_WITH_HOSTCAM : PAGE_FIRST_NO_HOSTCAM;

  const pageCount = useMemo(() => {
    if (sideItems.length === 0) return 1;
    if (sideItems.length <= firstPageSize) return 1;
    return 1 + Math.ceil((sideItems.length - firstPageSize) / PAGE_REST);
  }, [sideItems.length, firstPageSize]);

  useEffect(() => { if (page >= pageCount) setPage(pageCount - 1); }, [page, pageCount]);

  const pageSlice = useMemo(() => {
    if (page === 0) return sideItems.slice(0, firstPageSize);
    const start = firstPageSize + (page - 1) * PAGE_REST;
    return sideItems.slice(start, start + PAGE_REST);
  }, [page, sideItems, firstPageSize]);

  const isFirstPage = page === 0;
  const rowsCount = isFirstPage && showHostCamRail ? 4 : 4; // 1 row host + 3 rows; ou 4 rows sem host
  const gridRowsCss = `repeat(${rowsCount}, 1fr)`;

  useEffect(() => {
    if (!call) return;
    const customSortingPreset: Comparator<StreamVideoParticipant> = combineComparators(screenSharing, pinned);
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
        paddingInline: 'clamp(12px, 10%, 240px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* LEFT 60% — screen share */}
      <div
        className="custom-speaker-layout__screen"
        style={{
          flex: '0 0 60%',
          minWidth: 0,
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#202124',
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
      </div>

      {/* RIGHT 40% — column with host cam (if any) + 2-col grid */}
      <div
        className="custom-speaker-layout__rail"
        style={{
          flex: '1 1 40%',
          minWidth: 0,
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: gridRowsCss,
          gap: 8,
        }}
      >
        {/* host camera tile (spans full width of right column, only on page 0 with host cam) */}
        {isFirstPage && showHostCamRail && participantInSpotlight && (
          <div
            key={`${participantInSpotlight.sessionId}-host-cam`}
            style={{
              gridColumn: '1 / -1',
              gridRow: '1',
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

        {/* pagination arrows */}
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
    </div>
  );
};

export default SpeakerLayout;
