import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

/**
 * GET /api/expert/check - Returns whether the currently logged in Clerk user
 * is registered as an expert + the plan limits.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ isExpert: false });

  const db = await getDb();
  const expert = await db.collection('experts').findOne({ clerkUserId: userId, active: true });
  if (!expert) return Response.json({ isExpert: false });

  let plan = null;
  if (expert.planId) {
    plan = await db.collection('plans').findOne({ _id: new (await import('mongodb')).ObjectId(String(expert.planId)) });
  }
  return Response.json({
    isExpert: true,
    expert: { ...expert, _id: String(expert._id), planId: expert.planId ? String(expert.planId) : null },
    plan: plan ? { ...plan, _id: String(plan._id) } : null,
  });
}
