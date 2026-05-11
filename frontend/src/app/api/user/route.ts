import { StreamClient } from '@stream-io/node-sdk';

const VIDEO_API_KEY = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!;
const VIDEO_SECRET = process.env.STREAM_VIDEO_API_SECRET!;
const CHAT_API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;
const CHAT_SECRET = process.env.STREAM_CHAT_API_SECRET!;

export async function POST(request: Request) {
  const body = await request.json();
  const user = body?.user;

  if (!user) {
    return Response.json({ error: 'user is required' }, { status: 400 });
  }

  const videoClient = new StreamClient(VIDEO_API_KEY, VIDEO_SECRET);
  const chatClient = new StreamClient(CHAT_API_KEY, CHAT_SECRET);

  const payload = {
    users: [
      {
        id: user.id,
        set: {
          name: user.name,
          role: 'user',
        },
      },
    ],
  };

  // Update on both apps; ignore individual failures
  const [videoRes, chatRes] = await Promise.allSettled([
    videoClient.updateUsersPartial(payload),
    chatClient.updateUsersPartial(payload),
  ]);

  return Response.json({
    video: videoRes.status === 'fulfilled' ? videoRes.value : { error: String(videoRes.reason) },
    chat: chatRes.status === 'fulfilled' ? chatRes.value : { error: String(chatRes.reason) },
  });
}
