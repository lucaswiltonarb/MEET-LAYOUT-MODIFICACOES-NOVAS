import { StreamChat } from 'stream-chat';

const CHAT_API_KEY = process.env.NEXT_PUBLIC_STREAM_CHAT_API_KEY!;
const CHAT_SECRET = process.env.STREAM_CHAT_API_SECRET!;

/**
 * Ensures the chat channel exists for the meeting and the given user
 * is added as a member, so they can send messages.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { meetingId, userId, userName } = body ?? {};

  if (!meetingId || !userId) {
    return Response.json(
      { error: 'meetingId and userId are required' },
      { status: 400 }
    );
  }

  const serverClient = StreamChat.getInstance(CHAT_API_KEY, CHAT_SECRET);

  try {
    // Upsert the user first so it exists on Stream Chat side
    await serverClient.upsertUser({
      id: userId,
      role: userId.startsWith('guest_') ? 'guest' : 'user',
      name: userName || userId,
    });

    const channel = serverClient.channel('messaging', meetingId, {
      created_by_id: userId,
    } as any);

    // Create the channel if it doesn't exist; ignore "already exists" errors
    try {
      await channel.create();
    } catch {
      /* already exists */
    }

    // Add this user as a member (so they can send messages)
    try {
      await channel.addMembers([userId]);
    } catch (err: any) {
      // If already a member or similar, ignore
      console.warn('addMembers warning:', err?.message);
    }

    return Response.json({ ok: true, meetingId, userId });
  } catch (err: any) {
    console.error('channel-join error:', err);
    return Response.json(
      { error: err?.message || 'Failed to join channel' },
      { status: 500 }
    );
  }
}
