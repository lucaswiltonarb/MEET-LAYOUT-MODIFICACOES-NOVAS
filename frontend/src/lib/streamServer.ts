import { StreamChat } from 'stream-chat';

const CHAT_API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;
const CHAT_SECRET = process.env.STREAM_CHAT_API_SECRET!;

let _client: StreamChat | null = null;

export function getStreamServerClient(): StreamChat {
  if (!_client) {
    _client = StreamChat.getInstance(CHAT_API_KEY, CHAT_SECRET);
  }
  return _client;
}
