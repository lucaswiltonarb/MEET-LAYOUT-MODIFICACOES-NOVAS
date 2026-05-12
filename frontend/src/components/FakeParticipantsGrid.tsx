'use client';
import { useEffect, useState } from 'react';

type Fake = {
  _id: string;
  streamId: string;
  name: string;
  avatarColor: string;
  imageUrl?: string | null;
};

interface FakeParticipantsGridProps {
  meetingId: string;
}

/**
 * Renders fake participant tiles in the meeting screen.
 * They are NOT real Stream participants (no video, no audio) — they are
 * purely visual cards that look like a real participant with the camera off.
 * Comments from these fakes are sent server-side via Stream Chat.
 */
const FakeParticipantsGrid = ({ meetingId }: FakeParticipantsGridProps) => {
  const [fakes, setFakes] = useState<Fake[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchFakes = () => {
      fetch(`/api/meeting-fakes?meetingId=${meetingId}`)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setFakes(d.fakes || []); })
        .catch(() => {});
    };
    fetchFakes();
    const interval = setInterval(fetchFakes, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [meetingId]);

  if (fakes.length === 0) return null;

  return (
    <div className="fake-participants-overlay" data-testid="fake-participants-overlay">
      <div className="fake-participants-label">
        <span className="fake-dot" /> {fakes.length} simulado{fakes.length > 1 ? 's' : ''}
      </div>
      <div className="fake-participants-grid">
        {fakes.map((f) => (
          <div key={f._id} className="fake-tile" data-testid={`fake-tile-${f._id}`}>
            <div className="fake-avatar" style={{ background: f.avatarColor }}>
              {f.imageUrl ? (
                // eslint-disable-next-line
                <img src={f.imageUrl} alt={f.name} />
              ) : (
                <span>{f.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="fake-name">{f.name}</div>
            <div className="fake-mic-off">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .fake-participants-overlay {
          position: absolute;
          right: 16px;
          top: 16px;
          z-index: 5;
          max-width: 260px;
          pointer-events: none;
        }
        .fake-participants-label {
          font-size: 11px;
          color: white;
          background: rgba(0, 0, 0, 0.55);
          padding: 4px 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          font-family: Roboto, Arial, sans-serif;
          letter-spacing: 0.02em;
        }
        .fake-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff5252;
          display: inline-block;
          animation: pulse 1.6s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
        .fake-participants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
        }
        .fake-tile {
          position: relative;
          aspect-ratio: 16 / 10;
          background: #202124;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fake-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
          font-weight: 500;
          font-family: Roboto, Arial, sans-serif;
          overflow: hidden;
        }
        .fake-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .fake-name {
          position: absolute;
          left: 8px;
          bottom: 6px;
          color: white;
          font-size: 11px;
          font-family: Roboto, Arial, sans-serif;
          text-shadow: 0 1px 2px rgba(0,0,0,0.6);
          max-width: calc(100% - 36px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fake-mic-off {
          position: absolute;
          right: 6px;
          top: 6px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(32, 33, 36, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};

export default FakeParticipantsGrid;
