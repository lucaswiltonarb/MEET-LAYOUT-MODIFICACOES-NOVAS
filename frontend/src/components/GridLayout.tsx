import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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

const GROUP_SIZE = 50;
const GRID_COLS = 10;
const GRID_ROWS = 5;

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

  const pageCount = useMemo(() => Math.max(1, Math.ceil(items.length / GROUP_SIZE)), [items]);

  const itemGroups = useMemo(() => {
    const groups: Item[][] = [];
    for (let i = 0; i < items.length; i += GROUP_SIZE) {
      groups.push(items.slice(i, i + GROUP_SIZE));
    }
    if (groups.length === 0) groups.push([]);
    return groups;
  }, [items]);

  const selectedGroup = itemGroups[page] || [];

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
        className={clsx('str-video__paginated-grid-layout__group fake-grid-50')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 4,
          width: '100%',
          height: '100%',
          padding: 4,
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
