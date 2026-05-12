import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * Comment Library — saved templates per expert.
 * Collection: `comment_library` { expertId, text, tag?, createdAt }
 *
 * GET    -> list
 * POST   -> { text, tag? }            // create single
 * POST   -> { texts: string[], tag? } // create bulk
 * DELETE ?id= or ?ids=                // delete one or many
 */

async function requireExpert() {
  const { userId } = await auth();
  if (!userId) return { error: Response.json({ error: 'unauthenticated' }, { status: 401 }) };
  const db = await getDb();
  const expert = await db.collection('experts').findOne({ clerkUserId: userId, active: true });
  if (!expert) return { error: Response.json({ error: 'not an expert' }, { status: 403 }) };
  return { db, expert };
}

export async function GET() {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const items = await db
    .collection('comment_library')
    .find({ expertId: String(expert._id) })
    .sort({ createdAt: -1 })
    .toArray();
  return Response.json({
    items: items.map((i: any) => ({ ...i, _id: String(i._id) })),
  });
}

export async function POST(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const body = await request.json();
  const tag = body.tag ? String(body.tag).trim().slice(0, 40) : undefined;

  const texts: string[] = Array.isArray(body.texts)
    ? body.texts
    : body.text
    ? [String(body.text)]
    : [];
  const cleaned = texts.map((t) => String(t || '').trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) {
    return Response.json({ error: 'text(s) required' }, { status: 400 });
  }

  const docs = cleaned.map((text) => ({
    expertId: String(expert._id),
    text,
    tag,
    createdAt: new Date(),
  }));
  await db.collection('comment_library').insertMany(docs);
  return Response.json({ ok: true, created: docs.length });
}

export async function DELETE(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert } = ctx;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids');
  const all = searchParams.get('all');

  if (all === 'true') {
    const r = await db.collection('comment_library').deleteMany({ expertId: String(expert._id) });
    return Response.json({ ok: true, deleted: r.deletedCount });
  }
  if (ids) {
    const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
    const r = await db.collection('comment_library').deleteMany({
      _id: { $in: idList.map((i) => new ObjectId(i)) },
      expertId: String(expert._id),
    });
    return Response.json({ ok: true, deleted: r.deletedCount });
  }
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const r = await db.collection('comment_library').deleteOne({
    _id: new ObjectId(id),
    expertId: String(expert._id),
  });
  return Response.json({ ok: true, deleted: r.deletedCount });
}
