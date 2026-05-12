import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * POST /api/expert/comments/broadcast
 * Body: {
 *   meetingId: string,
 *   text: string,        // single message to be sent by EVERY existing fake
 *   intervalSeconds?: number,   // delay BETWEEN fakes (e.g. 3 => fake0 at 0s, fake1 at 3s, ...)
 *   startDelaySeconds?: number, // first fake delay (default 0)
 * }
 * Creates one scheduled_comment per existing fake, all with the same text.
 */

async function requireExpert() {
  const { userId } = await auth();
  if (!userId) return { error: Response.json({ error: 'unauthenticated' }, { status: 401 }) };
  const db = await getDb();
  const expert = await db.collection('experts').findOne({ clerkUserId: userId, active: true });
  if (!expert) return { error: Response.json({ error: 'not an expert' }, { status: 403 }) };
  let plan = null;
  if (expert.planId) {
    plan = await db.collection('plans').findOne({ _id: new ObjectId(String(expert.planId)) });
  }
  return { db, expert, plan };
}

export async function POST(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert, plan } = ctx;
  const body = await request.json();
  const meetingId = String(body.meetingId || '');
  const text = String(body.text || '').trim();
  const intervalSeconds = Math.max(0, Number(body.intervalSeconds ?? 0));
  const startDelaySeconds = Math.max(0, Number(body.startDelaySeconds ?? 0));

  if (!meetingId) return Response.json({ error: 'meetingId required' }, { status: 400 });
  if (!text) return Response.json({ error: 'text required' }, { status: 400 });

  const fakes = await db
    .collection('fake_profiles')
    .find({ expertId: String(expert._id), meetingId, active: true })
    .toArray();
  if (fakes.length === 0) {
    return Response.json({ error: 'No fake participants in this meeting.' }, { status: 400 });
  }

  let toCreate = fakes.length;
  if (plan) {
    const current = await db
      .collection('scheduled_comments')
      .countDocuments({ expertId: String(expert._id), meetingId });
    const available = Math.max(0, plan.maxComments - current);
    toCreate = Math.min(fakes.length, available);
    if (toCreate === 0) {
      return Response.json(
        { error: `Limite do plano atingido (${plan.maxComments} comentários por reunião)` },
        { status: 403 }
      );
    }
  }

  const docs: any[] = [];
  for (let i = 0; i < toCreate; i++) {
    docs.push({
      expertId: String(expert._id),
      meetingId,
      fakeProfileId: String(fakes[i]._id),
      text,
      delaySeconds: startDelaySeconds + i * intervalSeconds,
      sent: false,
      createdAt: new Date(),
    });
  }
  await db.collection('scheduled_comments').insertMany(docs);
  return Response.json({ ok: true, created: docs.length, skipped: fakes.length - toCreate });
}
