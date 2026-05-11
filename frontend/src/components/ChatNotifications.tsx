'use client';
import { useEffect, useState } from 'react';
import { type Channel as ChannelType, type Event } from 'stream-chat';

interface ChatToast {
  id: string;
  authorName: string;
  authorImage?: string;
  authorInitial: string;
  text: string;
}

interface ChatNotificationsProps {
  channel: ChannelType | undefined;
  isChatOpen: boolean;
  currentUserId: string | undefined;
  onClickToast?: () => void;
}

/**
 * Listens to the chat channel and shows Google Meet style toasts in the
 * bottom-right when a new message arrives and the chat popup is closed.
 */
const ChatNotifications = ({ channel, isChatOpen, currentUserId, onClickToast }: ChatNotificationsProps) => {
  const [toasts, setToasts] = useState<ChatToast[]>([]);

  useEffect(() => {
    if (!channel) return;
    const handler = (event: Event) => {
      const msg: any = event.message;
      if (!msg || !msg.id || !msg.text) return;
      // Ignore my own messages
      if (currentUserId && msg.user?.id === currentUserId) return;
      // Skip if chat is open (user already sees it)
      if (isChatOpen) return;
      const authorName = msg.user?.name || msg.user?.id || 'Alguém';
      const initial = (authorName.trim()[0] || '?').toUpperCase();
      setToasts((prev) => {
        const next: ChatToast[] = [
          ...prev,
          {
            id: msg.id,
            authorName,
            authorImage: msg.user?.image,
            authorInitial: initial,
            text: String(msg.text),
          },
        ];
        return next.slice(-4); // keep last 4
      });
      // auto-dismiss after 6s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 6000);
    };
    channel.on('message.new', handler);
    return () => {
      channel.off('message.new', handler);
    };
  }, [channel, isChatOpen, currentUserId]);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="chat-notifications"
      style={{
        position: 'fixed',
        right: 16,
        bottom: 96,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={onClickToast}
          style={{
            background: '#202124',
            color: '#fff',
            borderRadius: 16,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 260,
            maxWidth: 360,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontFamily: 'Roboto, Arial, sans-serif',
            pointerEvents: 'auto',
            cursor: 'pointer',
            animation: 'chatToastIn 220ms ease-out',
          }}
          data-testid={`chat-toast-${t.id}`}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#8e24aa',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {t.authorImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.authorImage} alt={t.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              t.authorInitial
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{t.authorName}</div>
            <div
              style={{
                fontSize: 13,
                color: '#dadce0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {t.text}
            </div>
          </div>
          <span style={{ color: '#8ab4f8', fontSize: 18, flexShrink: 0 }}>↵</span>
        </div>
      ))}
      <style jsx>{`
        @keyframes chatToastIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ChatNotifications;
