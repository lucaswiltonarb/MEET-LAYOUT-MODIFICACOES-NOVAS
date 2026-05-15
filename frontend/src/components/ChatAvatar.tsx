// Custom avatar passed to stream-chat-react Channel so that each user gets a
// distinct color (one of 20) instead of every avatar showing the same blue.
import type { AvatarProps } from 'stream-chat-react';

const AVATAR_PALETTE = [
  '#1a73e8', '#d93025', '#188038', '#f9ab00', '#9334e6',
  '#e8710a', '#1e8e3e', '#a142f4', '#ea4335', '#34a853',
  '#fbbc04', '#673ab7', '#ff5722', '#009688', '#3f51b5',
  '#e91e63', '#795548', '#607d8b', '#00acc1', '#7b1fa2',
];

const colorForUser = (key: string): string => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
};

const ChatAvatar = (props: AvatarProps) => {
  const { image, name, user, size = 32 } = props;
  const displayName = name || user?.name || user?.id || '?';
  const key = (user?.id || displayName) as string;
  const initial = (displayName.trim()[0] || '?').toUpperCase();
  const bg = colorForUser(key);

  if (image) {
    return (
      <img
        className="str-chat__avatar-image"
        src={image}
        alt={displayName}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      className="str-chat__avatar-fallback"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: 'white',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, Math.floor(size * 0.45)),
        fontWeight: 500,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
};

export default ChatAvatar;
