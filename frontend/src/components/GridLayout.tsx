import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  combineComparators,
  Comparator,
  IconButton,
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
import VideoPlaceholder from './VideoPlaceholder';
import FakeTile, { FakeParticipant } from './FakeTile';
import useMeetingFakes from '../hooks/useMeetingFakes';

const MAX_PER_PAGE = 28; // 7 x 4

// Returns the optimal grid dimensions for a given participant count,
// capped at 7 columns x 4 rows so the layout fills the screen nicely.
function calcGrid(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  if (n <= 16) return { cols: 4, rows: 4 };
  if (n <= 20) return { cols: 5, rows: 4 };
  if (n <= 24) return { cols: 6, rows: 4 };
  return { cols: 7, rows: 4 };
}

type Item =
  | { kind: 'real'; participant: StreamVideoParticipant }
  | { kind: 'fake'; fake: FakeParticipant };

const GridLayout = () => {
  const call = useCall();
  const params = useParams();
  const meetingId = (params?.meetingId as string) || '';
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const fakes = useMeetingFakes(meetingId);
  const [page, setPage] = useState(0);

  const { ref } = useAnimateVideoLayout(false);

  // Combine real + fake participants into a single ordered list
  const items: Item[] = useMemo(() => {
    const real: Item[] = participants.map((p) => ({ kind: 'real', participant: p }));
    const fk: Item[] = fakes.map((f) => ({ kind: 'fake', fake: f }));
    return [...real, ...fk];
  }, [participants, fakes]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(items.length / MAX_PER_PAGE)), [items]);

  const itemGroups = useMemo(() => {
    const groups: Item[][] = [];
    for (let i = 0; i < items.length; i += MAX_PER_PAGE) {
      groups.push(items.slice(i, i + MAX_PER_PAGE));
    }
    if (groups.length === 0) groups.push([]);
    return groups;
  }, [items]);

  const selectedGroup = itemGroups[page] || [];
  const { cols, rows } = useMemo(() => calcGrid(selectedGroup.length || 1), [selectedGroup.length]);

  useEffect(() => {
    if (!call) return;
    const customSortingPreset = getCustomSortingPreset();
    call.setSortParticipantsBy(customSortingPreset);
  }, [call]);

  useEffect(() => {
    if (page > pageCount - 1) {
      setPage(Math.max(0, pageCount - 1));
    }
  }, [page, pageCount]);

  const getCustomSortingPreset = (): Comparator<StreamVideoParticipant> => {
    return combineComparators(screenSharing, pinned);
  };

  return (
    <div
      ref={ref}
      className={clsx('w-full relative overflow-hidden', 'str-video__paginated-grid-layout')}
      style={{ height: 'calc(100svh - 80px)' }}
    >
      {pageCount > 1 && (
        <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <IconButton
            icon="caret-left"
            disabled={page === 0}
            onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
          />
        </div>
      )}
      <div
        className={clsx('str-video__paginated-grid-layout__group fake-grid-adaptive')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 6,
          width: '100%',
          height: '100%',
          padding: 6,
        }}
      >
        {call && selectedGroup.length > 0 && (
          <>
            {selectedGroup.map((item) =>
              item.kind === 'real' ? (
                <ParticipantView
                  participant={item.participant}
                  ParticipantViewUI={ParticipantViewUI}
                  VideoPlaceholder={VideoPlaceholder}
                  key={item.participant.sessionId}
                />
              ) : (
                <FakeTile fake={item.fake} key={item.fake._id} />
              )
            )}
          </>
        )}
      </div>
      {pageCount > 1 && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}>
          <IconButton
            disabled={page === pageCount - 1}
            icon="caret-right"
            onClick={() => setPage((currentPage) => Math.min(pageCount - 1, currentPage + 1))}
          />
        </div>
      )}
    </div>
  );
};

export default GridLayout;
