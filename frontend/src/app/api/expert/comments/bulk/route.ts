import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * POST /api/expert/comments/bulk
 * Body: {
 *   meetingId: string,
 *   texts: string[],              // one comment per item
 *   delayMin?: number,            // seconds (default 5)
 *   delayMax?: number,            // seconds (default 60)
 *   shuffleFakes?: boolean,       // default true (random assign), false = round-robin
 * }
 * Distributes the provided comment texts across the existing fake participants
 * of that meeting (round-robin or random) with a random delay in [min, max].
 * Caps at plan.maxComments per meeting.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  const db = await getDb();
  const expert = await db.collection('experts').findOne({ clerkUserId: userId, active: true });
  if (!expert) return Response.json({ error: 'not an expert' }, { status: 403 });

  let plan = null;
  if (expert.planId) {
    plan = await db.collection('plans').findOne({ _id: new ObjectId(String(expert.planId)) });
  }

  const body = await request.json();
  const meetingId = String(body.meetingId || '');
  const rawTexts: string[] = Array.isArray(body.texts) ? body.texts : [];
  const texts = rawTexts
    .map((t) => String(t || '').trim())
    .filter((t) => t.length > 0);
  const delayMin = Math.max(0, Number(body.delayMin ?? 5));
  const delayMaxRaw = Math.max(delayMin, Number(body.delayMax ?? 60));
  const shuffle = body.shuffleFakes !== false;

  if (!meetingId) return Response.json({ error: 'meetingId required' }, { status: 400 });
  if (texts.length === 0) return Response.json({ error: 'no texts provided' }, { status: 400 });

  const fakes = await db
    .collection('fake_profiles')
    .find({ expertId: String(expert._id), meetingId, active: true })
    .toArray();

  if (fakes.length === 0) {
    return Response.json({ error: 'No fake participants in this meeting. Add fakes first.' }, { status: 400 });
  }

  // Apply plan limit
  let toCreate = texts.length;
  if (plan) {
    const current = await db
      .collection('scheduled_comments')
      .countDocuments({ expertId: String(expert._id), meetingId });
    const available = Math.max(0, plan.maxComments - current);
    toCreate = Math.min(texts.length, available);
    if (toCreate === 0) {
      return Response.json(
        { error: `Limite do plano atingido (${plan.maxComments} comentários por reunião)` },
        { status: 403 }
      );
    }
  }

  const docs: any[] = [];
  for (let i = 0; i < toCreate; i++) {
    const fake = shuffle
      ? fakes[Math.floor(Math.random() * fakes.length)]
      : fakes[i % fakes.length];
    const delaySeconds =
      delayMaxRaw === delayMin
        ? delayMin
        : Math.floor(delayMin + Math.random() * (delayMaxRaw - delayMin + 1));
    docs.push({
      expertId: String(expert._id),
      meetingId,
      fakeProfileId: String(fake._id),
      text: texts[i],
      delaySeconds,
      sent: false,
      createdAt: new Date(),
    });
  }

  await db.collection('scheduled_comments').insertMany(docs);

  return Response.json({
    ok: true,
    created: docs.length,
    skipped: texts.length - toCreate,
  });
}
