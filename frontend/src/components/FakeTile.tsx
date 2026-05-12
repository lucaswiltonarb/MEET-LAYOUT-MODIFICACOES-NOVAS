'use client';
import { useMemo, useState } from 'react';
import clsx from 'clsx';

import MicOffFilled from './icons/MicOffFilled';
import Keep from './icons/Keep';
import VisualEffects from './icons/VisualEffects';
import MoreVert from './icons/MoreVert';

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
 * Renders a tile that visually mirrors Stream's <ParticipantView /> for a
 * participant with camera and mic off. DOM structure intentionally mirrors
 * ParticipantViewUI so the look (name bottom-left, mic top-right, hover menu)
 * is identical to real participants.
 */
const FakeTile = ({ fake }: FakeTileProps) => {
  const initial = useMemo(() => (fake.name?.[0] || '?').toUpperCase(), [fake.name]);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="str-video__participant-view str-video__participant-view--no-video str-video__participant-view--no-audio"
      data-testid={`fake-tile-${fake._id}`}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Placeholder identical to a real participant without video */}
      <div className="absolute w-full h-full rounded-[inherit] bg-dark-gray flex items-center justify-center participant-view-placeholder">
        {fake.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fake.imageUrl}
            alt={fake.name}
            style={{
              width: '30%',
              maxWidth: 160,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            className="relative avatar w-3/10 max-w-40 aspect-square uppercase rounded-full text-white font-sans-serif font-medium flex items-center justify-center"
            style={{ backgroundColor: fake.avatarColor }}
          >
            <span className="text-[clamp(30px,_calc(100vw_*_0.05),_65px)] select-none">
              {initial}
            </span>
          </div>
        )}
      </div>

      {/* Name label — IDENTICAL to real participant (bottom-left) */}
      <div className="z-1 absolute left-0 bottom-[.65rem] max-w-94 h-fit truncate font-medium text-white text-sm flex items-center justify-start gap-4 mt-1.5 mx-4 mb-0 cursor-default select-none">
        <span
          style={{
            textShadow: '0 1px 2px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.3)',
          }}
        >
          {fake.name}
        </span>
      </div>

      {/* Mic-off icon — IDENTICAL to real participant (top-right) */}
      <div className="absolute top-3.5 right-3.5 w-6.5 h-6.5 flex items-center justify-center bg-[#2021244d] rounded-full">
        <MicOffFilled width={18} height={18} />
      </div>

      {/* Hover detector overlay (same as real participant) */}
      <div
        onMouseOver={() => setShowMenu(true)}
        onMouseOut={() => setShowMenu(false)}
        className="absolute z-1 left-0 top-0 w-full h-full rounded-xl bg-transparent menu-overlay"
      />

      {/* Hover menu (Pin / Visual effects / More options) — visual only */}
      <div
        className={clsx(
          showMenu ? 'opacity-60' : 'opacity-0',
          'z-2 absolute left-[calc(50%-66px)] top-[calc(50%-22px)] flex items-center justify-center h-11 transition-opacity duration-300 ease-linear overflow-hidden',
          'shadow-[0_1px_2px_0px_rgba(0,0,0,0.3),_0_1px_3px_1px_rgba(0,0,0,.15)] bg-meet-black rounded-full h-11 hover:opacity-90'
        )}
      >
        <button
          type="button"
          title="Pin"
          onClick={(e) => e.preventDefault()}
          className="h-11 w-11 rounded-full p-2.5 bg-transparent border-transparent outline-none hover:bg-[rgba(232,234,237,.15)] transition-[background] duration-150 ease-linear"
        >
          <Keep />
        </button>
        <button
          type="button"
          title="Apply visual effects"
          onClick={(e) => e.preventDefault()}
          className="h-11 w-11 rounded-full p-2.5 bg-transparent border-transparent outline-none hover:bg-[rgba(232,234,237,.15)] transition-[background] duration-150 ease-linear"
        >
          <VisualEffects />
        </button>
        <button
          type="button"
          title="More options"
          onClick={(e) => e.preventDefault()}
          className="h-11 w-11 rounded-full p-2.5 bg-transparent border-transparent outline-none hover:bg-[rgba(232,234,237,.15)] transition-[background] duration-150 ease-linear"
        >
          <MoreVert />
        </button>
      </div>
    </div>
  );
};

export default FakeTile;
