import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * POST /api/expert/comments/multi
 * Body: {
 *   meetingId: string,
 *   items: Array<{ fakeProfileId: string; text: string; delaySeconds?: number }>
 * }
 * Creates each item as its own scheduled_comment (no distribution / no template).
 * Used by the "Adicionar em lote (linhas)" UI in the expert panel.
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
  const rawItems: any[] = Array.isArray(body.items) ? body.items : [];

  if (!meetingId) return Response.json({ error: 'meetingId required' }, { status: 400 });

  // Sanitize items
  const items = rawItems
    .map((it) => ({
      fakeProfileId: String(it?.fakeProfileId || '').trim(),
      text: String(it?.text || '').trim(),
      delaySeconds: Math.max(0, Number(it?.delaySeconds ?? 0)),
    }))
    .filter((it) => it.fakeProfileId && it.text);

  if (items.length === 0) {
    return Response.json({ error: 'No valid rows' }, { status: 400 });
  }

  // Validate fakes belong to this expert + meeting
  const fakeIds = Array.from(new Set(items.map((i) => i.fakeProfileId)));
  const fakeDocs = await db
    .collection('fake_profiles')
    .find({
      _id: { $in: fakeIds.map((i) => new ObjectId(i)) },
      expertId: String(expert._id),
      meetingId,
    })
    .toArray();
  const validIds = new Set(fakeDocs.map((d: any) => String(d._id)));
  const filtered = items.filter((it) => validIds.has(it.fakeProfileId));

  if (filtered.length === 0) {
    return Response.json({ error: 'No items refer to a valid fake of this meeting' }, { status: 400 });
  }

  // Plan limit
  let toCreate = filtered.length;
  if (plan) {
    const current = await db
      .collection('scheduled_comments')
      .countDocuments({ expertId: String(expert._id), meetingId });
    const available = Math.max(0, plan.maxComments - current);
    toCreate = Math.min(filtered.length, available);
    if (toCreate === 0) {
      return Response.json(
        { error: `Limite do plano atingido (${plan.maxComments} comentários por reunião)` },
        { status: 403 }
      );
    }
  }

  const docs = filtered.slice(0, toCreate).map((it) => ({
    expertId: String(expert._id),
    meetingId,
    fakeProfileId: it.fakeProfileId,
    text: it.text,
    delaySeconds: it.delaySeconds,
    sent: false,
    createdAt: new Date(),
  }));

  await db.collection('scheduled_comments').insertMany(docs);
  return Response.json({
    ok: true,
    created: docs.length,
    skipped: items.length - docs.length,
  });
}
