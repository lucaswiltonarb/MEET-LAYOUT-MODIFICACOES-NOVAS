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

const GROUP_SIZE = 6;

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
    >
      {pageCount > 1 && (
        <IconButton
          icon="caret-left"
          disabled={page === 0}
          onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
        />
      )}
      <div
        className={clsx('str-video__paginated-grid-layout__group', {
          'str-video__paginated-grid-layout--one': selectedGroup.length === 1,
          'str-video__paginated-grid-layout--two-four':
            selectedGroup.length >= 2 && selectedGroup.length <= 4,
          'str-video__paginated-grid-layout--five-nine':
            selectedGroup.length >= 5 && selectedGroup.length <= 9,
        })}
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
        <IconButton
          disabled={page === pageCount - 1}
          icon="caret-right"
          onClick={() => setPage((currentPage) => Math.min(pageCount - 1, currentPage + 1))}
        />
      )}
    </div>
  );
};

export default GridLayout;
