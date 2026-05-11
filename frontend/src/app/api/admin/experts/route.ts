import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';

async function requireAdmin() {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function GET() {
  const block = await requireAdmin();
  if (block) return block;
  const db = await getDb();
  const [experts, plans] = await Promise.all([
    db.collection('experts').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('plans').find({}).toArray(),
  ]);
  const plansMap: Record<string, any> = {};
  plans.forEach((p) => (plansMap[String(p._id)] = p));

  return Response.json({
    experts: experts.map((e) => ({
      ...e,
      _id: String(e._id),
      plan: e.planId ? plansMap[String(e.planId)] : null,
    })),
  });
}

export async function POST(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const body = await request.json();
  const db = await getDb();
  const doc = {
    email: String(body.email || '').trim().toLowerCase(),
    name: String(body.name || '').trim(),
    clerkUserId: body.clerkUserId ? String(body.clerkUserId) : undefined,
    planId: body.planId ? String(body.planId) : undefined,
    active: body.active !== false,
    createdAt: new Date(),
  };
  if (!doc.email || !doc.name) {
    return Response.json({ error: 'email and name required' }, { status: 400 });
  }
  try {
    const result = await db.collection('experts').insertOne(doc as any);
    return Response.json({ ok: true, id: String(result.insertedId) });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'insert failed' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const body = await request.json();
  const id = body._id;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  const update: any = {};
  ['email', 'name', 'clerkUserId', 'planId', 'active'].forEach((k) => {
    if (body[k] !== undefined) update[k] = body[k];
  });
  if (update.email) update.email = update.email.toLowerCase();
  await db.collection('experts').updateOne({ _id: new ObjectId(id) }, { $set: update });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  await db.collection('experts').deleteOne({ _id: new ObjectId(id) });
  return Response.json({ ok: true });
}
