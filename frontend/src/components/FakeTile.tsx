'use client';
import { useMemo } from 'react';
import clsx from 'clsx';

export type FakeParticipant = {
  _id: string;
  streamId: string;
  name: string;
  avatarColor: string;
  imageUrl?: string | null;
};

interface FakeTileProps {
  fake: FakeParticipant;
}

/**
 * Renders a tile that visually matches Stream's <ParticipantView /> for a
 * participant with camera off. Uses the same CSS classes as real participants
 * so it sits in the grid seamlessly.
 */
const FakeTile = ({ fake }: FakeTileProps) => {
  const initial = useMemo(() => (fake.name?.[0] || '?').toUpperCase(), [fake.name]);

  return (
    <div
      className="str-video__participant-view"
      data-testid={`fake-tile-${fake._id}`}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, minWidth: 0, borderRadius: 8, overflow: 'hidden' }}
    >
      {/* Background placeholder identical to a real participant with no video */}
      <div
        className={clsx('participant-view-placeholder')}
        style={{
          position: 'absolute',
          inset: 0,
          background: '#3c4043',
          borderRadius: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {fake.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fake.imageUrl}
            alt={fake.name}
            style={{
              maxWidth: '30%',
              borderRadius: '50%',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            className="avatar"
            style={{
              background: fake.avatarColor,
              width: '40%',
              maxWidth: 160,
              minWidth: 28,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontFamily: 'Roboto, Arial, sans-serif',
              fontWeight: 500,
              textTransform: 'uppercase',
            }}
          >
            <span style={{ fontSize: 'clamp(14px, 2.2vw, 65px)' }}>{initial}</span>
          </div>
        )}
      </div>

      {/* Name label (matches Stream's bottom-left text) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: '0.4rem',
          maxWidth: 'calc(100% - 1rem)',
          height: 'fit-content',
          color: 'white',
          fontSize: 'clamp(10px, 0.85vw, 14px)',
          fontWeight: 500,
          margin: '0 0.6rem',
          textShadow: '0 1px 2px rgba(0,0,0,.7), 0 0 2px rgba(0,0,0,.4)',
          fontFamily: 'Roboto, Arial, sans-serif',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          zIndex: 1,
        }}
      >
        {fake.name}
      </div>

      {/* Mic off icon (top-right, matches real participant) */}
      <div
        style={{
          position: 'absolute',
          top: '0.4rem',
          right: '0.4rem',
          width: 20,
          height: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(32, 33, 36, 0.7)',
          borderRadius: '9999px',
          zIndex: 2,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
        </svg>
      </div>
    </div>
  );
};

export default FakeTile;
