'use client';
import { useMemo } from 'react';
import { useCallStateHooks, useConnectedUser } from '@stream-io/video-react-sdk';
import useMeetingFakes from '../hooks/useMeetingFakes';

interface PeoplePanelProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
}

const hashColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
};

const PeoplePanel = ({ isOpen, onClose, meetingId }: PeoplePanelProps) => {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const me = useConnectedUser();
  const fakes = useMeetingFakes(meetingId);

  const total = participants.length + fakes.length;

  const realRows = useMemo(() => {
    return participants.map((p) => {
      const name = p.name || p.userId || 'Convidado';
      const isMe = me?.id === p.userId;
      const isHost = (p as any).roles?.includes?.('host');
      return {
        key: p.sessionId || p.userId,
        name,
        suffix: isMe ? ' (Você)' : '',
        role: isHost ? 'Organizador da reunião' : '',
        image: p.image,
        color: hashColor(p.userId || name),
        muted: !p.audioStream,
      };
    });
  }, [participants, me]);

  if (!isOpen) return null;

  return (
    <aside
      data-testid="people-panel"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#1f1f1f',
        color: 'white',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Roboto, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #303030' }}>
        <h2 style={{ fontSize: 18, fontWeight: 400, margin: 0 }}>Pessoas</h2>
        <button
          data-testid="people-panel-close"
          onClick={onClose}
          aria-label="Fechar"
          style={{
            background: 'transparent',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 20px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9aa0a6', margin: '6px 4px 12px' }}>
          Na reunião · {total}
        </div>

        <div style={{ background: '#2a2a2a', borderRadius: 10, padding: '8px 4px' }}>
          <div style={{ padding: '6px 14px 6px', fontSize: 14, fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
            <span>Colaboradores</span>
            <span style={{ color: '#9aa0a6' }}>{total}</span>
          </div>

          {realRows.map((p) => (
            <PersonRow
              key={p.key}
              testId={`person-real-${p.key}`}
              name={p.name + p.suffix}
              role={p.role}
              image={p.image}
              color={p.color}
              muted={p.muted}
            />
          ))}

          {fakes.map((f) => (
            <PersonRow
              key={f._id}
              testId={`person-fake-${f._id}`}
              name={f.name}
              role=""
              image={f.imageUrl || undefined}
              color={f.avatarColor}
              muted={true}
            />
          ))}

          {total === 0 && (
            <div style={{ padding: '16px', color: '#9aa0a6', fontSize: 13, textAlign: 'center' }}>
              Ninguém na reunião ainda
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

const PersonRow = ({
  testId,
  name,
  role,
  image,
  color,
  muted,
}: {
  testId: string;
  name: string;
  role: string;
  image?: string;
  color: string;
  muted: boolean;
}) => (
  <div
    data-testid={testId}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 14px',
      borderRadius: 8,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: color,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        fontWeight: 500,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {image ? (
        // eslint-disable-next-line
        <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        (name.trim()[0] || '?').toUpperCase()
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      {role && <div style={{ fontSize: 12, color: '#9aa0a6' }}>{role}</div>}
    </div>
    {muted && (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#9aa0a6" aria-label="Microfone desativado">
        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
      </svg>
    )}
  </div>
);

export default PeoplePanel;
