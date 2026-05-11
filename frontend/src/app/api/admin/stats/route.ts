import { isAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/db';

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = await getDb();
  const [plans, experts, fakes, comments] = await Promise.all([
    db.collection('plans').countDocuments(),
    db.collection('experts').countDocuments(),
    db.collection('fake_profiles').countDocuments(),
    db.collection('scheduled_comments').countDocuments(),
  ]);
  return Response.json({ plans, experts, fakes, comments });
}
