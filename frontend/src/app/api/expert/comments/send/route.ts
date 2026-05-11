import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getStreamServerClient } from '@/lib/streamServer';

/**
 * POST /api/expert/comments/send
 * Body: { commentId } -> sends a specific scheduled comment now
 *   OR  { meetingId, fakeProfileId, text } -> ad-hoc send (no DB persistence required)
 *
 * Sends as the fake user via Stream Chat server-side.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const db = await getDb();
  const expert = await db.collection('experts').findOne({ clerkUserId: userId, active: true });
  if (!expert) return Response.json({ error: 'not an expert' }, { status: 403 });

  const body = await request.json();
  let meetingId: string;
  let fakeProfileId: string;
  let text: string;
  let commentDocId: string | null = null;

  if (body.commentId) {
    const c = await db.collection('scheduled_comments').findOne({
      _id: new ObjectId(String(body.commentId)),
      expertId: String(expert._id),
    });
    if (!c) return Response.json({ error: 'comment not found' }, { status: 404 });
    meetingId = String(c.meetingId);
    fakeProfileId = String(c.fakeProfileId);
    text = String(c.text);
    commentDocId = String(c._id);
  } else {
    meetingId = String(body.meetingId || '');
    fakeProfileId = String(body.fakeProfileId || '');
    text = String(body.text || '');
    if (!meetingId || !fakeProfileId || !text) {
      return Response.json({ error: 'meetingId, fakeProfileId, text required' }, { status: 400 });
    }
  }

  const fake = await db.collection('fake_profiles').findOne({
    _id: new ObjectId(fakeProfileId),
    expertId: String(expert._id),
  });
  if (!fake) return Response.json({ error: 'fake profile not found' }, { status: 404 });

  const fakeStreamId = `fake_${String(fake._id)}`;
  const stream = getStreamServerClient();

  try {
    await stream.upsertUser({
      id: fakeStreamId,
      role: 'user',
      name: fake.name,
      image: fake.imageUrl,
    });

    const channel = stream.channel('messaging', meetingId, { created_by_id: fakeStreamId } as any);
    try { await channel.create(); } catch {}
    try { await channel.addMembers([fakeStreamId]); } catch {}

    const result = await channel.sendMessage(
      { text, user_id: fakeStreamId },
      { skip_push: true } as any
    );

    if (commentDocId) {
      await db.collection('scheduled_comments').updateOne(
        { _id: new ObjectId(commentDocId) },
        { $set: { sent: true, sentAt: new Date() } }
      );
    }

    return Response.json({ ok: true, messageId: result?.message?.id });
  } catch (err: any) {
    console.error('send comment failed:', err);
    return Response.json({ error: err?.message || 'send failed' }, { status: 500 });
  }
}
