import { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { nanoid } from 'nanoid';
import {
  Call,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  User,
} from '@stream-io/video-react-sdk';
import { User as ChatUser, StreamChat } from 'stream-chat';
import { Chat } from 'stream-chat-react';

import LoadingOverlay from '../components/LoadingOverlay';

type MeetProviderProps = {
  meetingId: string;
  children: React.ReactNode;
};

export const CALL_TYPE = 'default';
export const VIDEO_API_KEY = process.env.REACT_APP_STREAM_VIDEO_API_KEY as string;
export const CHAT_API_KEY = process.env.REACT_APP_STREAM_CHAT_API_KEY as string;
// Backward-compat: some files reference API_KEY
export const API_KEY = VIDEO_API_KEY;
export const GUEST_ID = `guest_${nanoid(15)}`;

type TokenResponse = {
  userId: string;
  token: string;
  videoToken: string;
  chatToken: string;
};

const fetchTokens = async (userId: string): Promise<TokenResponse> => {
  const response = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userId || GUEST_ID }),
  });
  return response.json();
};

export const tokenProvider = async (userId: string = '') => {
  const data = await fetchTokens(userId || GUEST_ID);
  return data.videoToken;
};

export const chatTokenProvider = async (userId: string = '') => {
  const data = await fetchTokens(userId || GUEST_ID);
  return data.chatToken;
};

const MeetProvider = ({ meetingId, children }: MeetProviderProps) => {
  const { user: clerkUser, isSignedIn, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [chatClient, setChatClient] = useState<StreamChat>();
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();

  useEffect(() => {
    if (!isLoaded) return;

    const videoTokenProvider = async () => {
      const data = await fetchTokens(clerkUser?.id || GUEST_ID);
      return data.videoToken;
    };

    const chatTokenFn = async () => {
      const data = await fetchTokens(clerkUser?.id || GUEST_ID);
      return data.chatToken;
    };

    let user: User | ChatUser;
    if (isSignedIn) {
      user = {
        id: clerkUser.id,
        name: clerkUser.fullName!,
        image: clerkUser.hasImage ? clerkUser.imageUrl : undefined,
        custom: {
          username: clerkUser?.username,
        },
      };
    } else {
      user = {
        id: GUEST_ID,
        type: 'guest',
        name: 'Guest',
      };
    }

    const _chatClient = StreamChat.getInstance(CHAT_API_KEY);
    const _videoClient = new StreamVideoClient({
      apiKey: VIDEO_API_KEY,
      user: user as any,
      tokenProvider: videoTokenProvider,
    });
    const _call = _videoClient.call(CALL_TYPE, meetingId);

    const setUpChat = async (u: ChatUser) => {
      try {
        await _chatClient.connectUser(u, chatTokenFn);
      } catch (err) {
        console.error('Chat connect error:', err);
      }
      setChatClient(_chatClient);
      setLoading(false);
    };

    setVideoClient(_videoClient);
    setCall(_call);
    setUpChat(user);

    return () => {
      _videoClient.disconnectUser();
      _chatClient.disconnectUser();
    };
    // eslint-disable-next-line
  }, [clerkUser, isLoaded, isSignedIn, meetingId]);

  if (loading) return <LoadingOverlay />;

  return (
    <Chat client={chatClient!}>
      <StreamVideo client={videoClient!}>
        <StreamCall call={call}>{children}</StreamCall>
      </StreamVideo>
    </Chat>
  );
};

export default MeetProvider;
