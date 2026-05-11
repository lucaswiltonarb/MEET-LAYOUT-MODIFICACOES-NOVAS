import { ObjectId } from 'mongodb';
import { isAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';

async function requireAdmin() {
  if (!(await isAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const block = await requireAdmin();
  if (block) return block;
  const db = await getDb();
  const plans = await db.collection('plans').find({}).sort({ price: 1 }).toArray();
  return Response.json({
    plans: plans.map((p) => ({ ...p, _id: String(p._id) })),
  });
}

export async function POST(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const body = await request.json();
  const db = await getDb();
  const doc = {
    name: String(body.name || '').trim(),
    maxFakeParticipants: Number(body.maxFakeParticipants) || 0,
    maxComments: Number(body.maxComments) || 0,
    price: Number(body.price) || 0,
    active: body.active !== false,
    createdAt: new Date(),
  };
  if (!doc.name) return Response.json({ error: 'name required' }, { status: 400 });
  const result = await db.collection('plans').insertOne(doc);
  return Response.json({ ok: true, id: String(result.insertedId) });
}

export async function PUT(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const body = await request.json();
  const id = body._id;
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  const update: any = {};
  ['name', 'maxFakeParticipants', 'maxComments', 'price', 'active'].forEach((k) => {
    if (body[k] !== undefined) update[k] = body[k];
  });
  if (update.maxFakeParticipants !== undefined) update.maxFakeParticipants = Number(update.maxFakeParticipants);
  if (update.maxComments !== undefined) update.maxComments = Number(update.maxComments);
  if (update.price !== undefined) update.price = Number(update.price);
  await db.collection('plans').updateOne({ _id: new ObjectId(id) }, { $set: update });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const block = await requireAdmin();
  if (block) return block;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  await db.collection('plans').deleteOne({ _id: new ObjectId(id) });
  return Response.json({ ok: true });
}
