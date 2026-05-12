import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getStreamServerClient } from '@/lib/streamServer';

const COLORS = ['#1a73e8', '#9334e6', '#ea4335', '#34a853', '#ff6d01', '#46bdc6', '#7cb342', '#ff5722'];

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
  const fakes = await db.collection('fake_profiles').find(filter).sort({ createdAt: -1 }).toArray();
  return Response.json({
    fakes: fakes.map((f) => ({ ...f, _id: String(f._id) })),
    plan: ctx.plan ? { ...ctx.plan, _id: String(ctx.plan._id) } : null,
  });
}

export async function POST(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert, plan } = ctx;
  const body = await request.json();
  const { meetingId, name, imageUrl } = body;

  if (!meetingId || !name) {
    return Response.json({ error: 'meetingId and name required' }, { status: 400 });
  }

  const trimmedName = String(name).trim();

  // Block duplicate names within the same meeting
  const dupe = await db.collection('fake_profiles').findOne({
    expertId: String(expert._id),
    meetingId,
    name: trimmedName,
  });
  if (dupe) {
    return Response.json({ error: `Já existe um fake chamado "${trimmedName}" nesta reunião.` }, { status: 409 });
  }

  // Enforce plan limits
  if (plan) {
    const count = await db.collection('fake_profiles').countDocuments({ expertId: String(expert._id), meetingId });
    if (count >= plan.maxFakeParticipants) {
      return Response.json(
        { error: `Plan limit reached (${plan.maxFakeParticipants} fake participants per meeting)` },
        { status: 403 }
      );
    }
  }

  const avatarColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const doc: any = {
    expertId: String(expert._id),
    meetingId,
    name: trimmedName,
    avatarColor,
    imageUrl: imageUrl || undefined,
    active: true,
    createdAt: new Date(),
  };
  const result = await db.collection('fake_profiles').insertOne(doc);
  const fakeId = `fake_${String(result.insertedId)}`;

  // Upsert as Stream user + add to channel as member
  try {
    const stream = getStreamServerClient();
    await stream.upsertUser({ id: fakeId, role: 'user', name: doc.name, image: doc.imageUrl });
    const channel = stream.channel('messaging', meetingId, { created_by_id: fakeId } as any);
    try { await channel.create(); } catch {}
    try { await channel.addMembers([fakeId]); } catch {}
  } catch (e: any) {
    console.warn('Stream sync for fake failed:', e?.message);
  }

  return Response.json({ ok: true, fake: { ...doc, _id: String(result.insertedId), streamId: fakeId } });
}

export async function DELETE(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids');
  const all = searchParams.get('all');
  const meetingId = searchParams.get('meetingId');

  // Delete ALL fakes of a meeting
  if (all === 'true') {
    if (!meetingId) return Response.json({ error: 'meetingId required' }, { status: 400 });
    const list = await db.collection('fake_profiles').find({ expertId: String(expert._id), meetingId }).toArray();
    const objIds = list.map((d: any) => d._id);
    const strIds = list.map((d: any) => String(d._id));
    await db.collection('fake_profiles').deleteMany({ _id: { $in: objIds } });
    await db.collection('scheduled_comments').deleteMany({ fakeProfileId: { $in: strIds } });
    return Response.json({ ok: true, deleted: strIds.length });
  }

  // Delete multiple ids (comma-separated)
  if (ids) {
    const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
    const objIds = idList.map((i) => new ObjectId(i));
    const list = await db.collection('fake_profiles').find({ _id: { $in: objIds }, expertId: String(expert._id) }).toArray();
    const strIds = list.map((d: any) => String(d._id));
    await db.collection('fake_profiles').deleteMany({ _id: { $in: list.map((d: any) => d._id) } });
    await db.collection('scheduled_comments').deleteMany({ fakeProfileId: { $in: strIds } });
    return Response.json({ ok: true, deleted: strIds.length });
  }

  // Single delete
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const doc = await db.collection('fake_profiles').findOne({ _id: new ObjectId(id), expertId: String(expert._id) });
  if (!doc) return Response.json({ error: 'not found' }, { status: 404 });
  await db.collection('fake_profiles').deleteOne({ _id: new ObjectId(id) });
  await db.collection('scheduled_comments').deleteMany({ fakeProfileId: id });
  return Response.json({ ok: true, deleted: 1 });
}
