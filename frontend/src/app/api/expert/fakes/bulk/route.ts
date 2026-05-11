import { ObjectId } from 'mongodb';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getStreamServerClient } from '@/lib/streamServer';

const COLORS = ['#1a73e8', '#9334e6', '#ea4335', '#34a853', '#ff6d01', '#46bdc6', '#7cb342', '#ff5722', '#00897b', '#5e35b1', '#d81b60', '#3949ab'];

const FIRST_NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique',
  'Isabela', 'João', 'Karen', 'Lucas', 'Mariana', 'Natália', 'Otávio', 'Patrícia',
  'Rafael', 'Sabrina', 'Thiago', 'Vanessa', 'William', 'Yasmin', 'Camila', 'Daniel',
  'Eliana', 'Fernando', 'Giovanna', 'Heitor', 'Júlia', 'Leonardo', 'Mateus', 'Olívia',
  'Paulo', 'Rebeca', 'Samuel', 'Tatiana', 'Vinícius', 'Bianca', 'César', 'Débora',
  'Erick', 'Fabiana', 'Gustavo', 'Helena', 'Igor', 'Joana', 'Kelvin', 'Larissa',
  'Marcos', 'Nicole', 'Pedro', 'Renata', 'Sérgio', 'Tainá', 'Wesley', 'Yuri',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
  'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Rocha', 'Dias',
  'Nascimento', 'Mendes', 'Barbosa', 'Cardoso', 'Teixeira', 'Pinto', 'Moreira', 'Castro',
];

function randomBrazilianName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

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

/**
 * POST /api/expert/fakes/bulk { meetingId, count }
 * Generates N fake participants with random Brazilian names. Caps at plan limit.
 */
export async function POST(request: Request) {
  const ctx = await requireExpert();
  if ('error' in ctx) return ctx.error;
  const { db, expert, plan } = ctx;
  const body = await request.json();
  const meetingId = String(body.meetingId || '');
  const requested = Math.max(1, Math.min(100, Number(body.count) || 0));

  if (!meetingId) return Response.json({ error: 'meetingId required' }, { status: 400 });

  let toCreate = requested;
  if (plan) {
    const current = await db.collection('fake_profiles').countDocuments({ expertId: String(expert._id), meetingId });
    const available = Math.max(0, plan.maxFakeParticipants - current);
    toCreate = Math.min(requested, available);
    if (toCreate === 0) {
      return Response.json({ error: `Limite do plano atingido (${plan.maxFakeParticipants}/reunião)` }, { status: 403 });
    }
  }

  // Avoid duplicate names within this meeting
  const existing = await db.collection('fake_profiles')
    .find({ expertId: String(expert._id), meetingId }, { projection: { name: 1 } })
    .toArray();
  const used = new Set(existing.map((d: any) => d.name));

  const docs: any[] = [];
  let attempts = 0;
  while (docs.length < toCreate && attempts < toCreate * 20) {
    attempts++;
    const name = randomBrazilianName();
    if (used.has(name)) continue;
    used.add(name);
    docs.push({
      expertId: String(expert._id),
      meetingId,
      name,
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      active: true,
      createdAt: new Date(),
    });
  }

  if (docs.length === 0) return Response.json({ error: 'no names generated' }, { status: 500 });

  const result = await db.collection('fake_profiles').insertMany(docs);
  const ids = Object.values(result.insertedIds);

  // Best-effort: register users in Stream + add to channel
  try {
    const stream = getStreamServerClient();
    const streamUsers = ids.map((id: any, idx) => ({
      id: `fake_${String(id)}`,
      role: 'user',
      name: docs[idx].name,
    }));
    await stream.upsertUsers(streamUsers);
    const channel = stream.channel('messaging', meetingId, { created_by_id: streamUsers[0].id } as any);
    try { await channel.create(); } catch {}
    try { await channel.addMembers(streamUsers.map((u) => u.id)); } catch {}
  } catch (e: any) {
    console.warn('bulk fakes Stream sync warning:', e?.message);
  }

  return Response.json({ ok: true, created: docs.length });
}
