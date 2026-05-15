'use client';
import {
  DefaultStreamChatGenerics,
  MessageInput,
  MessageList,
  Channel,
  Window,
} from 'stream-chat-react';
import { type Channel as ChannelType } from 'stream-chat';

interface ChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelType<DefaultStreamChatGenerics>;
}

const ChatPopup = ({ channel, isOpen, onClose }: ChatPopupProps) => {
  if (!isOpen) return null;

  return (
    <aside
      data-testid="chat-popup"
      className="chat-popup-dark"
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #303030',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 400, margin: 0 }}>Mensagens da chamada</h2>
        <button
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Channel channel={channel}>
          <Window>
            <MessageList disableDateSeparator />
            <MessageInput noFiles />
          </Window>
        </Channel>
      </div>
    </aside>
  );
};

export default ChatPopup;
