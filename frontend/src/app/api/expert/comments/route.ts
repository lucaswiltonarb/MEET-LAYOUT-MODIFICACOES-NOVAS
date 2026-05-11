import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getStreamServerClient } from '@/lib/streamServer';

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
  return { expert, plan, db };
}

export async function GET(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get('meetingId');
  const filter: any = { expertId: String(expert._id) };
  if (meetingId) filter.meetingId = meetingId;
  const comments = await db.collection('scheduled_comments').find(filter).sort({ delaySeconds: 1 }).toArray();
  return Response.json({
    comments: comments.map((c) => ({ ...c, _id: String(c._id) })),
  });
}

export async function POST(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert, plan } = ctx;
  const body = await request.json();
  const { meetingId, fakeProfileId, text, delaySeconds } = body;

  if (!meetingId || !fakeProfileId || !text) {
    return Response.json({ error: 'meetingId, fakeProfileId, text required' }, { status: 400 });
  }
  // Validate fake belongs to this expert
  const fake = await db.collection('fake_profiles').findOne({ _id: new ObjectId(String(fakeProfileId)), expertId: String(expert._id) });
  if (!fake) return Response.json({ error: 'fake profile not found' }, { status: 404 });

  if (plan) {
    const count = await db.collection('scheduled_comments').countDocuments({ expertId: String(expert._id), meetingId });
    if (count >= plan.maxComments) {
      return Response.json({ error: `Plan limit reached (${plan.maxComments} comments per meeting)` }, { status: 403 });
    }
  }

  const doc: any = {
    expertId: String(expert._id),
    meetingId,
    fakeProfileId: String(fakeProfileId),
    text: String(text).trim(),
    delaySeconds: Number(delaySeconds) || 0,
    sent: false,
    createdAt: new Date(),
  };
  const result = await db.collection('scheduled_comments').insertOne(doc);
  return Response.json({ ok: true, comment: { ...doc, _id: String(result.insertedId) } });
}

export async function DELETE(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  await db.collection('scheduled_comments').deleteOne({ _id: new ObjectId(id), expertId: String(expert._id) });
  return Response.json({ ok: true });
}
