import { StreamClient } from '@stream-io/node-sdk';

const VIDEO_API_KEY = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!;
const VIDEO_SECRET = process.env.STREAM_VIDEO_API_SECRET!;
const CHAT_API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;
const CHAT_SECRET = process.env.STREAM_CHAT_API_SECRET!;

export async function POST(request: Request) {
  const body = await request.json();
  const userId = body?.userId;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const videoClient = new StreamClient(VIDEO_API_KEY, VIDEO_SECRET);
  const chatClient = new StreamClient(CHAT_API_KEY, CHAT_SECRET);

  const videoToken = videoClient.generateUserToken({ user_id: userId });
  const chatToken = chatClient.generateUserToken({ user_id: userId });

  return Response.json({
    userId,
    // Backward compatible field (defaults to video token)
    token: videoToken,
    videoToken,
    chatToken,
  });
}
